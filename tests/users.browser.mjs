import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'

export async function verifyUsers(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8')), passed = [], errors = []
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  const calls = { create: [], reset: [] }, payloads = { create: [], reset: [] }
  let lose = '', failRead = false, userReads = 0, employeeContext
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  const heading = name => page.getByRole('heading', { level: 1, name, exact: true })
  const sql = async (sql, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  async function guard(ctx) {
    await ctx.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== meta.origin) return route.continue()
      const headers = { ...request.headers(), 'X-Test-Key': meta.key }
      if (url.pathname.startsWith('/api/v1/users') && request.method() === 'GET') {
        userReads++
        if (failRead) headers['X-Test-Mode'] = 'finance-db-error'
      }
      const kind = url.pathname === '/api/v1/users' && request.method() === 'POST' ? 'create' : url.pathname.endsWith('/reset-password') ? 'reset' : ''
      if (kind) {
        calls[kind].push(headers['idempotency-key']); payloads[kind].push(request.postDataJSON())
        if (lose === kind) { lose = ''; const response = await route.fetch({ headers }); assert.equal(response.status(), kind === 'create' ? 201 : 200); await response.dispose(); return route.abort('failed') }
      }
      return route.continue({ headers })
    })
    ctx.on('page', target => target.on('pageerror', error => errors.push(error.message)))
  }
  page.on('pageerror', error => errors.push(error.message))
  async function fit() {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'user module overflow ' + width)
      const modal = page.getByRole('dialog')
      if (await modal.count()) { const bounds = await modal.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width) }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  try {
    await guard(context)
    await page.goto(meta.origin + '/#/calisanlar'); await heading('Giriş yapın').waitFor()
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click(); await heading('Erişim izni gerekli').waitFor()
    assert.equal(userReads, 0); assert.equal(await page.getByRole('link', { name: 'Çalışanlar', exact: true }).count(), 0)
    pass('employee cannot see the menu or open the management route; no user API call leaks through the UI guard')
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id])
    await page.reload(); await heading('Çalışanlar').waitFor(); await page.locator('.user-table tbody tr').waitFor()
    assert.equal(await page.locator('.desktop-sidebar').getByRole('link', { name: 'Çalışanlar', exact: true }).count(), 1)
    await fit()
    await page.getByRole('searchbox', { name: 'Kullanıcı adı ara', exact: true }).fill(randomUUID())
    await page.getByRole('button', { name: 'Ara', exact: true }).click(); await page.getByRole('heading', { name: 'Hesap bulunamadı', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Çalışan ekle', exact: true }).click(); await heading('Çalışan ekle').waitFor()
    assert.equal(await page.getByLabel('Rol', { exact: true }).inputValue(), 'employee')
    await page.getByRole('button', { name: 'Hesabı oluştur', exact: true }).click(); assert.equal(calls.create.length, 0)
    const username = 'staff_' + randomUUID().slice(0, 8), password = randomBytes(24).toString('base64url')
    await page.getByLabel(/^Kullanıcı adı/).fill(username); await page.getByLabel(/^Başlangıç parolası/).fill(password)
    await fit(); lose = 'create'; await page.getByRole('button', { name: 'Hesabı oluştur', exact: true }).click()
    await page.getByRole('heading', { name: 'Hesap kaydedilemedi', exact: true }).waitFor()
    assert.equal(await page.getByLabel(/^Başlangıç parolası/).isDisabled(), true)
    await page.getByRole('button', { name: 'Aynı kaydı tekrar dene', exact: true }).click(); await heading(username).waitFor()
    await page.getByText('Hesap oluşturuldu.', { exact: true }).waitFor()
    assert.equal(calls.create.length, 2); assert.equal(calls.create[0], calls.create[1]); assert.ok(JSON.stringify(payloads.create[0]) === JSON.stringify(payloads.create[1]))
    assert.equal(await page.locator('input[type=password]').count(), 0)
    const account = (await sql('SELECT id FROM users WHERE username=?', [username]))[0]
    assert.equal((await sql('SELECT count(*) AS n FROM users WHERE username=?', [username]))[0].n, 1)
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    pass('admin list/search/empty state and validated default-employee form work; lost create response replays once without storing passwords')
    employeeContext = await context.browser().newContext(); await guard(employeeContext)
    const staffPage = await employeeContext.newPage(); staffPage.setDefaultTimeout(15000)
    await staffPage.goto(meta.origin + '/#/calisanlar'); await staffPage.getByRole('heading', { name: 'Giriş yapın', exact: true }).waitFor()
    await staffPage.getByLabel(/^Kullanıcı adı/).fill(username); await staffPage.getByLabel(/^Parola(?:\s|\*)*$/).fill(password)
    await staffPage.getByRole('button', { name: 'Giriş Yap', exact: true }).click(); await staffPage.getByRole('heading', { name: 'Erişim izni gerekli', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Hesabı düzenle', exact: true }).click(); await heading('Çalışanı düzenle').waitFor()
    await page.getByLabel('Hesap durumu', { exact: true }).selectOption('inactive'); await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click()
    await page.getByRole('dialog', { name: 'Hesap değişikliğini onaylayın', exact: true }).waitFor(); await fit()
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden')
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0)
    assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), 'hidden')
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click(); await page.getByRole('button', { name: 'Değişikliği Onayla', exact: true }).click()
    await heading(username).waitFor(); await page.getByText('Pasif', { exact: true }).waitFor()
    await staffPage.reload(); await staffPage.getByRole('heading', { name: 'Giriş yapın', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Hesabı düzenle', exact: true }).click(); await page.getByLabel('Hesap durumu', { exact: true }).selectOption('active')
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click(); await page.getByRole('button', { name: 'Değişikliği Onayla', exact: true }).click(); await heading(username).waitFor()
    assert.equal((await sql('SELECT count(*) AS n FROM sessions WHERE user_id=? AND revoked_at IS NULL', [account.id]))[0].n, 0)
    pass('new account can log in; explicit deactivation confirmation revokes its session; reactivation cannot revive it; modal Escape/scroll/widths work')
    await page.getByRole('link', { name: 'Hesabı düzenle', exact: true }).click(); await page.getByLabel('Rol', { exact: true }).selectOption('admin')
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click(); await page.getByRole('button', { name: 'Değişikliği Onayla', exact: true }).click(); await heading(username).waitFor()
    await page.getByText('Admin', { exact: true }).first().waitFor()
    await page.getByRole('link', { name: 'Hesabı düzenle', exact: true }).click(); await page.getByLabel('Rol', { exact: true }).selectOption('employee')
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click(); await page.getByRole('button', { name: 'Değişikliği Onayla', exact: true }).click(); await heading(username).waitFor()
    await page.goto(meta.origin + '/#/calisanlar/' + meta.fixture.id + '/duzenle'); await heading('Çalışanı düzenle').waitFor()
    assert.equal(await page.getByLabel('Rol', { exact: true }).isDisabled(), true); assert.equal(await page.getByLabel('Hesap durumu', { exact: true }).isDisabled(), true)
    pass('role promotion/demotion require confirmation and persist; own-admin lockout controls are disabled')
    await page.goto(meta.origin + '/#/calisanlar/' + account.id + '/parola'); await heading('Parola sıfırla').waitFor()
    const replacement = randomBytes(24).toString('base64url')
    await page.locator('input[name="password"]').fill(replacement)
    await page.getByLabel('Yeni parola tekrarı', { exact: false }).fill(replacement)
    await fit(); await page.getByRole('button', { name: 'Parolayı sıfırla', exact: true }).click(); await page.getByRole('dialog').waitFor(); await fit()
    lose = 'reset'; await page.getByRole('button', { name: 'Parolayı Sıfırla ve Oturumları Kapat', exact: true }).click()
    await page.getByRole('heading', { name: 'Parola sıfırlanamadı', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Parolayı Sıfırla ve Oturumları Kapat', exact: true }).click(); await heading(username).waitFor()
    await page.getByText('Parola sıfırlandı; önceki oturumlar kapatıldı.', { exact: true }).waitFor()
    assert.equal(calls.reset[0], calls.reset[1]); assert.ok(JSON.stringify(payloads.reset[0]) === JSON.stringify(payloads.reset[1]))
    assert.equal(await page.locator('input[type=password]').count(), 0)
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    pass('password reset confirms all-session revocation; lost response retry keeps its key/body and exposes no password after success')
    failRead = true; await page.goto(meta.origin + '/#/calisanlar'); await page.getByRole('heading', { name: 'Çalışanlar yüklenemedi', exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Hesap bulunamadı', exact: true }).count(), 0)
    failRead = false; await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click(); await page.locator('.user-table tbody tr').first().waitFor(); await fit()
    pass('real API failure stays an error and retry restores the list; mobile cards/desktop table have no overflow')
    await page.goto(meta.origin + '/#/calisanlar/' + meta.fixture.id + '/parola'); await heading('Parola sıfırla').waitFor()
    const ownPassword = randomBytes(24).toString('base64url')
    await page.locator('input[name="password"]').fill(ownPassword); await page.getByLabel('Yeni parola tekrarı', { exact: false }).fill(ownPassword)
    await page.getByRole('button', { name: 'Parolayı sıfırla', exact: true }).click(); await page.getByText('Kendi parolanızı sıfırlıyorsunuz. Yeniden giriş yapmanız gerekecek.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Parolayı Sıfırla ve Oturumları Kapat', exact: true }).click(); await heading('Giriş yapın').waitFor()
    assert.equal(await page.locator('.desktop-sidebar').count(), 0); assert.deepEqual(errors, [])
    pass('own password reset explicitly warns then removes the protected layout after server-side session revocation')
    return { passed, scope: 'Only independent temporary D1 fixtures; real React/proxy/API. No real accounts, remote data, deploy or seed.' }
  } finally { await employeeContext?.close(); await context.close() }
}
