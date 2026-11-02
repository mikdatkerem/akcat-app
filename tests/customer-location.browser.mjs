import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
export async function verifyCustomerLocation(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage(), errors = [], passed = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => { if (/violates.*Content Security Policy|Refused to.*(?:style|script)/i.test(message.text())) errors.push(message.text().slice(0, 300)) })
  // Load the real production build with the Static Assets CSP (not Vite's dev HTML).
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8')
  const csp = headers.match(/Content-Security-Policy: (.+)/)[1]
  await page.route(meta.origin + '/', async route => route.fulfill({
    contentType: 'text/html', headers: { 'Content-Security-Policy': csp },
    body: await readFile(new URL('../dist/client/index.html', import.meta.url)),
  }))
  await page.route(meta.origin + '/assets/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()
    assert.match(name, /^[a-zA-Z0-9_.-]+$/)
    const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'image/png'
    return route.fulfill({ contentType, body: await readFile(new URL('../dist/client/assets/' + name, import.meta.url)) })
  })
  let tileRequests = 0
  // External services are deliberately offline in isolated tests; no customer data leaves the test environment.
  await context.route('https://tile.openstreetmap.org/**', r => { tileRequests++; return r.abort() })
  await page.route('**/api/**', r => r.continue({ headers: { ...r.request().headers(), 'X-Test-Key': meta.key } }))
  try {
    const response = await context.request.post(meta.origin + '/api/v1/auth/login', { headers: { Origin: meta.origin, 'X-Test-Key': meta.key }, data: { username: meta.fixture.username, password: meta.fixture.password } })
    assert.equal(response.status(), 200)
    await page.goto(meta.origin + '/#/musteriler/yeni')
    const address = page.locator('textarea[name=address]')
    await address.fill('İzole korunacak manuel adres')
    assert.equal(tileRequests, 0)
    await page.getByRole('button', { name: 'Haritadan Seç' }).click()
    const modal = page.getByRole('dialog', { name: 'Konum Seç' })
    await modal.locator('.leaflet-container').waitFor()
    assert.equal(await modal.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(25, 25, 25)')
    assert.equal(await modal.getByText('Harita açıldığında', { exact: false }).count(), 0)
    await modal.locator('.customer-map').tap({ position: { x: 100, y: 100 } })
    await modal.locator('.leaflet-marker-icon').waitFor()
    await modal.getByRole('button', { name: 'İptal', exact: true }).click()
    assert.equal(await address.inputValue(), 'İzole korunacak manuel adres')
    passed.push('iptal mevcut adresi ve koordinatsız formu korur; harita önceden yüklenmez')
    await page.getByRole('button', { name: 'Haritadan Seç' }).click()
    await modal.locator('.leaflet-container').waitFor()
    for (const width of [320, 360, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      assert.ok(await modal.evaluate(e => e.scrollWidth <= e.clientWidth), `${width}: dialog overflow`)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      const b = await modal.getByRole('button', { name: 'Konumu Kullan' }).boundingBox()
      assert.ok(b.y + b.height <= 844 && b.y >= 0)
    }
    passed.push('320/360/390/430/1440 px modal ve sabit alt aksiyonlar taşmaz')
    await page.setViewportSize({ width: 390, height: 400 })
    const compactButton = await modal.getByRole('button', { name: 'Konumu Kullan' }).boundingBox()
    assert.ok(compactButton.y >= 0 && compactButton.y + compactButton.height <= 400)
    await page.setViewportSize({ width: 390, height: 844 })
    const mapArea = modal.locator('.customer-map')
    await mapArea.tap({ position: { x: 100, y: 100 } })
    await modal.locator('.leaflet-marker-icon').waitFor()
    await modal.getByRole('button', { name: 'Yakınlaştır', exact: true }).click()
    await modal.getByRole('button', { name: 'Uzaklaştır', exact: true }).click()
    await modal.locator('.customer-map').tap({ position: { x: 100, y: 100 } })
    await modal.locator('.leaflet-marker-icon').waitFor()
    const failed = page.waitForResponse(r => r.url().includes('/customers/resolve-location'))
    await modal.getByRole('button', { name: 'Konumu Kullan', exact: true }).click()
    assert.equal((await failed).status(), 503)
    await modal.getByRole('alert').waitFor()
    assert.equal(await modal.locator('.leaflet-marker-icon').count(), 1)
    assert.equal(await address.inputValue(), 'İzole korunacak manuel adres')
    await modal.getByRole('button', { name: 'İptal', exact: true }).click()
    // Simulate only the external geocoder contract, never customer CRUD or D1 responses.
    await page.route('**/api/v1/customers/resolve-location', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ address: 'İzole seçilen adres' }) }))
    await page.getByRole('button', { name: 'Haritadan Seç' }).click()
    await modal.locator('.leaflet-container').waitFor()
    await modal.locator('.customer-map').tap({ position: { x: 100, y: 100 } })
    assert.equal(await modal.getByRole('button', { name: 'Haritanın merkezini seç' }).count(), 0)
    assert.equal(await modal.getByRole('button', { name: 'Adresi bul', exact: true }).count(), 0)
    await modal.getByRole('button', { name: 'Konumu Kullan' }).click()
    await modal.waitFor({ state: 'detached' })
    assert.equal(await address.inputValue(), 'İzole seçilen adres')
    assert.equal(await page.getByText('Harita konumu seçildi.', { exact: false }).count(), 1)
    passed.push('başarısız sorgu formu değiştirmez; Konumu Kullan adresi otomatik çözümler ve aktarır (geocoder sözleşme testi)')
    await page.getByRole('button', { name: 'Haritadan Seç' }).click()
    await modal.locator('.leaflet-marker-icon').waitFor()
    await page.keyboard.press('Escape')
    await modal.waitFor({ state: 'detached' })
    assert.ok(await page.getByRole('button', { name: 'Haritadan Seç' }).evaluate(e => e === document.activeElement))
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '')
    assert.equal(await address.inputValue(), 'İzole seçilen adres')
    passed.push('mevcut nokta tekrar açılır; Escape, odak iadesi ve kaydırma kilidi çalışır')
    await page.getByLabel('Müşteri adı', { exact: false }).fill('İzole harita akışı')
    const created = page.waitForResponse(r => r.url().endsWith('/api/v1/customers') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Müşteriyi kaydet', exact: true }).click()
    const savedResponse = await created; assert.equal(savedResponse.status(), 201)
    const saved = (await savedResponse.json()).data
    assert.equal(saved.address, 'İzole seçilen adres'); assert.equal(typeof saved.latitude, 'number'); assert.equal(typeof saved.longitude, 'number')
    await page.getByRole('heading', { name: saved.name, exact: true }).waitFor()
    const directions = page.getByRole('link', { name: /^Yol Tarifi Al/ })
    assert.equal(new URL(await directions.getAttribute('href')).searchParams.get('destination'), `${saved.latitude},${saved.longitude}`)
    await page.goto(meta.origin + '/#/musteriler/' + saved.id + '/duzenle')
    await page.getByRole('button', { name: 'Haritadan Seç' }).click()
    await modal.locator('.leaflet-marker-icon').waitFor()
    await modal.getByRole('button', { name: 'İptal', exact: true }).click()
    assert.equal(await address.inputValue(), saved.address)
    passed.push('form Kaydet ile koordinatları gerçek izole API’ye yazar; detay koordinatla rota açar; düzenleme noktayı korur')
    assert.deepEqual(errors, [])
    return { passed }
  } finally { await context.close() }
}
