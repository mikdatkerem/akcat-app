import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function verifyAdjustments(page, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8')), passed = [], errors = [], keys = []
  let loseResponse = false, failHistory = false
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message))
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.origin !== meta.origin) return route.continue()
    if (request.method() === 'POST' && url.pathname.endsWith('/approve')) {
      keys.push(headers['idempotency-key'])
      if (loseResponse) { loseResponse = false; const result = await route.fetch({ headers }); assert.equal(result.status(), 200); await result.dispose(); return route.abort('failed') }
    }
    if (failHistory && url.pathname === '/api/v1/financial-adjustments') headers['X-Test-Mode'] = 'finance-db-error'
    return route.continue({ headers })
  })
  await page.goto(meta.origin + '/#/duzeltmeler')
  await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
  await page.getByRole('heading', { name: 'Düzeltme talebi bulunamadı', exact: true }).waitFor()
  const auth = await (await page.context().request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })).json()
  const post = async (path, data, expected = 201) => {
    const result = await page.context().request.post(meta.origin + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
    assert.equal(result.status(), expected); return (await result.json()).data
  }
  const customer = await post('/api/v1/customers', { name: 'İzole iade müşterisi', address: 'Yalnızca test adresi' })
  await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
  const product = await post('/api/v1/products', { name: 'İzole iade ürünü', current_price_kurus: 1999 })
  await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
  const sale = await post('/api/v1/sales', { customer_id: customer.id, items: [{ product_id: product.id, expected_list_price_kurus: product.current_price_kurus, quantity: 1 }], payment: { amount_kurus: 1999, method: 'card' } })
  await page.goto(meta.origin + '/#/duzeltmeler/yeni?target_type=payment&target_id=' + sale.payments[0].id)
  await page.getByLabel(/^Düzeltme türü/).selectOption('payment_refund')
  await page.getByLabel(/^Talep gerekçesi/).fill('Fiilen yapılmış harici iade incelensin'); await page.getByLabel(/^İstenen değişiklik/).fill('Tam iade kaydı')
  await page.getByRole('button', { name: 'Talep Oluştur', exact: true }).click()
  await page.getByRole('region', { name: 'Finansal sonuç önizlemesi', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Finansal Düzeltmeyi İncele', exact: true }).count(), 0)
  assert.equal((await sql('SELECT count(*) AS n FROM financial_adjustments'))[0].n, 0)
  pass('employee creates real refund request, sees balances and has no approval action')
  const requestHash = await page.evaluate(() => location.hash)
  await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id]); await page.reload()
  await page.getByRole('button', { name: 'Finansal Düzeltmeyi İncele', exact: true }).click()
  await page.getByLabel(/^Onay gerekçesi/).fill('Harici tam iade belgesi incelendi')
  await page.getByRole('button', { name: 'Harici İadeyi Teyit Et ve Kaydet', exact: true }).click()
  assert.equal((await sql('SELECT count(*) AS n FROM financial_adjustments'))[0].n, 0)
  await page.getByLabel(/^Harici iade referansı/).fill('TEST-' + randomUUID())
  await page.getByLabel('Tam tutarın aynı ödeme yöntemiyle uygulama dışında müşteriye fiilen iade edildiğini doğruluyorum.', { exact: true }).check()
  loseResponse = true
  await page.getByRole('button', { name: 'Harici İadeyi Teyit Et ve Kaydet', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Sunucuya ulaşılamadı' }).waitFor()
  assert.equal(await page.getByLabel(/^Onay gerekçesi/).isDisabled(), true)
  assert.equal(await page.getByRole('status').filter({ hasText: 'Finansal düzeltme kaydedildi' }).count(), 0)
  await page.getByRole('button', { name: 'Aynı işlemi tekrar dene', exact: true }).click()
  await page.getByText('Finansal düzeltme kaydedildi; para transferi yapılmadı.', { exact: true }).waitFor()
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]); keys.length = 0
  const adjustment = (await sql('SELECT * FROM financial_adjustments'))[0]
  assert.equal(adjustment.kind, 'external_refund'); assert.equal(adjustment.amount_kurus, 1999)
  await page.getByRole('region', { name: 'Uygulanan finansal düzeltme', exact: true }).waitFor()
  pass('mandatory external confirmation; committed lost response retries exact key/payload once without false success')
  await page.goto(meta.origin + '/#/satislar/' + sale.id)
  await page.getByText('Ters kayıt ve harici iade geçmişi', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Talep ve onay detayı', exact: true }).waitFor()
  assert.equal((await sql('SELECT status FROM sales WHERE id=?', [sale.id]))[0].status, 'completed')
  await page.getByRole('link', { name: 'Düzeltme Talebi Oluştur', exact: true }).click()
  await page.getByLabel(/^Talep gerekçesi/).fill('İadesi tamamlanan satış iptali'); await page.getByLabel(/^İstenen değişiklik/).fill('Satış iptal edilsin')
  await page.getByRole('button', { name: 'Talep Oluştur', exact: true }).click()
  await page.getByRole('region', { name: 'Satış iptali finansal önizlemesi', exact: true }).waitFor()
  await page.getByRole('button', { name: 'İptali İncele ve Onayla', exact: true }).click()
  await page.getByLabel(/^Gerekçe/).fill('Bütün ödemeler teyitli iade ile kapatıldı')
  await page.getByRole('button', { name: 'İptali Uygula ve Onayla', exact: true }).click()
  await page.getByText('Talep onaylandı ve satış iptal edildi.', { exact: true }).waitFor()
  assert.equal((await sql('SELECT status FROM sales WHERE id=?', [sale.id]))[0].status, 'cancelled')
  await page.goto(meta.origin + '/#/musteriler/' + customer.id)
  await page.locator('.finance-debt-total').filter({ hasText: '0,00' }).waitFor()
  await page.getByLabel('Hareket türü', { exact: true }).selectOption('external_refund')
  await page.locator('.finance-ledger').getByText(/Harici para iadesi/).waitFor()
  pass('refund keeps active sale debt open; separate cancellation closes debt and preserves typed ledger')
  await page.goto(meta.origin + '/#/raporlar/tahsilatlar')
  await page.locator('[data-metric="refunds"]').filter({ hasText: '19,99' }).waitFor()
  await page.getByRole('link', { name: 'Talep ve onay detayı', exact: true }).waitFor()
  pass('real payment report separates refund amount and history from valid receipt totals')
  const mistaken = await post('/api/v1/sales', { customer_id: customer.id, items: [{ product_id: product.id, expected_list_price_kurus: product.current_price_kurus, quantity: 1 }], payment: { amount_kurus: 1000, method: 'cash' } })
  await page.goto(meta.origin + '/#/duzeltmeler/yeni?target_type=payment&target_id=' + mistaken.payments[0].id)
  await page.getByLabel(/^Düzeltme türü/).selectOption('payment_reversal')
  await page.getByLabel(/^Talep gerekçesi/).fill('Gerçekte alınmamış hatalı tahsilat'); await page.getByLabel(/^İstenen değişiklik/).fill('Tam muhasebesel geri alma')
  await page.getByRole('button', { name: 'Talep Oluştur', exact: true }).click()
  await page.getByRole('button', { name: 'Finansal Düzeltmeyi İncele', exact: true }).click()
  await page.getByLabel(/^Onay gerekçesi/).fill('Ödeme alınmadığı doğrulandı')
  assert.equal(await page.getByLabel(/^Harici iade referansı/).count(), 0)
  await page.getByRole('button', { name: 'Tam Ters Kaydı Uygula', exact: true }).click()
  await page.getByText('Finansal düzeltme kaydedildi; para transferi yapılmadı.', { exact: true }).waitFor()
  const reversed = (await sql('SELECT kind, external_reference, after_sale_remaining_kurus FROM financial_adjustments WHERE payment_id=?', [mistaken.payments[0].id]))[0]
  assert.equal(reversed.kind, 'record_reversal'); assert.equal(reversed.external_reference, null); assert.equal(reversed.after_sale_remaining_kurus, 1999)
  pass('accounting reversal uses a separate form path and opens full debt without a refund attestation')
  failHistory = true; await page.goto(meta.origin + '/#/satislar/' + sale.id)
  await page.getByRole('heading', { name: 'Düzeltme geçmişi yüklenemedi', exact: true }).waitFor()
  failHistory = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await page.getByRole('link', { name: 'Talep ve onay detayı', exact: true }).waitFor()
  await page.goto(meta.origin + '/' + requestHash); await page.getByRole('region', { name: 'Uygulanan finansal düzeltme', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  pass('API failure shows error, retry restores actual history; no JavaScript errors')
  return { passed, scope: 'Real React/proxy/Worker and isolated temporary D1; no actual bank/POS operation or real data.' }
}
