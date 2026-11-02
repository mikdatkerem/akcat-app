import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
export async function verifyCustomerDuplicates(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage(), errors = [], passed = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(e.message))
  let checks = 0, approvedSends = 0, loseResponse = true
  let delayNext = false, markDelayed, releaseDelayed
  await page.route('**/api/**', async route => {
    const r = route.request(), path = new URL(r.url()).pathname
    const headers = { ...r.headers(), 'X-Test-Key': meta.key }
    if (path.endsWith('/check-duplicates')) {
      checks++
      if (delayNext) {
        delayNext = false
        const response = await route.fetch({ headers })
        markDelayed()
        await new Promise(resolve => { releaseDelayed = resolve })
        return route.fulfill({ response })
      }
    }
    if (path === '/api/v1/customers' && r.method() === 'POST' && r.postDataJSON()?.duplicate_confirmation) {
      approvedSends++
      if (loseResponse) { loseResponse = false; const response = await route.fetch({ headers }); assert.equal(response.status(), 201); await response.dispose(); return route.abort() }
    }
    return route.continue({ headers })
  })
  try {
    const login = await context.request.post(meta.origin + '/api/v1/auth/login', { headers: { Origin: meta.origin, 'X-Test-Key': meta.key }, data: { username: meta.fixture.username, password: meta.fixture.password } })
    assert.equal(login.status(), 200); const session = await login.json()
    const name = 'Ahmet Yılmaz ' + randomUUID(), address = 'İzole korunacak form adresi', phone = '0532 123 45 67'
    const created = await context.request.post(meta.origin + '/api/v1/customers', { headers: { Origin: meta.origin, 'X-Test-Key': meta.key, 'X-CSRF-Token': session.csrfToken, 'Idempotency-Key': randomUUID() }, data: { name, address, phone } })
    assert.equal(created.status(), 201)
    await page.goto(meta.origin + '/#/musteriler/yeni')
    const nameField = page.locator('input[name=name]'), phoneField = page.locator('input[name=phone]'), addressField = page.locator('textarea[name=address]')
    await nameField.fill('Ah'); await page.waitForTimeout(550); assert.equal(checks, 0)
    await nameField.fill(name + 'x'); await nameField.fill(name)
    await page.locator('.duplicate-preview summary').waitFor(); assert.equal(checks, 1)
    await page.locator('.duplicate-preview summary').click()
    assert.ok((await page.locator('.duplicate-preview').textContent()).includes('***'), 'masked preview phone')
    const popupPromise = context.waitForEvent('page')
    await page.locator('.duplicate-preview a').click(); const popup = await popupPromise
    await popup.waitForLoadState(); assert.equal(await nameField.inputValue(), name); await popup.close()
    delayNext = true
    const oldStarted = new Promise(resolve => { markDelayed = resolve })
    await nameField.fill(name.slice(0, -2)); await oldStarted
    const replacement = 'Başka ' + randomUUID()
    const newResponse = page.waitForResponse(r => r.url().endsWith('/check-duplicates') && r.request().postDataJSON()?.name === replacement)
    await nameField.fill(replacement); await newResponse
    const oldResponse = page.waitForResponse(r => r.url().endsWith('/check-duplicates') && r.request().postDataJSON()?.name === name.slice(0, -2))
    releaseDelayed(); await oldResponse
    assert.equal(await page.locator('.duplicate-preview').count(), 0)
    await nameField.fill(name)
    passed.push('450ms debounce, 3 karakter eşiği, maskeli panel ve yeni sekmede formu koruyan mevcut müşteri bağlantısı')
    await phoneField.fill(phone); await addressField.fill(address)
    const save = () => page.getByRole('button', { name: 'Müşteriyi kaydet', exact: true })
    await save().click()
    const dialog = page.getByRole('dialog', { name: 'Benzer Müşteri Bulundu' })
    await dialog.waitFor()
    for (const width of [320, 360, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth), `${width}: dialog overflow`)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: page overflow`)
      const button = await dialog.getByRole('button', { name: 'Yine de Kaydet' }).boundingBox()
      assert.ok(button.height >= 44, `${width}: touch height`)
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      assert.ok(await dialog.evaluate(e => e.contains(document.activeElement)), 'focus trapped in confirmation')
    }
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
    assert.equal(await nameField.inputValue(), name); assert.equal(await phoneField.inputValue(), phone); assert.equal(await addressField.inputValue(), address)
    assert.ok(await save().evaluate(e => e === document.activeElement), 'focus restored to save')
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '')
    passed.push('320/360/390/430/1440 modal, Escape/odak/kaydırma ve iptalde form korunması')
    await save().click(); await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Yine de Kaydet' }).evaluate(button => { button.click(); button.click() })
    await page.getByText('Yanıt doğrulanamadı.', { exact: false }).waitFor()
    assert.equal(approvedSends, 1); assert.equal(await nameField.isDisabled(), true)
    await save().click()
    await page.getByRole('heading', { level: 1, name, exact: true }).waitFor()
    assert.equal(approvedSends, 2)
    const count = await context.request.post(meta.api + '/__test/sql', { headers: { 'X-Test-Key': meta.key }, data: { sql: 'SELECT count(*) AS n FROM customers WHERE name=?', params: [name] } })
    assert.equal((await count.json()).results[0].n, 2)
    passed.push('açık onay, çift tıklama engeli, kayıp onay yanıtında aynı anahtarla yeniden deneme ve yalnızca bir ek müşteri')
    const id = page.url().split('/').pop()
    await page.goto(meta.origin + '/#/musteriler/' + id + '/duzenle')
    await page.getByRole('heading', { name: 'Müşteriyi düzenle', exact: true }).waitFor()
    const previousChecks = checks
    await page.locator('textarea[name=delivery_notes]').fill('İzole teslimat notu')
    await page.waitForTimeout(550); assert.equal(checks, previousChecks)
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click()
    await page.getByRole('heading', { level: 1, name, exact: true }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    passed.push('düzenlemede değişmeyen kimlik/teslimat notu için gereksiz uyarı yok')
    assert.deepEqual(errors, [])
    return { passed }
  } finally { releaseDelayed?.(); await context.close() }
}
