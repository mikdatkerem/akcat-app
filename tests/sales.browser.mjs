import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifySales(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  const passed = [], screenshots = [], errors = [], keys = [], payloads = []
  let loseResponse = false, failList = false, creates = 0
  page.on('pageerror', error => errors.push(error.message))
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  const title = name => page.getByRole('heading', { level: 1, name, exact: true })
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    const headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/v1/sales' && request.method() === 'POST') {
      creates++; keys.push(headers['idempotency-key']); payloads.push(request.postDataJSON())
      if (loseResponse) {
        loseResponse = false
        const actual = await route.fetch({ headers }); assert.equal(actual.status(), 201); await actual.dispose()
        return route.abort('failed') // Real committed sale; lost network response only.
      }
    }
    if (url.pathname === '/api/v1/sales' && request.method() === 'GET' && failList) headers['X-Test-Mode'] = 'sale-db-error'
    return route.continue({ headers })
  })
  async function fit(label) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      await page.locator('#main-content').focus()
      await page.evaluate(() => window.scrollTo(0, 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: ${width}px overflow`)
      const path = join(meta.temporary, `sales-${label}-${width}.png`)
      await page.screenshot({ path, fullPage: true }); screenshots.push(path)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  const save = () => page.getByRole('button', { name: 'Satışı Kaydet', exact: true })
  try {
    await page.goto(meta.origin + '/#/satislar')
    await title('Giriş yapın').waitFor(); assert.equal(await page.locator('.sale-table').count(), 0)
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username)
    await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await page.getByRole('heading', { name: 'Henüz satış yok', exact: true }).waitFor()
    pass('protected sales history and genuine empty list')
    const me = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })
    const auth = await me.json()
    async function post(path, data) {
      const response = await context.request.post(meta.origin + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin,
        'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), 201); return (await response.json()).data
    }
    const customer = await post('/api/v1/customers', { name: 'İzole müşteri ' + randomUUID(), address: 'Yalnızca geçici test adresi' })
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    const first = await post('/api/v1/products', { name: 'İzole ürün ' + randomUUID(), current_price_kurus: 25000 })
    const second = await post('/api/v1/products', { name: 'İkinci ürün ' + randomUUID(), current_price_kurus: 10000 })
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    await page.getByRole('link', { name: 'Yeni satış', exact: true }).click(); await title('Yeni Satış').waitFor()
    await save().click(); await page.getByText('Bir müşteri seçin.', { exact: true }).waitFor()
    assert.equal(creates, 0)
    await page.getByRole('searchbox', { name: 'Müşteri ara', exact: true }).fill(customer.name)
    const customerSearch = page.waitForResponse(response => new URL(response.url()).searchParams.get('q') === customer.name)
    await page.getByRole('search', { name: 'Müşteri ara', exact: true }).getByRole('button', { name: 'Ara', exact: true }).click()
    assert.equal((await customerSearch).status(), 200)
    await page.getByRole('button', { name: customer.name + ' seç', exact: true }).click()
    await page.getByRole('button', { name: first.name + ' seç', exact: true }).click()
    await page.getByLabel(first.name + ' miktarı').fill('1.5'); await save().click(); assert.equal(creates, 0)
    await page.getByLabel(first.name + ' miktarı').fill('2')
    await page.getByRole('button', { name: second.name + ' seç', exact: true }).click()
    await page.getByLabel(second.name + ' miktarı').fill('3')
    assert.equal(await page.locator('.sale-totals dd').first().innerText(), '800,00\u00a0₺')
    await page.getByRole('button', { name: second.name + ' satıştan kaldır', exact: true }).click()
    await page.getByText('Ödeme alınmadı. Satışın tamamı veresiye olarak kaydedilecek.', { exact: true }).waitFor()
    await page.getByLabel('Alınan ödeme (₺)', { exact: false }).fill('501'); await save().click()
    await page.getByText('Alınan ödeme satış toplamını aşamaz.', { exact: true }).waitFor(); assert.equal(creates, 0)
    await page.getByLabel('Alınan ödeme (₺)', { exact: false }).fill('100'); await save().click()
    await page.getByText('Ödeme yöntemini seçin.', { exact: true }).waitFor(); assert.equal(creates, 0)
    await page.getByLabel('Ödeme yöntemi', { exact: false }).selectOption('cash')
    await fit('form')
    pass('real customer search/products; quantity/add/remove/payment validation; 500/100/400 preview')
    loseResponse = true; await save().click()
    await page.getByRole('heading', { name: 'Satış kaydı doğrulanamadı', exact: true }).waitFor()
    assert.equal(await page.getByLabel('Alınan ödeme (₺)', { exact: false }).inputValue(), '100')
    assert.equal(await page.getByLabel('Alınan ödeme (₺)', { exact: false }).isDisabled(), true)
    await page.evaluate(async () => { const session = await import('/src/auth/sessionStore.ts'); await session.checkSession() })
    await title('Yeni Satış').waitFor()
    assert.equal(await page.getByLabel('Alınan ödeme (₺)', { exact: false }).inputValue(), '100')
    assert.equal(await page.getByLabel('Alınan ödeme (₺)', { exact: false }).isDisabled(), true)
    await page.goto(meta.origin + '/#/satislar'); await title('Satışlar').waitFor()
    await page.getByRole('link', { name: 'Yeni satış', exact: true }).click(); await title('Yeni Satış').waitFor()
    await page.getByRole('button', { name: 'Aynı satışı tekrar dene', exact: true }).click()
    await title('Satış detayı').waitFor()
    await page.getByText('Satış kaydedildi. Teslimat ve ödeme bilgileri aşağıdadır.', { exact: true }).waitFor()
    assert.equal(creates, 2); assert.ok(keys[0] && keys[0] === keys[1]); assert.deepEqual(payloads[0], payloads[1])
    const sales = await sql('SELECT id,total_kurus FROM sales WHERE customer_id=?', [customer.id]); assert.equal(sales.length, 1)
    assert.equal(sales[0].total_kurus, 50000)
    assert.equal(await page.locator('.sale-totals dd').last().innerText(), '400,00\u00a0₺')
    await page.getByText('İlk ödeme · Nakit', { exact: true }).waitFor()
    await fit('detail')
    pass('ambiguous failure retains original payload/key across auth recheck/navigation; retry creates one sale/payment/audit')
    await sql('UPDATE products SET current_price_kurus=30000 WHERE id=?', [first.id])
    await page.reload(); await title('Satış detayı').waitFor()
    await page.locator('.sale-snapshot-items').getByText('Satış fiyatı: 250,00\u00a0₺', { exact: true }).waitFor()
    assert.equal(await page.locator('.sale-totals dd').first().innerText(), '500,00\u00a0₺')
    pass('reload restores sale using snapshots after current catalog price changed')

    for (const amount of ['0', '300']) {
      await page.getByRole('link', { name: 'Yeni satış', exact: true }).click(); await title('Yeni Satış').waitFor()
      await page.getByRole('button', { name: customer.name + ' seç', exact: true }).click()
      await page.getByRole('button', { name: first.name + ' seç', exact: true }).click()
      await page.getByLabel('Alınan ödeme (₺)', { exact: false }).fill(amount)
      if (amount !== '0') await page.getByLabel('Ödeme yöntemi', { exact: false }).selectOption('bank')
      await save().click(); await title('Satış detayı').waitFor()
      await page.locator('.sale-record .ui-badge').filter({ hasText: amount === '0' ? 'Veresiye' : 'Ödendi' }).waitFor()
    }
    pass('employee completes credit and full bank-payment sales through UI')
    await page.getByRole('link', { name: 'Satış geçmişine dön', exact: true }).click(); await page.locator('.sale-detail-link').first().waitFor()
    await fit('history')
    await page.goto(meta.origin + '/#/satislar?pageSize=1'); await page.locator('.sale-detail-link').waitFor()
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click()
    await page.getByText('3 satış · Sayfa 2 / 3', { exact: true }).waitFor()
    await page.getByLabel('Başlangıç tarihi', { exact: true }).fill('2100-01-01')
    await page.getByRole('button', { name: 'Filtrele', exact: true }).click()
    await page.getByRole('heading', { name: 'Bu filtrelerde satış bulunamadı', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Filtreleri temizle', exact: true }).click(); await page.locator('.sale-detail-link').first().waitFor()
    await page.locator('.sale-history-filters summary').click()
    await page.getByRole('button', { name: customer.name + ' seç', exact: true }).click()
    await page.getByRole('button', { name: 'Filtrele', exact: true }).click(); await page.getByText('3 satış · Sayfa 1 / 1', { exact: true }).waitFor()
    pass('history pagination and date/customer filters use actual API results')
    failList = true; await page.reload()
    await page.getByRole('heading', { name: 'Satışlar yüklenemedi', exact: true }).waitFor()
    assert.equal(await page.locator('.sale-detail-link').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Henüz satış yok', exact: true }).count(), 0)
    failList = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await page.locator('.sale-detail-link').first().waitFor()
    await page.goto(meta.origin + '/#/satislar/' + randomUUID()); await page.getByText('Satış bulunamadı.', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    pass('500/404 errors show no fake data; no browser JS errors; 320/390/1440px fit')
    return { passed, screenshots, scope: 'Real React/proxy/Worker, only temporary isolated D1 fixtures. No real user or business data.' }
  } catch (error) {
    await page.screenshot({ path: join(meta.temporary, 'sales-failure.png'), fullPage: true })
    console.error({ headings: await page.locator('h1').allTextContents(), alerts: await page.getByRole('alert').allTextContents() })
    throw error
  } finally { await context.close() }
}
