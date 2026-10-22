import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifyReports(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  const passed = [], screenshots = [], errors = []
  let failSummary = false, failReport = false, employeeReportRequests = 0
  page.on('pageerror', error => errors.push(error.message))
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  const heading = name => page.getByRole('heading', { name, level: 1, exact: true })
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    const headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/v1/reports/employees') employeeReportRequests++
    if ((failSummary && url.pathname === '/api/v1/reports/summary') || (failReport && url.pathname === '/api/v1/reports/payments')) headers['X-Test-Mode'] = 'finance-db-error'
    return route.continue({ headers })
  })
  async function fit(label) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.locator('#main-content').focus(); await page.evaluate(() => window.scrollTo(0, 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: ${width}px overflow`)
      const path = join(meta.temporary, `reports-${label}-${width}.png`); await page.screenshot({ path, fullPage: true }); screenshots.push(path)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  const metric = name => page.locator(`[data-metric="${name}"]`)
  const apply = async () => { await page.getByRole('button', { name: 'Raporu Getir', exact: true }).click() }
  try {
    await page.goto(meta.origin + '/#/raporlar'); await heading('Giriş yapın').waitFor()
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click(); await heading('Tahsilat Raporu').waitFor()
    await page.getByRole('heading', { name: 'Rapor kaydı bulunamadı', exact: true }).waitFor()
    await metric('payments_total').filter({ hasText: '0,00' }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Çalışan Raporu', exact: true }).count(), 0)
    await page.goto(meta.origin + '/#/raporlar/calisanlar'); await page.getByRole('heading', { name: 'Yönetici yetkisi gerekli', exact: true }).waitFor()
    assert.equal(employeeReportRequests, 0)
    await page.goto(meta.origin + '/#/raporlar/satislar?created_by=' + meta.fixture.id)
    await page.getByRole('heading', { name: 'Yönetici yetkisi gerekli', exact: true }).waitFor()
    await page.goto(meta.origin + '/#/genel-bakis'); await metric('today_sales').filter({ hasText: '0,00' }).waitFor()
    pass('protected reports; real zero dashboard; employee management route blocked without API request')
    const authResponse = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } }), auth = await authResponse.json()
    async function post(path, data, method = 'POST') {
      const response = await context.request.fetch(meta.origin + path, { method, headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), method === 'PATCH' ? 200 : 201); return (await response.json()).data
    }
    const customer = await post('/api/v1/customers', { name: 'Rapor müşterisi ' + randomUUID(), address: 'Yalnızca izole test adresi' })
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    const product = await post('/api/v1/products', { name: 'Rapor snapshot ürünü', current_price_kurus: 50000 })
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    const initial = await post('/api/v1/sales', { customer_id: customer.id, items: [{ product_id: product.id, quantity: 1 }], payment: { amount_kurus: 10000, method: 'cash' } })
    const summary = await (await context.request.get(meta.origin + '/api/v1/reports/summary', { headers: { 'X-Test-Key': meta.key } })).json()
    const old = new Date(Date.parse(summary.range.from) - 3600000).toISOString()
    await sql('UPDATE sales SET created_at=?,updated_at=? WHERE id=?', [old, old, initial.id]); await sql('UPDATE payments SET created_at=? WHERE sale_id=?', [old, initial.id])
    const other = { id: randomUUID(), username: 'collector_' + randomUUID().slice(0, 8) }
    await sql("INSERT INTO users(id,username,password_hash,role,is_active,created_at,updated_at) SELECT ?,?,password_hash,'employee',1,created_at,updated_at FROM users WHERE id=?", [other.id, other.username, meta.fixture.id])
    const login = await fetch(meta.api + '/api/v1/auth/login', { method: 'POST', headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: other.username, password: meta.fixture.password }) })
    assert.equal(login.status, 200); const otherAuth = await login.json(), cookie = login.headers.get('set-cookie').split(';')[0]
    const collection = await fetch(meta.api + '/api/v1/payments', { method: 'POST', headers: { 'X-Test-Key': meta.key, Cookie: cookie, Origin: meta.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': otherAuth.csrfToken, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ customer_id: customer.id, sale_id: initial.id, amount_kurus: 25000, method: 'card' }) })
    assert.equal(collection.status, 201)
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    await post('/api/v1/products/' + product.id, { current_price_kurus: 20000 }, 'PATCH')
    await post('/api/v1/sales', { customer_id: customer.id, items: [{ product_id: product.id, quantity: 1 }], payment: { amount_kurus: 20000, method: 'bank' } })
    const cancelled = await post('/api/v1/sales', { customer_id: customer.id, items: [{ product_id: product.id, quantity: 1 }], payment: { amount_kurus: 0, method: null } })
    const cancelledResponse = await context.request.post(meta.origin + '/api/v1/sales/' + cancelled.id + '/cancel', { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data: { reason: 'İzole rapor iptali' } }); assert.equal(cancelledResponse.status(), 200)
    await page.reload(); await metric('today_sales').filter({ hasText: '200,00' }).waitFor()
    assert.match(await metric('today_payments').textContent(), /450,00/); assert.match(await metric('today_cash').textContent(), /0,00/)
    assert.match(await metric('current_debt').textContent(), /150,00/); assert.equal(await metric('today_count').textContent(), '1')
    await page.getByRole('table', { name: 'Bugünkü son işlemler' }).getByText(other.username, { exact: true }).waitFor()
    await fit('dashboard')
    pass('dashboard separates 200 TL sales, 450 TL collections and all-date 150 TL debt; recent actor/type/time real')
    await page.goto(meta.origin + '/#/raporlar/tahsilatlar'); await metric('payments_total').filter({ hasText: '450,00' }).waitFor()
    assert.match(await metric('cash').textContent(), /0,00/); assert.match(await metric('card').textContent(), /250,00/); assert.match(await metric('bank').textContent(), /200,00/)
    await page.getByText(/fiziksel kasa bakiyesi değildir/).waitFor(); await fit('payments')
    await page.getByLabel('Rapor dönemi', { exact: true }).selectOption('yesterday'); await apply()
    await metric('payments_total').filter({ hasText: '100,00' }).waitFor()
    await page.getByLabel('Rapor dönemi', { exact: true }).selectOption('custom')
    await page.getByLabel(/^Başlangıç tarihi/).fill(summary.range.start_date); await page.getByLabel(/^Bitiş tarihi/).fill(summary.range.end_date); await apply()
    await metric('payments_total').filter({ hasText: '450,00' }).waitFor()
    pass('cash/card/bank split, server yesterday/custom date filters and cash terminology')
    await page.goto(meta.origin + '/#/raporlar/satislar'); await metric('sales_total').filter({ hasText: '200,00' }).waitFor()
    await post('/api/v1/products/' + product.id, { name: 'Sonradan değişen ürün', current_price_kurus: 999 }, 'PATCH')
    await page.getByLabel('Satış raporu görünümü', { exact: true }).selectOption('products'); await apply()
    await page.getByRole('table', { name: 'Ürün bazlı satışlar' }).getByText('Rapor snapshot ürünü', { exact: true }).waitFor()
    await page.getByRole('table', { name: 'Ürün bazlı satışlar' }).getByText(/200,00/).first().waitFor()
    await fit('products')
    await page.getByLabel('Satış raporu görünümü', { exact: true }).selectOption('cancelled'); await apply()
    await page.getByRole('table', { name: 'İptal edilen satışlar' }).getByText('İptal edildi', { exact: true }).waitFor()
    pass('cancelled sales separate; product report keeps historical price/name after catalog edit')
    await page.goto(meta.origin + '/#/raporlar/borclar'); await metric('open_debt').filter({ hasText: '150,00' }).waitFor()
    await page.getByRole('table', { name: 'Müşteri bazlı açık borçlar' }).getByText(/500,00/).waitFor()
    await page.getByRole('table', { name: 'Müşteri bazlı açık borçlar' }).getByText(/350,00/).waitFor()
    await fit('debt')
    await page.goto(meta.origin + '/#/raporlar/calisanlar'); await page.getByRole('table', { name: 'Çalışan bazlı satış ve tahsilat' }).getByText(other.username, { exact: true }).waitFor()
    const collectorRow = page.locator('.report-table tbody tr').filter({ hasText: other.username })
    await collectorRow.getByRole('link', { name: 'Tahsilat hareketleri', exact: true }).click()
    await metric('payments_total').filter({ hasText: '250,00' }).waitFor()
    assert.equal(await page.locator('.report-table tbody tr').count(), 1)
    await page.goto(meta.origin + '/#/raporlar/calisanlar'); await page.getByRole('table', { name: 'Çalışan bazlı satış ve tahsilat' }).waitFor(); await fit('employees')
    pass('current debt report matches open sales; admin collector report and drilldown attribute actual employee')
    await page.goto(meta.origin + '/#/raporlar/tahsilatlar'); await metric('payments_total').waitFor()
    await page.getByRole('searchbox', { name: 'Müşteri adı ara', exact: true }).fill('Eşleşmeyen müşteri'); await apply()
    await page.getByRole('heading', { name: 'Rapor kaydı bulunamadı', exact: true }).waitFor()
    assert.match(await metric('payments_total').textContent(), /450,00/)
    failReport = true; await page.reload(); await page.getByRole('heading', { name: 'Tahsilat raporu yüklenemedi', exact: true }).waitFor(); assert.equal(await metric('payments_total').count(), 0)
    failReport = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await metric('payments_total').waitFor()
    failSummary = true; await page.goto(meta.origin + '/#/genel-bakis'); await page.getByRole('heading', { name: 'İşletme özeti yüklenemedi', exact: true }).waitFor(); assert.equal(await metric('today_sales').count(), 0)
    failSummary = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await metric('today_sales').filter({ hasText: '200,00' }).waitFor()
    await page.getByRole('button', { name: 'Bağlantıyı kontrol et', exact: true }).click(); await page.getByText('API ve veritabanı bağlantısı doğrulandı.', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    pass('search scope explicit; real 500 stays error without fabricated zero; retry, health and 320/390/1440px no overflow')
    return { passed, screenshots, scope: 'Real React/proxy/API; independent temporary D1; no production data or physical cash balance.' }
  } catch (error) {
    await page.screenshot({ path: join(meta.temporary, 'reports-failure.png'), fullPage: true })
    console.error({ headings: await page.locator('h1').allTextContents(), alerts: await page.getByRole('alert').allTextContents() }); throw error
  } finally { await context.close() }
}
