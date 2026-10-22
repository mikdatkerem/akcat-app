import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function verifyAudit(page, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8')), passed = [], errors = [], calls = { sale: [], payment: [] }
  let lose = ''
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message))
  const sql = async (sql, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.origin !== meta.origin) return route.continue()
    const kind = url.pathname === '/api/v1/sales' ? 'sale' : url.pathname === '/api/v1/payments' ? 'payment' : ''
    if (kind && request.method() === 'POST') {
      calls[kind].push(headers['idempotency-key'])
      if (lose === kind) { lose = ''; const actual = await route.fetch({ headers }); assert.equal(actual.status(), 201); await actual.dispose(); return route.abort('failed') }
    }
    return route.continue({ headers })
  })
  async function fit(label) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': ' + width)
      if (await page.locator('#main-content').count()) {
        assert.equal(await page.locator('.desktop-sidebar').isVisible(), width >= 1024)
        if (width < 1024) {
          const trigger = page.getByRole('button', { name: 'Menüyü aç', exact: true }), drawer = page.getByRole('dialog', { name: 'Ana menü', exact: true })
          await trigger.click(); await drawer.waitFor()
          await drawer.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))) })
          assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden')
          const bounds = await drawer.boundingBox(); assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, JSON.stringify({ width, bounds }))
          await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('#mobile-drawer')), true)
          await page.keyboard.press('Tab'); await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' })
          assert.equal(await trigger.evaluate(node => node === document.activeElement), true)
          assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), 'hidden')
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  await page.goto(meta.origin + '/#/yeni-satis'); await page.getByRole('heading', { name: 'Giriş yapın', exact: true }).waitFor(); await fit('login')
  await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click(); await page.getByRole('heading', { name: 'Yeni Satış', exact: true }).waitFor()
  const auth = await (await page.context().request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })).json()
  const post = async (path, data) => {
    const response = await page.context().request.post(meta.origin + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
    assert.equal(response.status(), 201); return (await response.json()).data
  }
  const customer = await post('/api/v1/customers', { name: 'Denetim <img src=x onerror="window.__akcatXss=1">', address: 'Yalnızca izole test adresi' })
  await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
  const product = await post('/api/v1/products', { name: 'Denetim ürünü', current_price_kurus: 50000 })
  await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
  async function selectSale() {
    await page.getByRole('searchbox', { name: 'Müşteri ara', exact: true }).fill(customer.name)
    await page.getByRole('search', { name: 'Müşteri ara', exact: true }).getByRole('button', { name: 'Ara', exact: true }).click()
    await page.getByRole('button', { name: customer.name + ' seç', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Aktif ürün ara', exact: true }).fill(product.name)
    await page.getByRole('search', { name: 'Aktif ürün ara', exact: true }).getByRole('button', { name: 'Ara', exact: true }).click()
    await page.getByRole('button', { name: product.name + ' seç', exact: true }).click()
  }
  await selectSale(); lose = 'sale'; await page.getByRole('button', { name: 'Satışı Kaydet', exact: true }).click()
  await page.getByRole('heading', { name: 'Satış kaydı doğrulanamadı', exact: true }).waitFor(); await page.reload()
  await page.getByRole('heading', { name: 'Önceki işlemin sonucunu kontrol edin', exact: true }).waitFor()
  assert.equal(calls.sale.length, 1)
  const stored = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  assert.equal(Object.keys(stored).length, 1); assert.ok(Object.values(stored).every(value => /^[a-f0-9-]{36}$/i.test(value)))
  assert.equal(JSON.stringify(stored).includes(customer.name), false)
  await selectSale(); await page.getByRole('button', { name: 'Satışı Kaydet', exact: true }).click()
  await page.getByRole('heading', { name: 'Satış detayı', exact: true }).waitFor()
  assert.equal(calls.sale.length, 2); assert.equal(calls.sale[0], calls.sale[1])
  const sales = await sql('SELECT id FROM sales WHERE customer_id=?', [customer.id]); assert.equal(sales.length, 1); const sale = sales[0]
  assert.equal(await page.evaluate(() => sessionStorage.length), 0)
  assert.equal(await page.evaluate(() => window.__akcatXss), undefined); assert.equal(await page.locator('img[onerror]').count(), 0)
  pass('committed sale response lost then full reload: opaque key survives, exact retry returns one sale; customer HTML remains text')
  const paymentPath = meta.origin + '/#/tahsilatlar/yeni?customer_id=' + customer.id + '&sale_id=' + sale.id
  const paymentSubmit = () => page.getByRole('button', { name: 'Tahsilatı Kaydet', exact: true })
  async function paymentFields(value) { await page.getByLabel(/^Alınan tutar/).fill(value); await page.getByLabel(/^Tahsilat yöntemi/).selectOption('cash') }
  await page.goto(paymentPath); await paymentFields('100'); lose = 'payment'; await paymentSubmit().click()
  await page.getByRole('heading', { name: 'Tahsilat kaydı doğrulanamadı', exact: true }).waitFor(); await page.reload()
  await page.getByRole('heading', { name: 'Önceki işlemin sonucunu kontrol edin', exact: true }).waitFor(); assert.equal(calls.payment.length, 1)
  await fit('payment recovery'); await paymentFields('100'); await paymentSubmit().click()
  await page.getByRole('status').filter({ hasText: 'Tahsilat kaydedildi:' }).waitFor()
  assert.equal(calls.payment[0], calls.payment[1]); assert.equal((await sql('SELECT count(*) AS n FROM payments WHERE sale_id=?', [sale.id]))[0].n, 1)
  await page.locator('.finance-debt-total').filter({ hasText: '400,00' }).waitFor()
  pass('partial collection response lost then reload: same key replays once and debt stays 400 TL')
  await page.goto(paymentPath); await paymentFields('50'); lose = 'payment'; await paymentSubmit().click()
  await page.getByRole('heading', { name: 'Tahsilat kaydı doğrulanamadı', exact: true }).waitFor(); await page.reload()
  await page.getByRole('heading', { name: 'Önceki işlemin sonucunu kontrol edin', exact: true }).waitFor()
  await paymentFields('60'); await paymentSubmit().click()
  await page.getByRole('heading', { name: 'Tahsilat kaydı doğrulanamadı', exact: true }).waitFor()
  assert.equal(calls.payment[2], calls.payment[3]); assert.equal((await sql('SELECT count(*) AS n FROM payments WHERE sale_id=?', [sale.id]))[0].n, 2)
  const startNew = page.getByRole('button', { name: 'Ayrı yeni işlem başlat', exact: true }); assert.equal(await startNew.isDisabled(), true)
  await page.getByLabel('Önceki işlemi geçmişten kontrol ettim.', { exact: true }).check(); await startNew.click()
  await page.getByRole('heading', { name: 'Tahsilatlar', exact: true }).waitFor(); assert.equal(await page.evaluate(() => sessionStorage.length), 0)
  pass('changed payload after reload is rejected under original key; separate new intent requires explicit history review')
  await page.goto(meta.origin + '/#/yeni-satis'); await selectSale()
  await page.evaluate(() => { const original = Storage.prototype.setItem; window.__restoreStorage = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') } })
  const before = calls.sale.length; await page.getByRole('button', { name: 'Satışı Kaydet', exact: true }).click()
  await page.getByRole('heading', { name: 'Satış kaydı doğrulanamadı', exact: true }).waitFor(); assert.equal(calls.sale.length, before)
  await fit('storage error'); await page.evaluate(() => window.__restoreStorage())
  pass('unavailable browser storage fails closed before transmitting a financial write')
  const payments = await sql('SELECT id FROM payments WHERE sale_id=? ORDER BY created_at', [sale.id])
  const correction = await post('/api/v1/correction-requests', { target_type: 'payment', target_id: payments[0].id, correction_type: 'payment_refund', reason: 'Denetim önizlemesi', requested_change: 'Tam iade incelemesi' })
  await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id]); await page.goto(meta.origin + '/#/duzeltmeler/' + correction.id); await page.reload()
  await page.getByRole('button', { name: 'Finansal Düzeltmeyi İncele', exact: true }).click()
  await fit('financial approval'); assert.equal(await page.getByLabel(/^Harici iade referansı/).isVisible(), true)
  assert.deepEqual(errors, [])
  pass('320/390/768/1024/1440px forms, errors, amounts and refund confirmation fit; modal drawer focus/Escape/scroll lock work')
  return { passed, scope: 'Independent temporary D1; actual React/proxy/API, no production, bank/POS or real data.' }
}
