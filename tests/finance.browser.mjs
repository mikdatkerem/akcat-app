import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifyFinance(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  const passed = [], screenshots = [], errors = [], keys = [], payloads = []
  let loseResponse = false, failRead = '', creates = 0
  page.on('pageerror', error => errors.push(error.message))
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  const title = name => page.getByRole('heading', { name, level: 1, exact: true })
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    const headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/v1/payments' && request.method() === 'POST') {
      creates++; keys.push(headers['idempotency-key']); payloads.push(request.postDataJSON())
      if (loseResponse) {
        loseResponse = false
        const actual = await route.fetch({ headers }); assert.equal(actual.status(), 201); await actual.dispose()
        return route.abort('failed') // Commit a REAL collection, then lose only its response.
      }
    }
    if (request.method() === 'GET' && failRead && url.pathname === failRead) headers['X-Test-Mode'] = 'finance-db-error'
    return route.continue({ headers })
  })
  async function fit(label) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.locator('#main-content').focus(); await page.evaluate(() => window.scrollTo(0, 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: ${width}px overflow`)
      const path = join(meta.temporary, `finance-${label}-${width}.png`); await page.screenshot({ path, fullPage: true }); screenshots.push(path)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  const submit = () => page.getByRole('button', { name: 'Tahsilatı Kaydet', exact: true })
  try {
    await page.goto(meta.origin + '/#/veresiye'); await title('Giriş yapın').waitFor()
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await page.getByRole('heading', { name: 'Borçlu müşteri yok', exact: true }).waitFor()
    await page.goto(meta.origin + '/#/tahsilatlar'); await page.getByRole('heading', { name: 'Tahsilat bulunamadı', exact: true }).waitFor()
    pass('protected finance routes; genuine empty debt and payment lists')
    const me = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } }); const auth = await me.json()
    async function post(path, data) {
      const response = await context.request.post(meta.origin + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), 201); return (await response.json()).data
    }
    const customer = await post('/api/v1/customers', { name: 'Ortak müşteri ' + randomUUID(), phone: '+90 555 123 45 67', address: 'Yalnızca izole test adresi' })
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    const product = await post('/api/v1/products', { name: 'İzole ürün ' + randomUUID(), current_price_kurus: 25000 })
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    const other = { id: randomUUID(), username: 'colleague_' + randomUUID().slice(0, 8) }
    await sql("INSERT INTO users(id,username,password_hash,role,is_active,created_at,updated_at) SELECT ?,?,password_hash,'employee',1,created_at,updated_at FROM users WHERE id=?", [other.id, other.username, meta.fixture.id])
    const login = await fetch(meta.api + '/api/v1/auth/login', { method: 'POST', headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: other.username, password: meta.fixture.password }) })
    assert.equal(login.status, 200); const otherAuth = await login.json(), otherCookie = login.headers.get('set-cookie').split(';')[0]
    async function otherSale(quantity, initial = 0) {
      const response = await fetch(meta.api + '/api/v1/sales', { method: 'POST', headers: { 'X-Test-Key': meta.key, Cookie: otherCookie, Origin: meta.origin,
        'Content-Type': 'application/json', 'X-CSRF-Token': otherAuth.csrfToken, 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ customer_id: customer.id, items: [{ product_id: product.id, quantity }], payment: { amount_kurus: initial, method: initial ? 'cash' : null } }) })
      assert.equal(response.status, 201); return (await response.json()).data
    }
    const sale = await otherSale(2, 10000)
    await page.goto(meta.origin + '/#/satislar'); await page.getByText(other.username, { exact: true }).waitFor()
    await page.goto(meta.origin + '/#/satislar/' + sale.id); await title('Satış detayı').waitFor()
    await page.getByRole('link', { name: 'Bu satışa tahsilat al', exact: true }).click(); await title('Yeni tahsilat').waitFor()
    await page.getByText('Kalan satış borcu: 400,00\u00a0₺', { exact: true }).waitFor()
    pass('employee views colleague sale and starts a real collection on it')
    await submit().click(); assert.equal(creates, 0)
    for (const amount of ['0', '-1', '401']) {
      await page.getByLabel(/^Alınan tutar/).fill(amount); await submit().click(); assert.equal(creates, 0)
    }
    await page.getByLabel(/^Alınan tutar/).fill('250'); await page.getByLabel(/^Tahsilat yöntemi/).selectOption('card')
    await fit('form')
    loseResponse = true; await submit().click()
    await page.getByRole('heading', { name: 'Tahsilat kaydı doğrulanamadı', exact: true }).waitFor()
    assert.equal(await page.getByLabel(/^Alınan tutar/).inputValue(), '250'); assert.equal(await page.getByLabel(/^Alınan tutar/).isDisabled(), true)
    await page.evaluate(async () => { const session = await import('/src/auth/sessionStore.ts'); await session.checkSession() })
    await title('Yeni tahsilat').waitFor(); assert.equal(await page.getByLabel(/^Alınan tutar/).inputValue(), '250')
    await page.getByRole('button', { name: 'Aynı tahsilatı tekrar dene', exact: true }).click(); await title('Tahsilatlar').waitFor()
    await page.getByText('Tahsilat kaydedildi: 250,00\u00a0₺ · Kart', { exact: true }).waitFor()
    await page.locator('.finance-debt-total').filter({ hasText: '150,00' }).waitFor()
    assert.equal(creates, 2); assert.ok(keys[0] && keys[0] === keys[1]); assert.deepEqual(payloads[0], payloads[1])
    const stored = await sql('SELECT * FROM payments WHERE sale_id=?', [sale.id]); assert.equal(stored.length, 2)
    assert.equal(stored.filter(row => row.created_by === meta.fixture.id && row.amount_kurus === 25000).length, 1)
    pass('validation and lost-response retry retain payload/key across auth checks; one 250 TL collection leaves 150 TL')
    await fit('history')
    await page.goto(meta.origin + '/#/musteriler/' + customer.id); await title(customer.name).waitFor()
    await page.locator('.finance-debt-total').filter({ hasText: '150,00' }).waitFor()
    await page.getByText('Tahsilat ve finansal hareket geçmişi', { exact: true }).waitFor()
    await page.locator('.finance-ledger').getByText('150,00\u00a0₺', { exact: true }).first().waitFor()
    await fit('customer')
    const second = await otherSale(1)
    await page.reload(); await page.locator('.finance-debt-total').filter({ hasText: '400,00' }).waitFor()
    await page.goto(meta.origin + '/#/veresiye'); await page.locator('.finance-customer-name').waitFor()
    await page.getByRole('searchbox', { name: 'Borçlu müşteri adı', exact: true }).fill(customer.name)
    const search = page.waitForResponse(response => new URL(response.url()).searchParams.get('q') === customer.name)
    await page.getByRole('button', { name: 'Ara', exact: true }).click(); assert.equal((await search).status(), 200)
    await page.locator('.finance-customer-name').waitFor(); assert.equal(await page.locator('.finance-customer-name').count(), 1)
    await fit('credit')
    pass('customer account/ledger and searchable debt list reflect multiple open sales and both actors')
    async function settle(target, amount, method) {
      await page.goto(meta.origin + `/#/tahsilatlar/yeni?customer_id=${customer.id}&sale_id=${target.id}`); await title('Yeni tahsilat').waitFor()
      await page.getByLabel(/^Alınan tutar/).fill(amount); await page.getByLabel(/^Tahsilat yöntemi/).selectOption(method)
      await submit().click(); await title('Tahsilatlar').waitFor()
    }
    await settle(sale, '150', 'cash'); await page.locator('.finance-debt-total').filter({ hasText: '250,00' }).waitFor()
    await settle(second, '250', 'bank'); await page.locator('.finance-debt-total').filter({ hasText: '0,00' }).waitFor()
    await page.getByRole('heading', { name: 'Açık borç yok', exact: true }).waitFor()
    await page.goto(meta.origin + '/#/satislar/' + sale.id); await title('Satış detayı').waitFor()
    assert.equal(await page.locator('.sale-totals dd').last().innerText(), '0,00\u00a0₺'); assert.equal(await page.locator('.sale-payment-list li').count(), 3)
    await page.goto(meta.origin + '/#/veresiye'); await page.getByRole('heading', { name: 'Borçlu müşteri yok', exact: true }).waitFor()
    await page.goto(meta.origin + '/#/tahsilatlar'); await page.locator('.finance-history li').first().waitFor()
    await page.getByLabel('Ödeme yöntemi filtresi', { exact: true }).selectOption('bank')
    await page.getByRole('status').filter({ hasText: '1 kayıt' }).waitFor()
    assert.equal(await page.locator('.finance-history li').count(), 1)
    pass('cash/card/bank stay distinct; full settlement updates sale and removes zero-debt customer')
    failRead = '/api/v1/receivables'; await page.goto(meta.origin + '/#/veresiye'); await page.reload()
    await page.getByRole('heading', { name: 'Veresiye listesi yüklenemedi', exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Borçlu müşteri yok', exact: true }).count(), 0)
    failRead = ''; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await page.getByRole('heading', { name: 'Borçlu müşteri yok', exact: true }).waitFor()
    failRead = '/api/v1/payments'; await page.goto(meta.origin + '/#/tahsilatlar'); await page.reload()
    await page.getByRole('heading', { name: 'Tahsilatlar yüklenemedi', exact: true }).waitFor(); assert.equal(await page.locator('.finance-history li').count(), 0)
    failRead = ''; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await page.locator('.finance-history li').first().waitFor()
    const health = await context.request.get(meta.origin + '/api/health', { headers: { 'X-Test-Key': meta.key } }); assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' })
    assert.deepEqual(errors, [])
    pass('actual API faults never become fake/empty success; health intact; no browser errors; 320/390/1440px fit')
    return { passed, screenshots, scope: 'Only isolated temporary D1 fixtures; real React/Vite proxy/Worker API. No production or real-user data.' }
  } catch (error) {
    await page.screenshot({ path: join(meta.temporary, 'finance-failure.png'), fullPage: true })
    console.error({ headings: await page.locator('h1').allTextContents(), alerts: await page.getByRole('alert').allTextContents() }); throw error
  } finally { await context.close() }
}
