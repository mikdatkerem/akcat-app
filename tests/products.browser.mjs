import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifyProducts(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const passed = [], screenshots = [], errors = [], keys = []
  page.on('pageerror', error => errors.push(error.message))
  let loseResponse = false, failPatch = false, failList = false
  let creates = 0
  const name = 'Ürün ' + randomUUID()
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  const title = value => page.getByRole('heading', { level: 1, name: value, exact: true })
  const field = value => page.getByLabel(value)
  const submit = () => page.getByRole('button', { name: 'Ürünü kaydet', exact: true })
  const save = () => page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true })
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200)
    return (await response.json()).results
  }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    const headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/v1/products' && request.method() === 'POST') {
      creates++; keys.push(headers['idempotency-key'])
      if (loseResponse) {
        loseResponse = false
        const actual = await route.fetch({ headers })
        assert.equal(actual.status(), 201)
        await actual.dispose()
        return route.abort('failed') // The real D1 write commits; only its response is lost.
      }
    }
    if (request.method() === 'PATCH' && failPatch) return route.abort('internetdisconnected')
    if (url.pathname === '/api/v1/products' && request.method() === 'GET' && failList) headers['X-Test-Mode'] = 'product-db-error'
    return route.continue({ headers })
  })
  async function fit(label) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: ${width}px overflow`)
      if (label === 'list') assert.equal(await page.locator('.product-table').evaluate(element => getComputedStyle(element).display), width < 1200 ? 'block' : 'table')
      const path = join(meta.temporary, `products-${label}-${width}.png`)
      await page.screenshot({ path, fullPage: true }); screenshots.push(path)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  async function filter(status) {
    await field('Durum').selectOption(status)
    const response = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/products' && url.searchParams.get('status') === status && response.request().method() === 'GET'
    })
    await page.getByRole('button', { name: 'Ara', exact: true }).click()
    assert.equal((await response).status(), 200)
  }
  try {
    await page.goto(meta.origin + '/#/urunler')
    await title('Giriş yapın').waitFor()
    assert.equal(await page.locator('.product-table').count(), 0)
    await field(/^Kullanıcı adı/).fill(meta.fixture.username)
    await field(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await page.getByRole('heading', { name: 'Henüz ürün yok', exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Ürün ekle', exact: true }).count(), 0)
    pass('protected route; genuine empty list; employee has no write actions')
    for (const path of ['yeni', randomUUID() + '/duzenle']) {
      await page.goto(meta.origin + '/#/urunler/' + path)
      await title('Erişim izni gerekli').waitFor()
      assert.equal(await page.locator('.product-form').count(), 0)
    }
    const me = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })
    const auth = await me.json()
    const denied = await context.request.post(meta.origin + '/api/v1/products', { headers: { 'X-Test-Key': meta.key, Origin: meta.origin,
      'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data: { name, current_price_kurus: 1999 } })
    assert.equal(denied.status(), 403)
    pass('employee direct form routes and API create are forbidden')

    // This is a temporary fixture user, never a real account or bootstrap admin.
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    await page.goto(meta.origin + '/#/urunler/yeni'); await page.reload()
    await title('Yeni ürün').waitFor()
    await submit().click()
    await page.getByText('Ürün adını girin.', { exact: true }).waitFor()
    assert.equal(creates, 0)
    await field(/^Ürün adı/).fill(name)
    for (const price of ['-1', '1,999', '90071992547409,92']) {
      await field(/^Satış fiyatı/).fill(price); await submit().click()
      assert.equal(await page.locator('[name="price"]').getAttribute('aria-invalid'), 'true')
      assert.equal(creates, 0)
    }
    await field(/^Satış fiyatı/).fill('19,99')
    await fit('form')
    pass('admin form validates blank/negative/fractional/unsafe prices; 320/390/1440px fits')
    loseResponse = true
    await submit().click()
    await page.getByRole('heading', { name: 'Ürün kaydedilemedi', exact: true }).waitFor()
    assert.equal(await field(/^Satış fiyatı/).inputValue(), '19,99')
    await submit().click()
    await title(name).waitFor()
    await page.getByText('Ürün oluşturuldu.', { exact: true }).waitFor()
    assert.equal(creates, 2); assert.ok(keys[0] && keys[0] === keys[1])
    const rows = await sql('SELECT id,current_price_kurus FROM products WHERE name=?', [name])
    assert.equal(rows.length, 1); assert.equal(rows[0].current_price_kurus, 1999)
    const id = rows[0].id
    await page.getByText('19,99\u00a0₺', { exact: true }).waitFor()
    pass('19,99 TL stores 1999 kuruş; lost response retry creates one product')

    await page.getByRole('link', { name: 'Ürünü düzenle', exact: true }).click()
    await title('Ürünü düzenle').waitFor()
    assert.equal(await field(/^Satış fiyatı/).inputValue(), '19,99')
    await field(/^Satış fiyatı/).fill('150')
    await page.getByRole('checkbox', { name: 'Aktif ürün', exact: true }).uncheck()
    failPatch = true; await save().click()
    await page.getByRole('heading', { name: 'Ürün kaydedilemedi', exact: true }).waitFor()
    assert.equal(await field(/^Satış fiyatı/).inputValue(), '150')
    failPatch = false; await save().click()
    await title(name).waitFor()
    await page.getByText('150,00\u00a0₺', { exact: true }).waitFor()
    assert.equal((await sql('SELECT current_price_kurus,is_active FROM products WHERE id=?', [id]))[0].current_price_kurus, 15000)
    pass('failed edits retain input; price update and deactivation reach real D1')

    await page.getByRole('link', { name: 'Ürün listesine dön', exact: true }).click()
    await page.locator('.product-name').waitFor()
    await fit('list')
    await filter('inactive'); await page.locator('.product-name').waitFor()
    assert.equal(await page.locator('.product-name').innerText(), name)
    await filter('active')
    await page.getByRole('heading', { name: 'Bu filtrelerde ürün bulunamadı', exact: true }).waitFor()
    await page.goto(meta.origin + '/#/urunler/' + id + '/duzenle')
    await title('Ürünü düzenle').waitFor()
    await page.getByRole('checkbox', { name: 'Aktif ürün', exact: true }).check()
    await save().click(); await title(name).waitFor()
    await page.getByText('Aktif', { exact: true }).waitFor()
    pass('responsive table/mobile cards, inactive filters and reactivation')

    await page.goto(meta.origin + '/#/urunler/yeni'); await title('Yeni ürün').waitFor()
    const second = 'İkinci ' + randomUUID()
    await field(/^Ürün adı/).fill(second); await field(/^Satış fiyatı/).fill('0,01')
    await submit().click(); await title(second).waitFor()
    await page.goto(meta.origin + '/#/urunler?pageSize=1'); await page.locator('.product-name').waitFor()
    const first = await page.locator('.product-name').innerText()
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click()
    await page.getByText('2 ürün · Sayfa 2 / 2', { exact: true }).waitFor()
    assert.notEqual(await page.locator('.product-name').innerText(), first)
    await field('Ürün adı').fill(name)
    const search = page.waitForResponse(response => new URL(response.url()).searchParams.get('q') === name)
    await page.getByRole('button', { name: 'Ara', exact: true }).click(); assert.equal((await search).status(), 200)
    await page.getByText('1 ürün · Sayfa 1 / 1', { exact: true }).waitFor()
    assert.equal(await page.locator('.product-name').innerText(), name)
    pass('real pagination and name search')

    failList = true; await page.reload()
    await page.getByRole('heading', { name: 'Ürünler yüklenemedi', exact: true }).waitFor()
    assert.equal(await page.locator('.product-name').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Henüz ürün yok', exact: true }).count(), 0)
    failList = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await page.locator('.product-name').waitFor()
    await page.goto(meta.origin + '/#/urunler/' + randomUUID())
    await page.getByText('Ürün bulunamadı.', { exact: true }).waitFor()
    pass('actual 500/404 errors never produce fake data or empty success')

    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    await page.goto(meta.origin + '/#/urunler'); await page.reload(); await page.locator('.product-name').first().waitFor()
    assert.equal(await page.getByRole('link', { name: 'Ürün ekle', exact: true }).count(), 0)
    assert.equal(await page.getByRole('link', { name: /ürününü düzenle/ }).count(), 0)
    const health = await context.request.get(meta.origin + '/api/health', { headers: { 'X-Test-Key': meta.key } })
    assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' })
    const audit = await sql("SELECT action,actor_user_id FROM audit_logs WHERE entity_type='product' AND entity_id=?", [id])
    assert.equal(audit.filter(row => row.action === 'product.created').length, 1)
    assert.ok(audit.every(row => row.actor_user_id === meta.fixture.id))
    assert.deepEqual(errors, [])
    pass('employee reads populated catalog; audit and health intact; no browser JS errors')
    return { passed, screenshots, scope: 'Only temporary isolated Workers/D1 fixture data; no real products, prices or accounts.' }
  } catch (error) {
    await page.screenshot({ path: join(meta.temporary, 'products-failure.png'), fullPage: true })
    console.error({ headings: await page.locator('h1').allTextContents(), alerts: await page.getByRole('alert').allTextContents() })
    throw error
  } finally { await context.close() }
}
