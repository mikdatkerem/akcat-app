import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifyCorrections(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  const passed = [], screenshots = [], errors = [], keys = []
  let loseResponse = false, failList = false
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
    if (url.pathname === '/api/v1/correction-requests' && request.method() === 'POST') {
      keys.push(headers['idempotency-key'])
      if (loseResponse) {
        loseResponse = false; const actual = await route.fetch({ headers }); assert.equal(actual.status(), 201); await actual.dispose()
        return route.abort('failed')
      }
    }
    if (failList && url.pathname === '/api/v1/correction-requests' && request.method() === 'GET') headers['X-Test-Mode'] = 'finance-db-error'
    return route.continue({ headers })
  })
  async function fit(label) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.locator('#main-content').focus(); await page.evaluate(() => window.scrollTo(0, 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: ${width}px overflow`)
      const path = join(meta.temporary, `corrections-${label}-${width}.png`); await page.screenshot({ path, fullPage: true }); screenshots.push(path)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  try {
    await page.goto(meta.origin + '/#/duzeltmeler'); await heading('Giriş yapın').waitFor()
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await page.getByRole('heading', { name: 'Düzeltme talebi bulunamadı', exact: true }).waitFor()
    pass('protected correction screen and genuine empty list')
    const authResponse = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } }), auth = await authResponse.json()
    async function post(path, data, expected = 201) {
      const response = await context.request.post(meta.origin + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), expected); return (await response.json()).data
    }
    const customer = await post('/api/v1/customers', { name: 'İptal müşterisi ' + randomUUID(), address: 'Yalnızca izole test adresi' })
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    const product = await post('/api/v1/products', { name: 'İptal test ürünü', current_price_kurus: 1999 })
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    const saleInput = { customer_id: customer.id, items: [{ product_id: product.id, quantity: 1 }], payment: { amount_kurus: 0, method: null } }
    const sale = await post('/api/v1/sales', saleInput)
    await page.goto(meta.origin + '/#/satislar/' + sale.id); await page.getByRole('button', { name: 'Satışı İptal Et', exact: true }).waitFor()
    await fit('sale')
    await page.getByRole('button', { name: 'Satışı İptal Et', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Satışı iptal et', exact: true })
    await dialog.waitFor(); assert.equal(await dialog.getByLabel(/^Gerekçe/).evaluate(node => node === document.activeElement), true)
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Satışı İptal Et', exact: true }).click()
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    await dialog.getByRole('button', { name: 'İptali Onayla', exact: true }).click()
    assert.equal((await sql("SELECT status FROM sales WHERE id=?", [sale.id]))[0].status, 'completed')
    await dialog.getByLabel(/^Gerekçe/).fill('Yanlışlıkla kaydedildi')
    await dialog.getByRole('button', { name: 'İptali Onayla', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
    await page.getByText('Yanlışlıkla kaydedildi', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Satışı İptal Et', exact: true }).count(), 0)
    assert.equal(await page.getByRole('link', { name: 'Bu satışa tahsilat al', exact: true }).count(), 0)
    await page.goto(meta.origin + '/#/musteriler/' + customer.id); await page.locator('.finance-debt-total').filter({ hasText: '0,00' }).waitFor()
    await page.getByLabel('Hareket türü', { exact: true }).selectOption('cancellation')
    await page.locator('.finance-ledger').getByText(/Satış iptali/).waitFor()
    pass('real cancellation, reason validation, modal keyboard/width checks, zero debt and preserved cancellation ledger')
    const old = await post('/api/v1/sales', saleInput)
    await sql('UPDATE sales SET created_at=? WHERE id=?', ['2020-01-01T00:00:00.000Z', old.id])
    await page.goto(meta.origin + '/#/satislar/' + old.id); await heading('Satış detayı').waitFor()
    await page.getByText(/Çalışan yalnızca kendi ödemesiz satışını/).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Satışı İptal Et', exact: true }).count(), 0)
    await page.getByRole('link', { name: 'Düzeltme Talebi Oluştur', exact: true }).click(); await heading('Yeni düzeltme talebi').waitFor()
    await page.getByLabel(/^Talep gerekçesi/).fill('Süreyi aşan hatalı kayıt'); await page.getByLabel(/^İstenen değişiklik/).fill('Satış iptal edilsin')
    await fit('request-form')
    loseResponse = true; await page.getByRole('button', { name: 'Talep Oluştur', exact: true }).click()
    await page.getByRole('heading', { name: 'Talep kaydı doğrulanamadı', exact: true }).waitFor()
    await page.evaluate(async () => { const session = await import('/src/auth/sessionStore.ts'); await session.checkSession() })
    await heading('Yeni düzeltme talebi').waitFor()
    assert.equal(await page.getByLabel(/^Talep gerekçesi/).inputValue(), 'Süreyi aşan hatalı kayıt')
    assert.equal(await page.getByLabel(/^Talep gerekçesi/).isDisabled(), true)
    await page.getByRole('button', { name: 'Aynı talebi tekrar dene', exact: true }).click(); await heading('Düzeltme talebi').waitFor()
    await page.getByText('Düzeltme talebi kaydedildi. Yönetici incelemesi bekleniyor.', { exact: true }).waitFor()
    assert.equal(keys.length, 2); assert.equal(keys[0], keys[1])
    assert.equal((await sql('SELECT count(*) AS n FROM correction_requests WHERE target_id=?', [old.id]))[0].n, 1)
    assert.equal(await page.getByRole('button', { name: 'İptali İncele ve Onayla', exact: true }).count(), 0)
    const requestHash = await page.evaluate(() => location.hash)
    pass('old sale requests approval; lost response retains payload/key across auth recheck with exactly one request')
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id]); await page.reload()
    await page.getByRole('button', { name: 'İptali İncele ve Onayla', exact: true }).click()
    await page.getByLabel(/^Gerekçe/).fill('Hatalı kayıt doğrulandı')
    await page.getByRole('button', { name: 'İptali Uygula ve Onayla', exact: true }).click()
    await page.getByText('Talep onaylandı ve satış iptal edildi.', { exact: true }).waitFor()
    assert.equal((await sql('SELECT status FROM sales WHERE id=?', [old.id]))[0].status, 'cancelled')
    await fit('approved-detail')
    await page.goto(meta.origin + '/#/satislar/' + old.id); await page.getByText('Hatalı kayıt doğrulandı', { exact: true }).waitFor()
    pass('admin approval applies real cancellation, status, reviewer and audit history')
    const paid = await post('/api/v1/sales', { ...saleInput, payment: { amount_kurus: 100, method: 'cash' } })
    await page.goto(meta.origin + '/#/tahsilatlar'); await heading('Tahsilatlar').waitFor()
    await page.getByRole('link', { name: 'Tahsilat için düzeltme talebi', exact: true }).first().click(); await heading('Yeni düzeltme talebi').waitFor()
    await page.getByLabel(/^Düzeltme türü/).selectOption('payment_method')
    await page.getByLabel(/^Talep gerekçesi/).fill('Ödeme yöntemi hatalı'); await page.getByLabel(/^İstenen değişiklik/).fill('Yöntem incelensin')
    await page.getByRole('button', { name: 'Talep Oluştur', exact: true }).click(); await heading('Düzeltme talebi').waitFor()
    await page.getByText(/Bu talep onaylanamaz/).waitFor()
    assert.equal(await page.getByRole('button', { name: 'İptali İncele ve Onayla', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Talebi Reddet', exact: true }).click(); await page.getByLabel(/^Gerekçe/).fill('Ters kayıt süreci henüz desteklenmiyor')
    await page.getByRole('button', { name: 'Reddi Kaydet', exact: true }).click(); await page.getByText('Talep reddedildi.', { exact: true }).waitFor()
    assert.equal((await sql('SELECT count(*) AS n FROM payments WHERE sale_id=?', [paid.id]))[0].n, 1)
    pass('unsupported payment request has no approve action; reasoned rejection preserves original payment')
    await page.goto(meta.origin + '/#/duzeltmeler'); await page.getByLabel('Talep durumu', { exact: true }).selectOption('all')
    await page.locator('.correction-list li').first().waitFor(); await fit('list')
    failList = true; await page.reload(); await page.getByRole('heading', { name: 'Talepler yüklenemedi', exact: true }).waitFor()
    assert.equal(await page.locator('.correction-list li').count(), 0)
    failList = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
    await page.getByRole('heading', { name: 'Düzeltme talebi bulunamadı', exact: true }).waitFor()
    await page.goto(meta.origin + '/' + requestHash); await heading('Düzeltme talebi').waitFor()
    assert.deepEqual(errors, [])
    pass('filter/list/error retry uses real API; 320/390/1440px no overflow and no JS errors')
    return { passed, screenshots, scope: 'Real React/proxy/Worker; temporary isolated D1 only. No real data or remote migration.' }
  } catch (error) {
    await page.screenshot({ path: join(meta.temporary, 'corrections-failure.png'), fullPage: true })
    console.error({ headings: await page.locator('h1').allTextContents(), alerts: await page.getByRole('alert').allTextContents() })
    throw error
  } finally { await context.close() }
}
