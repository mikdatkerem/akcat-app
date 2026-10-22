import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifyCustomers(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const passed = []
  const screenshots = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  function pass(label) { passed.push(label); console.log('PASS: ' + label) }
  let loseCreateResponse = false
  let failPatch = false
  let failList = false
  let createRequests = 0
  const createKeys = []
  const name = 'Müşteri ' + randomUUID()
  let customerId

  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    const headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/v1/customers' && request.method() === 'POST') {
      createRequests++
      createKeys.push(headers['idempotency-key'])
      if (loseCreateResponse) {
        loseCreateResponse = false
        const actual = await route.fetch({ headers })
        assert.equal(actual.status(), 201)
        await actual.dispose()
        return route.abort('failed') // Real create committed; simulate loss of its response, never fake success.
      }
    }
    if (request.method() === 'PATCH' && failPatch) return route.abort('internetdisconnected')
    if (url.pathname === '/api/v1/customers' && request.method() === 'GET' && failList) headers['X-Test-Mode'] = 'customer-db-error'
    return route.continue({ headers })
  })
  const title = value => page.getByRole('heading', { level: 1, name: value, exact: true })
  const field = value => page.getByLabel(value)
  const submit = () => page.getByRole('button', { name: 'Müşteriyi kaydet', exact: true })
  const saveChanges = () => page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true })
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST',
      headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200)
    return (await response.json()).results
  }
  async function fit(label) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label} ${width}px overflow`)
      const path = join(meta.temporary, `customers-${label}-${width}.png`)
      await page.screenshot({ path, fullPage: true })
      screenshots.push(path)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  async function fillCustomer(customerName) {
    await field(/^Müşteri adı/).fill(customerName)
    await field(/^Telefon \(isteğe bağlı\)/).fill('+90 (555) 123-45-67')
    await field(/^Adres/).fill('İzole test adresi\nİkinci satır')
    await field(/^Teslimat notu/).fill('İzole teslimat notu')
  }
  try {
    await page.goto(meta.origin + '/#/musteriler')
    await title('Giriş yapın').waitFor()
    assert.equal(await page.locator('.customer-table').count(), 0)
    await field(/^Kullanıcı adı/).fill(meta.fixture.username)
    await field(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    assert.equal((await loginResponse).status(), 200)
    await page.getByRole('heading', { name: 'Henüz müşteri yok', exact: true }).waitFor()
    pass('protected customer route and genuine empty list')

    await page.getByRole('link', { name: 'Müşteri ekle', exact: true }).click()
    await title('Yeni müşteri').waitFor()
    await submit().click()
    await page.getByText('Müşteri adını girin.', { exact: true }).waitFor()
    await page.getByText('Teslimat adresini girin.', { exact: true }).waitFor()
    assert.equal(createRequests, 0)
    await fillCustomer(name)
    await field(/^Telefon \(isteğe bağlı\)/).fill('123')
    await submit().click()
    await page.getByText('Telefon numarası 7–15 rakam içermeli. Ülke kodu ve dahili kullanılabilir.', { exact: true }).waitFor()
    assert.equal(createRequests, 0)
    await field(/^Telefon \(isteğe bağlı\)/).fill('+90 (555) 123-45-67')
    await fit('form')
    pass('required fields, understandable phone validation and 320/390/1440px form layout')

    loseCreateResponse = true
    await submit().click()
    await page.getByRole('heading', { name: 'Müşteri kaydedilemedi', exact: true }).waitFor()
    assert.equal(createRequests, 1)
    assert.equal(await field(/^Müşteri adı/).inputValue(), name)
    assert.equal(await field(/^Teslimat notu/).inputValue(), 'İzole teslimat notu')
    await submit().click()
    await title(name).waitFor()
    await page.getByText('Müşteri oluşturuldu.', { exact: true }).waitFor()
    assert.equal(createRequests, 2)
    assert.ok(createKeys[0] && createKeys[0] === createKeys[1])
    const customers = await sql('SELECT id FROM customers WHERE name=?', [name])
    assert.equal(customers.length, 1)
    customerId = customers[0].id
    pass('lost create response retains form; retry uses the same key and produces one customer')

    await page.getByRole('link', { name: 'Bilgileri düzenle', exact: true }).click()
    await title('Müşteriyi düzenle').waitFor()
    assert.equal(await field(/^Telefon \(isteğe bağlı\)/).inputValue(), '+90 (555) 123-45-67')
    assert.equal(await page.getByRole('checkbox', { name: 'Aktif müşteri', exact: true }).count(), 0)
    const changedNote = 'Güncellenmiş teslimat notu'
    await field(/^Teslimat notu/).fill(changedNote)
    failPatch = true
    await saveChanges().click()
    await page.getByRole('heading', { name: 'Müşteri kaydedilemedi', exact: true }).waitFor()
    assert.equal(await field(/^Teslimat notu/).inputValue(), changedNote)
    failPatch = false
    await saveChanges().click()
    await title(name).waitFor()
    await page.getByText('Müşteri bilgileri güncellendi.', { exact: true }).waitFor()
    assert.equal((await sql('SELECT delivery_notes FROM customers WHERE id=?', [customerId]))[0].delivery_notes, changedNote)
    pass('employee edit loads current values, hides admin control and preserves failed edits')

    await page.getByRole('link', { name: 'Müşteri listesine dön', exact: true }).click()
    await page.locator('.customer-name').waitFor()
    await fit('list')
    assert.equal(await page.locator('.customer-table').evaluate(element => getComputedStyle(element).display), 'table')
    for (const query of [name, '905551234567']) {
      await field('İsim veya telefon').fill(query)
      const listResponse = page.waitForResponse(response => {
        const url = new URL(response.url())
        return url.pathname === '/api/v1/customers' && url.searchParams.get('q') === query && response.request().method() === 'GET'
      })
      await page.getByRole('button', { name: 'Ara', exact: true }).click()
      assert.equal((await listResponse).status(), 200)
      await page.locator('.customer-name').filter({ hasText: name }).waitFor()
      assert.equal(await page.locator('.customer-name').count(), 1)
    }
    pass('name/phone search and responsive table/mobile list without horizontal overflow')

    const me = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })
    assert.equal(me.status(), 200)
    const auth = await me.json()
    const denied = await context.request.patch(meta.origin + '/api/v1/customers/' + customerId, {
      headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken }, data: { is_active: false } })
    assert.equal(denied.status(), 403)
    pass('employee direct API attempt to change active status receives 403')

    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    await page.goto(meta.origin + '/#/musteriler/' + customerId + '/duzenle')
    await page.reload() // Refresh /auth/me; role changes are never inferred from a client-side value.
    await title('Müşteriyi düzenle').waitFor()
    await page.getByRole('checkbox', { name: 'Aktif müşteri', exact: true }).uncheck()
    await saveChanges().click()
    await title(name).waitFor()
    await page.getByText('Pasif', { exact: true }).waitFor()
    assert.equal((await sql('SELECT is_active FROM customers WHERE id=?', [customerId]))[0].is_active, 0)
    await page.goto(meta.origin + '/#/musteriler')
    await page.locator('.customer-name').waitFor()
    await field('Durum').selectOption('inactive')
    const inactiveResponse = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/customers' && url.searchParams.get('status') === 'inactive'
    })
    await page.getByRole('button', { name: 'Ara', exact: true }).click()
    assert.equal((await inactiveResponse).status(), 200)
    await page.locator('.customer-name').filter({ hasText: name }).waitFor()
    await field('Durum').selectOption('active')
    await page.getByRole('button', { name: 'Ara', exact: true }).click()
    await page.getByRole('heading', { name: 'Bu filtrelerde müşteri bulunamadı', exact: true }).waitFor()
    pass('updated server role enables admin deactivation and active/inactive filtering')

    await page.getByRole('link', { name: 'Müşteri ekle', exact: true }).click()
    await title('Yeni müşteri').waitFor()
    const secondName = 'İkinci ' + randomUUID()
    await fillCustomer(secondName)
    await submit().click()
    await title(secondName).waitFor()
    await page.goto(meta.origin + '/#/musteriler?pageSize=1')
    await page.locator('.customer-name').waitFor()
    const first = await page.locator('.customer-name').innerText()
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click()
    await page.getByText('2 müşteri · Sayfa 2 / 2', { exact: true }).waitFor()
    assert.notEqual(await page.locator('.customer-name').innerText(), first)
    await page.getByRole('button', { name: 'Önceki', exact: true }).click()
    await page.getByText('2 müşteri · Sayfa 1 / 2', { exact: true }).waitFor()
    assert.equal(await page.locator('.customer-name').innerText(), first)
    pass('admin creates through UI and pagination navigates actual API pages')

    failList = true
    await page.reload()
    await page.getByRole('heading', { name: 'Müşteriler yüklenemedi', exact: true }).waitFor()
    assert.equal(await page.locator('.customer-name').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Henüz müşteri yok', exact: true }).count(), 0)
    failList = false
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
    await page.locator('.customer-name').waitFor()
    await page.goto(meta.origin + '/#/musteriler/' + randomUUID())
    await page.getByText('Müşteri bulunamadı.', { exact: true }).waitFor()
    assert.equal(await page.locator('.customer-name').count(), 0)
    pass('actual API 500 and 404 show errors without fabricated/empty-success fallback')
    assert.deepEqual(errors, [])
    pass('no browser JavaScript errors')
    return { passed, screenshots, scope: 'Only temporary isolated Workers/D1 fixture data. No real customers or admin.' }
  } catch (error) {
    await page.screenshot({ path: join(meta.temporary, 'customers-failure.png'), fullPage: true })
    console.error({ headings: await page.locator('h1').allTextContents(), alerts: await page.getByRole('alert').allTextContents() })
    throw error
  } finally { await context.close() }
}
