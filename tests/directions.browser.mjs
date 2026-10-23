import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function verifyDirections(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8')), passed = [], errors = [], external = []
  const browser = browserPage.context().browser()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  let mobile
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  async function guard(ctx) {
    // Intercept the external navigation locally: no customer/test address reaches Google.
    await ctx.route('https://www.google.com/maps/dir/**', route => {
      external.push({ url: route.request().url(), referer: route.request().headers().referer })
      return route.fulfill({ status: 200, contentType: 'text/plain', body: 'External navigation intercepted by isolated test.' })
    })
    await ctx.route('**/api/**', route => {
      if (new URL(route.request().url()).origin !== meta.origin) return route.continue()
      return route.continue({ headers: { ...route.request().headers(), 'X-Test-Key': meta.key } })
    })
    ctx.on('page', page => { page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message)) })
  }
  const sql = async (sql, params) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) })
    assert.equal(response.status, 200)
  }
  const link = page => page.getByRole('link', { name: /^Yol Tarifi Al/ })
  const customerPath = id => meta.origin + '/#/musteriler/' + id
  const salePath = id => meta.origin + '/#/satislar/' + id
  try {
    await guard(context)
    const page = await context.newPage()
    await page.goto(meta.origin + '/#/musteriler')
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username)
    await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await page.getByRole('heading', { name: 'Henüz müşteri yok', exact: true }).waitFor()
    const auth = await (await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })).json()
    const post = async (path, data) => {
      const response = await context.request.post(meta.origin + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), 201); return (await response.json()).data
    }
    const address = 'İzole Çığ Şükrü Öztürk Sok. No: 19/2\nA&B #5 + % ? İstanbul <img src=x onerror="window.__akcatMapsXss=1">'
    const customer = await post('/api/v1/customers', { name: 'İzole yol tarifi ' + randomUUID(), address })
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    const product = await post('/api/v1/products', { name: 'İzole yol tarifi ürünü', current_price_kurus: 1000 })
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    const sale = await post('/api/v1/sales', { customer_id: customer.id, items: [{ product_id: product.id, quantity: 1 }], payment: { amount_kurus: 0, method: null } })
    await page.goto(customerPath(customer.id)); await link(page).waitFor()
    const href = await link(page).getAttribute('href'), url = new URL(href)
    assert.equal(url.origin, 'https://www.google.com'); assert.equal(url.pathname, '/maps/dir/')
    assert.deepEqual(Object.fromEntries(url.searchParams), { api: '1', destination: address, travelmode: 'driving', dir_action: 'navigate' })
    assert.equal(await link(page).locator('svg').count(), 1)
    assert.equal(await page.locator('img[onerror]').count(), 0)
    assert.equal(await page.evaluate(() => window.__akcatMapsXss), undefined)
    assert.equal(external.length, 0)
    pass('customer detail uses the saved address, safely encodes Turkish/reserved characters and makes no automatic Google request')

    assert.equal(await link(page).getAttribute('target'), '_blank')
    assert.equal(await link(page).getAttribute('rel'), 'noopener noreferrer')
    assert.equal(await link(page).getAttribute('referrerpolicy'), 'no-referrer')
    const popupPromise = context.waitForEvent('page')
    await link(page).focus(); await page.keyboard.press('Enter')
    const popup = await popupPromise
    await popup.waitForURL('https://www.google.com/maps/dir/**')
    assert.equal(await popup.evaluate(() => window.opener === null), true)
    assert.equal(page.url(), customerPath(customer.id))
    assert.equal(external.length, 1); assert.equal(external[0].url, href); assert.equal(external[0].referer, undefined)
    await popup.close()
    pass('desktop keyboard activation opens one separate Google Maps tab with no opener or referrer')

    await page.goto(salePath(sale.id)); await link(page).waitFor()
    assert.equal(await link(page).getAttribute('href'), href)
    assert.ok((await page.locator('.sale-details').textContent()).includes(address))
    const salePopupPromise = context.waitForEvent('page'); await link(page).click()
    const salePopup = await salePopupPromise; await salePopup.waitForURL('https://www.google.com/maps/dir/**'); await salePopup.close()
    await page.goto(meta.origin + '/#/satislar'); await page.locator('.sale-table tbody tr').waitFor()
    assert.equal(await link(page).count(), 0)
    pass('sale detail opens the same destination through the shared component; no directions controls clutter the sale list')

    mobile = await browser.newContext({ viewport: { width: 390, height: 950 }, isMobile: true, hasTouch: true, storageState: await context.storageState() })
    await guard(mobile)
    const mobilePage = await mobile.newPage()
    for (const path of [customerPath(customer.id), salePath(sale.id)]) {
      await mobilePage.goto(path); await link(mobilePage).waitFor()
      assert.equal(await link(mobilePage).getAttribute('target'), null)
      for (const width of [320, 390]) {
        await mobilePage.setViewportSize({ width, height: 950 })
        assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        const bounds = await link(mobilePage).boundingBox()
        assert.ok(bounds.height >= 44 && bounds.width >= 44)
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
      }
      await link(mobilePage).click(); await mobilePage.waitForURL('https://www.google.com/maps/dir/**')
      assert.equal(mobile.pages().length, 1)
      assert.equal(external.at(-1).url, href); assert.equal(external.at(-1).referer, undefined)
    }
    pass('touch/mobile customer and sale actions navigate in the same tab using the universal URL; 320/390px targets fit and reach 44px')

    await sql('UPDATE customers SET address=? WHERE id=?', ['', customer.id])
    for (const path of [customerPath(customer.id), salePath(sale.id)]) {
      await page.goto(path); await page.getByText('Belirtilmedi', { exact: true }).last().waitFor()
      assert.equal(await link(page).count(), 0)
    }
    await sql('UPDATE customers SET address=? WHERE id=?', ['Ş'.repeat(1000), customer.id])
    await page.goto(customerPath(customer.id)); await page.getByText('Adres yol tarifi bağlantısı için çok uzun.', { exact: true }).waitFor()
    assert.equal(await link(page).count(), 0)
    assert.deepEqual(errors, [])
    pass('missing/oversized legacy addresses render safely without a broken link; no browser script errors')
    return { passed, scope: 'Real React/proxy/API on isolated temporary D1. Google navigation requests intercepted locally; native installed-app handoff not tested.' }
  } finally { await mobile?.close(); await context.close() }
}
