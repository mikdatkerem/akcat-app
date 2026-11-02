import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

// Run only through serve-auth.mjs: all writes belong to its temporary test D1.
export async function verifySaleDialog(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  assert.equal(new URL(meta.origin).hostname, '127.0.0.1')
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const passed = [], errors = [], submissions = []
  let loseResponse = false
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request(), headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (new URL(request.url()).pathname === '/api/v1/sales' && request.method() === 'POST') {
      submissions.push({ body: request.postDataJSON(), key: headers['idempotency-key'] })
      if (loseResponse) {
        loseResponse = false
        const response = await route.fetch({ headers })
        assert.equal(response.status(), 201)
        await response.dispose()
        return route.abort('failed')
      }
    }
    return route.continue({ headers })
  })
  const dialog = () => page.getByRole('dialog', { name: 'Yeni Satış', exact: true })
  const open = () => page.getByRole('button', { name: 'Yeni satış', exact: true }).click()
  const close = () => dialog().getByRole('button', { name: 'Satış penceresini kapat', exact: true }).click()
  async function chooseCustomer(customer) {
    const search = page.getByRole('search', { name: 'Müşteri ara…', exact: true })
    await search.getByRole('searchbox').fill(customer.name)
    await search.getByRole('button', { name: 'Ara', exact: true }).click()
    await page.getByRole('button', { name: customer.name + ' seç', exact: true }).click()
    await page.locator('.receivable-selected strong').filter({ hasText: customer.name }).waitFor()
  }
  try {
    await page.goto(meta.origin + '/#/satislar')
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username)
    await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await page.getByRole('heading', { name: 'Satışlar', exact: true }).waitFor()
    const auth = await (await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })).json()
    async function sql(query, params = []) {
      const response = await context.request.post(meta.api + '/__test/sql', { headers: { 'X-Test-Key': meta.key }, data: { sql: query, params } })
      assert.equal(response.status(), 200)
      return (await response.json()).results
    }
    async function post(path, data) {
      const response = await context.request.post(meta.origin + '/api/v1/' + path, {
        headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data,
      })
      assert.equal(response.status(), 201)
      return (await response.json()).data
    }
    const first = await post('customers', { name: 'İzole pencere müşterisi A', address: 'Geçici test adresi A' })
    const second = await post('customers', { name: 'İzole pencere müşterisi B', address: 'Geçici test adresi B' })
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    const product = await post('products', { name: 'İzole pencere ürünü', current_price_kurus: 1999 })
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])

    await open()
    await dialog().getByRole('searchbox', { name: 'Müşteri ara', exact: true }).waitFor()
    assert.equal(new URL(page.url()).hash, '#/satislar')
    assert.equal(await page.locator('h1').innerText(), 'Satışlar')
    await page.keyboard.press('Escape')
    await dialog().waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('button', { name: 'Yeni satış', exact: true }).evaluate(el => el === document.activeElement), true)
    pass('Unfiltered create opens on the list; Escape closes and restores focus')

    await chooseCustomer(first)
    const listHash = new URL(page.url()).hash
    await open()
    await dialog().locator('.sale-selected strong').filter({ hasText: first.name }).waitFor()
    assert.equal(await dialog().getByRole('searchbox', { name: 'Müşteri ara', exact: true }).count(), 0)
    assert.equal(new URL(page.url()).hash, listHash)
    await dialog().getByRole('button', { name: product.name + ' seç', exact: true }).click()
    await dialog().getByLabel(product.name + ' miktarı').fill('2')
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.equal(await dialog().evaluate(el => el.scrollWidth > el.clientWidth), false)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    const lastButton = dialog().getByRole('button', { name: 'Satışı Kaydet', exact: true })
    await lastButton.focus(); await page.keyboard.press('Tab')
    assert.equal(await dialog().getByRole('button', { name: 'Satış penceresini kapat', exact: true }).evaluate(el => el === document.activeElement), true)
    await close()
    assert.equal(submissions.length, 0)
    assert.equal(new URL(page.url()).hash, listHash)
    pass('Selected customer prefilled; cancel keeps filters and draft; modal fits 320/390/1440px and traps focus')

    await page.getByRole('button', { name: 'Müşteriyi Değiştir', exact: true }).click()
    await chooseCustomer(second)
    await open()
    await dialog().locator('.sale-selected strong').filter({ hasText: second.name }).waitFor()
    assert.equal(await dialog().getByLabel(product.name + ' miktarı').inputValue(), '2')
    loseResponse = true
    await dialog().getByRole('button', { name: 'Satışı Kaydet', exact: true }).click()
    await dialog().getByRole('button', { name: 'Aynı satışı tekrar dene', exact: true }).waitFor()
    await close()
    await page.getByRole('button', { name: 'Müşteriyi Değiştir', exact: true }).click()
    await chooseCustomer(first)
    await open()
    await dialog().locator('.sale-selected strong').filter({ hasText: second.name }).waitFor()
    await dialog().getByRole('button', { name: 'Aynı satışı tekrar dene', exact: true }).click()
    await page.getByText('Satış kaydedildi. Teslimat ve ödeme bilgileri aşağıdadır.', { exact: true }).waitFor()
    assert.equal(await dialog().count(), 0)
    assert.equal(submissions.length, 2)
    assert.deepEqual(submissions[0], submissions[1])
    assert.equal(submissions[0].body.customer_id, second.id)
    assert.equal(submissions[0].body.items[0].quantity, 2)
    const counts = await sql('SELECT COUNT(*) AS count FROM sales')
    assert.equal(counts[0].count, 1)
    pass('Employee can save; lost response retains original customer, payload and key; retry creates only one sale')

    for (const path of ['#/yeni-satis', '#/satislar/yeni']) {
      await page.goto(meta.origin + '/' + path + '?customer_id=' + first.id)
      await dialog().locator('.sale-selected strong').filter({ hasText: first.name }).waitFor()
      assert.equal(await page.locator('h1').innerText(), 'Satışlar')
      await close()
      assert.equal(new URL(page.url()).hash.startsWith('#/satislar?'), true)
    }
    await page.goto(meta.origin + '/#/yeni-satis?mode=walk_in')
    await dialog().getByRole('heading', { name: 'Tezgâh satışı', exact: true }).waitFor()
    await close()
    pass('Existing create routes and walk-in shortcut open the same dialog')

    await page.goto(meta.origin + '/#/tahsilatlar')
    await page.getByRole('button', { name: 'Yeni tahsilat', exact: true }).click()
    await page.getByRole('dialog', { name: 'Yeni tahsilat', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Tahsilat penceresini kapat', exact: true }).click()
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.deepEqual(errors, [])
    pass('Existing collection dialog unchanged; no browser JavaScript errors')
    return { passed, scope: 'Actual React/proxy/API with temporary isolated D1 only' }
  } finally { await context.close() }
}
