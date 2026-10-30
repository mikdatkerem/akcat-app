// Reusable Playwright-page checks against tests/serve-auth.mjs. No mocked API responses.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export async function verifyAuth(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(15_000)
  const passed = []
  function pass(label) { passed.push(label); console.log('PASS: ' + label) }
  const screenshots = []
  let blockMe = false
  let blockLogout = false
  let loginRequests = 0
  let logoutHasCsrf = false
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/v1/auth/login' && request.method() === 'POST') loginRequests++
    if (new URL(request.url()).pathname === '/api/v1/auth/logout') logoutHasCsrf = /^[A-Za-z0-9_-]{43}$/.test(request.headers()['x-csrf-token'] ?? '')
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== meta.origin) return route.continue()
    if (blockMe && url.pathname === '/api/v1/auth/me') return route.abort('internetdisconnected')
    if (blockLogout && url.pathname === '/api/v1/auth/logout') return route.abort('internetdisconnected')
    // Forward to the real isolated Worker. The guard is required only by its test entry point.
    return route.continue({ headers: { ...request.headers(), 'X-Test-Key': meta.key } })
  })
  const loginButton = () => page.getByRole('button', { name: 'Giriş Yap', exact: true })
  const logoutButton = () => page.locator('.desktop-sidebar').getByRole('button', { name: 'Çıkış Yap', exact: true })
  const title = name => page.getByRole('heading', { level: 1, name, exact: true })
  const sql = async (query, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST',
      headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: query, params }) })
    assert.equal(response.status, 200)
    return (await response.json()).results
  }
  try {
    // An initial network failure must never be treated as a missing session.
    blockMe = true
    await page.goto(meta.origin + '/#/musteriler')
    await title('Oturum kontrol edilemedi').waitFor()
    assert.equal(await loginButton().count(), 0)
    assert.equal(await page.locator('.app-shell').count(), 0)
    pass('initial network failure shows retry, not a login/logout assumption')
    blockMe = false
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
    await title('Giriş yapın').waitFor()
    assert.equal(await page.locator('.app-shell').count(), 0)
    pass('unauthenticated protected hash renders only login after actual API 401')

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const fit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      assert.ok(fit, `no horizontal overflow at ${width}px`)
      const box = await loginButton().boundingBox()
      assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= width && box.height >= 48)
      const path = join(meta.temporary, `login-${width}.png`)
      await page.screenshot({ path, fullPage: true })
      screenshots.push(path)
    }
    pass('320 / 390 / 1440 px form layout, touch targets and overflow')
    await page.setViewportSize({ width: 1440, height: 1000 })
    const username = page.getByLabel(/^Kullanıcı adı(?:\s|\*)*$/)
    const password = page.getByLabel(/^Parola(?:\s|\*)*$/)
    await loginButton().click()
    await page.getByText('Kullanıcı adınızı girin.', { exact: true }).waitFor()
    await page.getByText('Parolanızı girin.', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement.id), 'login-username')
    assert.equal(loginRequests, 0)
    await username.fill(meta.fixture.username)
    await loginButton().click()
    assert.equal(await page.evaluate(() => document.activeElement.id), 'login-password')
    assert.equal(loginRequests, 0)
    pass('empty input validation blocks HTTP submission and focuses invalid field')

    await password.focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Parolayı göster')
    await page.keyboard.press('Enter')
    assert.equal(await password.getAttribute('type'), 'text')
    await page.getByRole('button', { name: 'Parolayı gizle', exact: true }).click()
    assert.equal(await password.getAttribute('type'), 'password')
    pass('keyboard navigation and password show/hide')

    await password.fill(randomUUID())
    let responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST')
    await loginButton().click()
    assert.equal((await responsePromise).status(), 401)
    await page.getByText('Kullanıcı adı veya parola hatalı.', { exact: true }).waitFor()
    assert.equal(await page.locator('.app-shell').count(), 0)
    pass('real failed login displays the generic API error')

    await password.fill(meta.fixture.password)
    responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST')
    await password.press('Enter')
    assert.equal((await responsePromise).status(), 200)
    await title('Müşteriler').waitFor()
    assert.ok(await page.getByRole('navigation', { name: 'Ana navigasyon', exact: true }).isVisible())
    assert.equal(await page.locator('.account-details').first().innerText(), meta.fixture.username + '\nÇalışan')
    const cookies = await context.cookies(meta.origin)
    const session = cookies.find(cookie => cookie.name === 'akcat_session_dev')
    assert.ok(session?.httpOnly)
    assert.ok(!(await page.evaluate(() => document.cookie)).includes('akcat_session_dev'))
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 })
    pass('isolated employee login, real HttpOnly cookie, protected layout, no Web Storage tokens')

    const attempts = loginRequests
    await page.reload()
    await title('Müşteriler').waitFor()
    assert.equal(loginRequests, attempts)
    pass('reload restores session and protected hash through auth/me without another login')

    blockMe = true
    await page.evaluate(async () => { const store = await import('/src/auth/sessionStore.ts'); await store.checkSession() })
    await title('Müşteriler').waitFor()
    assert.equal(await loginButton().count(), 0)
    assert.equal(await page.locator('.app-shell').count(), 1)
    assert.equal(await page.evaluate(async () => (await import('/src/auth/sessionStore.ts')).sessionStore.getSnapshot().session !== null), true)
    blockMe = false
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
    await title('Müşteriler').waitFor()
    pass('temporary recheck failure preserves known session and recovers without login')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click()
    await page.getByRole('dialog', { name: 'Ana menü', exact: true }).waitFor()
    await page.getByRole('navigation', { name: 'Mobil navigasyon', exact: true }).getByRole('link', { name: 'Genel Bakış', exact: true }).click()
    await title('Genel Bakış').waitFor()
    assert.equal(await page.locator('#mobile-drawer').evaluate(element => element.open), false)
    await page.setViewportSize({ width: 1440, height: 1000 })
    assert.equal(await page.getByRole('button', { name: 'Bağlantıyı kontrol et', exact: true }).count(), 0)
    pass('authenticated mobile drawer navigation and existing real health request')

    blockLogout = true
    await logoutButton().click()
    await page.getByRole('heading', { name: 'Oturum işlemi tamamlanamadı', exact: true }).waitFor()
    assert.equal(await page.locator('.app-shell').count(), 1)
    assert.ok(logoutHasCsrf)
    blockLogout = false
    await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
    await title('Genel Bakış').waitFor()
    await logoutButton().waitFor()
    responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/logout'))
    await logoutButton().click()
    assert.equal((await responsePromise).status(), 200)
    await title('Giriş yapın').waitFor()
    const [revoked] = await sql('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ? AND revoked_at IS NOT NULL', [meta.fixture.id])
    assert.equal(revoked.count, 1)
    assert.equal((await context.cookies(meta.origin)).some(cookie => cookie.name === 'akcat_session_dev'), false)
    pass('failed logout keeps session; successful CSRF logout revokes D1 session and clears cookie')

    await username.fill(meta.fixture.username)
    await password.fill(meta.fixture.password)
    await loginButton().click()
    await title('Genel Bakış').waitFor()
    await sql('UPDATE sessions SET expires_at=? WHERE user_id=? AND revoked_at IS NULL', [new Date(Date.now() - 60000).toISOString(), meta.fixture.id])
    await page.reload()
    await title('Giriş yapın').waitFor()
    assert.equal(await page.locator('.app-shell').count(), 0)
    pass('expired session actual API 401 removes protected layout')
    assert.deepEqual(errors, [])
    pass('no browser JavaScript errors')
    return { passed, screenshots, scope: 'Real React + Vite proxy + Workers + isolated temporary D1; no real admin.' }
  } finally { await context.close() }
}
