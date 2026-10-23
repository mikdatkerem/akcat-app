import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

export async function verifyAccount(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8')), passed = [], errors = []
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(); page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  let changes = 0, network = '', reads = 0, hasCsrf = false
  const pass = label => { passed.push(label); console.log('PASS: ' + label) }
  const heading = name => page.getByRole('heading', { name, exact: true, level: 1 })
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    const headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/v1/auth/me') reads++
    if (url.pathname.endsWith('/change-password') && request.method() === 'POST') {
      changes++; hasCsrf = /^[A-Za-z0-9_-]{43}$/.test(headers['x-csrf-token'] ?? '')
      const body = request.postDataJSON(); assert.deepEqual(Object.keys(body).sort(), ['current_password', 'new_password'])
      if (network) {
        const commit = network === 'after'; network = ''
        if (commit) { const response = await route.fetch({ headers }); assert.equal(response.status(), 200); await response.dispose() }
        return route.abort('failed')
      }
    }
    return route.continue({ headers })
  })
  async function login(password) {
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username)
    await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await heading('Hesabım').waitFor(); await page.getByRole('heading', { name: 'Hesap bilgileri', exact: true }).waitFor()
  }
  async function fill(current, next, confirmation = next) {
    await page.locator('#account-current').fill(current); await page.locator('#account-next').fill(next); await page.locator('#account-confirmation').fill(confirmation)
  }
  const submit = () => page.getByRole('button', { name: 'Parolayı değiştir', exact: true }).click()
  const sql = async (sql, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  try {
    await page.goto(meta.origin + '/#/hesabim'); await heading('Giriş yapın').waitFor()
    assert.equal(await page.locator('.app-shell').count(), 0)
    await login(meta.fixture.password)
    await page.locator('.account-summary').getByText(meta.fixture.username, { exact: true }).waitFor()
    await page.locator('.account-summary').getByText('Çalışan', { exact: true }).waitFor()
    await page.locator('.account-summary').getByText('Aktif', { exact: true }).waitFor(); assert.ok(reads >= 2)
    pass('anonymous account route is protected; employee account data and status come from real /auth/me')
    await submit(); assert.equal(changes, 0); assert.equal(await page.locator('#account-current').getAttribute('aria-invalid'), 'true')
    const next = randomBytes(24).toString('base64url')
    await fill(meta.fixture.password, 'short'); await submit(); assert.equal(changes, 0)
    await fill(meta.fixture.password, next, next + 'x'); await submit(); assert.equal(changes, 0)
    await fill(meta.fixture.password, meta.fixture.password); await submit(); assert.equal(changes, 0)
    await fill(randomBytes(24).toString('base64url'), next); await submit()
    await page.getByText('Mevcut parolanız hatalı.', { exact: true }).waitFor(); assert.equal(changes, 1)
    assert.equal(await heading('Hesabım').count(), 1)
    pass('empty, weak, equal and mismatched inputs block submission; wrong current password displays API error and preserves session')
    await fill(meta.fixture.password, next); network = 'before'; await submit()
    await page.getByText(/Parola değişikliğinin sonucu doğrulanamadı/).waitFor(); assert.equal(await heading('Hesabım').count(), 1)
    assert.equal(await page.locator('#account-current').isDisabled(), true)
    await page.getByRole('button', { name: 'Oturumu kontrol et', exact: true }).click(); await page.locator('#account-current:not(:disabled)').waitFor()
    assert.equal(await page.locator('#account-current').inputValue(), '')
    pass('network failure makes no false logout/success claim; explicit real session check safely restores a fresh form')
    await fill(meta.fixture.password, next)
    const before = changes
    await page.locator('.account-password-form').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
    await heading('Giriş yapın').waitFor()
    await page.getByRole('status').getByText('Parolanız değiştirildi ve tüm oturumlarınız kapatıldı. Yeni parolanızla giriş yapın.', { exact: true }).waitFor()
    assert.equal(changes, before + 1); assert.ok(hasCsrf)
    assert.equal((await context.cookies(meta.origin)).some(cookie => cookie.name === 'akcat_session_dev'), false)
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    assert.equal((await sql('SELECT count(*) AS n FROM sessions WHERE user_id=? AND revoked_at IS NULL', [meta.fixture.id]))[0].n, 0)
    await login(next)
    pass('double submission sends one CSRF-protected change; server revokes sessions and cookie, memory-only success appears on login; new password works')
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id]); await page.reload()
    await page.locator('.account-summary').getByText('Admin', { exact: true }).waitFor()
    await page.locator('.desktop-sidebar').getByRole('link', { name: 'Hesabım', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 900 })
    await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click()
    await page.getByRole('dialog', { name: 'Ana menü' }).getByRole('link', { name: 'Hesabım', exact: true }).click()
    await page.getByRole('dialog', { name: 'Ana menü' }).waitFor({ state: 'hidden' })
    pass('both roles can open account; desktop user area and mobile drawer link work, including reselecting current account page')
    const final = randomBytes(24).toString('base64url')
    await fill(next, final); network = 'after'; await submit()
    await page.getByText(/Parola değişikliğinin sonucu doğrulanamadı/).waitFor()
    assert.equal(await heading('Hesabım').count(), 1)
    await page.getByRole('button', { name: 'Oturumu kontrol et', exact: true }).click(); await heading('Giriş yapın').waitFor()
    assert.equal(await page.getByText('Parolanız değiştirildi ve tüm oturumlarınız kapatıldı. Yeni parolanızla giriş yapın.', { exact: true }).count(), 0)
    await login(final)
    const audits = await sql("SELECT * FROM audit_logs WHERE entity_id=? AND action='auth.password_changed'", [meta.fixture.id])
    assert.equal(audits.length, 2)
    for (const password of [meta.fixture.password, next, final]) assert.ok(!JSON.stringify(audits).includes(password))
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    assert.deepEqual(errors, [])
    pass('lost response after real commit stays uncertain until /me confirms 401; no automatic replay or false success; final password works and audit/storage contain no passwords')
    return { passed, scope: 'Real React, Vite proxy, Workers and temporary isolated D1; no real accounts or remote writes. No visual design review.' }
  } finally { await context.close() }
}
