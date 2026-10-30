import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function verifyReliability(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext()
  const page = await context.newPage(), passed = []
  page.setDefaultTimeout(15000)
  const sql = async (sql, params = []) => {
    const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) })
    assert.equal(response.status, 200); return (await response.json()).results
  }
  let failMe = false
  await page.route('**/api/**', route => {
    if (failMe && new URL(route.request().url()).pathname === '/api/v1/auth/me') return route.abort('failed')
    return route.continue({ headers: { ...route.request().headers(), 'X-Test-Key': meta.key } })
  })
  const title = name => page.getByRole('heading', { name, exact: true, level: 1 })
  try {
    await sql("UPDATE users SET role='admin',is_active=1 WHERE id=?", [meta.fixture.id])
    await page.goto(meta.origin)
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username)
    await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click()
    await title('Genel Bakış').waitFor()
    const me = await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } }), auth = await me.json()
    const post = async (path, data) => {
      const response = await context.request.post(meta.origin + '/api/v1/' + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), 201); return (await response.json()).data
    }
    const customer = await post('customers', { name: 'İzole taslak müşterisi ' + randomUUID(), address: 'İzole test adresi' })
    const product = await post('products', { name: 'İzole fiyat ürünü ' + randomUUID(), current_price_kurus: 10000 })
    for (const [path, heading, label] of [['musteriler/yeni','Yeni müşteri','Müşteri adı'], ['urunler/yeni','Yeni ürün','Ürün adı'], ['calisanlar/yeni','Çalışan ekle','Kullanıcı adı']]) {
      await page.goto(meta.origin + '/#/' + path)
      // Account route names are verified against the real routing in the app.
      await title(heading).waitFor()
      const field = page.getByLabel(label, { exact: false }).first()
      await field.fill('Kaybolmayan taslak')
      await page.evaluate(async () => { const { checkSession } = await import('/src/auth/sessionStore.ts'); await checkSession() })
      assert.equal(await field.inputValue(), 'Kaybolmayan taslak')
      failMe = true
      await page.evaluate(async () => { const { checkSession } = await import('/src/auth/sessionStore.ts'); await checkSession() })
      assert.equal(await field.inputValue(), 'Kaybolmayan taslak')
      failMe = false
      passed.push(path + ': successful and failed session rechecks retain the form')
    }
    await page.goto(meta.origin + '/#/satislar/yeni'); await title('Yeni Satış').waitFor()
    await page.getByRole('searchbox', { name: 'Müşteri ara', exact: true }).fill(customer.name)
    await page.getByRole('search', { name: 'Müşteri ara', exact: true }).getByRole('button', { name: 'Ara', exact: true }).click()
    await page.getByRole('button', { name: customer.name + ' seç', exact: true }).click()
    await page.getByRole('button', { name: product.name + ' seç', exact: true }).click()
    await sql('UPDATE products SET current_price_kurus=12000 WHERE id=?', [product.id])
    await page.getByRole('button', { name: 'Satışı Kaydet', exact: true }).click()
    await page.getByRole('button', { name: 'Yeni fiyatı kabul et', exact: true }).waitFor()
    assert.equal((await sql('SELECT count(*) AS n FROM sales WHERE customer_id=?', [customer.id]))[0].n, 0)
    assert.equal(await page.getByLabel(product.name + ' miktarı').inputValue(), '1')
    await page.getByRole('button', { name: 'Yeni fiyatı kabul et', exact: true }).click()
    assert.match(await page.locator('.sale-totals dd').first().innerText(), /120,00/)
    await page.getByRole('button', { name: 'Satışı Kaydet', exact: true }).click()
    await title('Satış detayı').waitFor()
    passed.push('stale price prevents writes; explicit acceptance retains draft and shows the new total')
    let release, started
    const waiting = new Promise(resolve => { started = resolve })
    const hold = new Promise(resolve => { release = resolve })
    await page.route('**/api/v1/sales/*/cancel', async route => {
      const response = await route.fetch({ headers: { ...route.request().headers(), 'X-Test-Key': meta.key } })
      started(); await hold; await route.fulfill({ response })
    })
    await page.getByRole('button', { name: 'Satışı İptal Et', exact: true }).click()
    await page.getByLabel('Gerekçe', { exact: false }).fill('İzole modal testi')
    await page.getByRole('button', { name: 'İptali Onayla', exact: true }).click()
    await waiting
    await page.keyboard.press('Escape'); await page.mouse.click(1, 1)
    assert.equal(await page.locator('dialog[open]').count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Vazgeç', exact: true }).isDisabled(), true)
    release(); await page.locator('dialog[open]').waitFor({ state: 'detached' })
    passed.push('pending cancellation resists Escape/backdrop and completes exactly once')
    const patch = async (path, data) => {
      const response = await context.request.patch(meta.origin + '/api/v1/' + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data })
      assert.equal(response.status(), 200); return (await response.json()).data
    }
    for (const [resource, record, route, fieldName] of [['products', product, 'urunler', 'Ürün adı'], ['customers', customer, 'musteriler', 'Müşteri adı']]) {
      await page.goto(meta.origin + '/#/' + route + '/' + record.id + '/duzenle')
      const field = page.getByLabel(fieldName, { exact: false }).first()
      await field.fill('Korunan kullanıcı değişikliği')
      await patch(resource + '/' + record.id, { name: 'Eşzamanlı sunucu değişikliği', expected_version: 1 })
      await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click()
      await page.getByRole('button', { name: 'Güncel bilgileri yükle', exact: true }).waitFor()
      assert.equal(await field.inputValue(), 'Korunan kullanıcı değişikliği')
      await page.getByRole('button', { name: 'Güncel bilgileri yükle', exact: true }).click()
      await page.getByText('Düzenlediğiniz alanlar korundu. Güncel kayıtla karşılaştırıp tekrar onaylayın.', { exact: true }).waitFor()
      assert.equal(await field.inputValue(), 'Korunan kullanıcı değişikliği')
      await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click()
      await title(resource === 'products' ? 'Korunan kullanıcı değişikliği' : 'Korunan kullanıcı değişikliği').waitFor()
      assert.equal((await sql('SELECT version FROM ' + resource + ' WHERE id=?', [record.id]))[0].version, 3)
      passed.push(resource + ': conflict preserves input and requires refresh and explicit resubmission')
    }
    await page.goto(meta.origin + '/#/urunler/' + product.id + '/duzenle')
    await page.getByLabel('Satış fiyatı (₺)', { exact: false }).fill('160,25')
    let lost = false
    const keys = []
    await page.route('**/api/v1/products/' + product.id, async route => {
      const headers = { ...route.request().headers(), 'X-Test-Key': meta.key }
      if (route.request().method() !== 'PATCH') return route.continue({ headers })
      keys.push(headers['idempotency-key'])
      if (!lost) { lost = true; const response = await route.fetch({ headers }); assert.equal(response.status(), 200); await response.dispose(); return route.abort('failed') }
      return route.continue({ headers })
    })
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click()
    await page.getByText('Yanıt doğrulanamadı. Bilgiler kilitlendi; aynı güncellemeyi tekrar deneyin.', { exact: true }).waitFor()
    await patch('products/' + product.id, { name: 'Sonraki düzenleme korunmalı', expected_version: 4 })
    await page.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click()
    await title('Sonraki düzenleme korunmalı').waitFor()
    assert.equal(keys.length, 2); assert.equal(keys[0], keys[1])
    const current = (await sql('SELECT name,current_price_kurus,version FROM products WHERE id=?', [product.id]))[0]
    assert.equal(current.current_price_kurus, 16025); assert.equal(current.version, 5)
    passed.push('lost PATCH response reuses original key; replay leaves later edits intact')
    await page.getByRole('heading', { name: 'Fiyat geçmişi', exact: true }).waitFor()
    await page.getByText(/160,25/).first().waitFor()
    await page.locator('.product-price-history li').waitFor()
    assert.match(await page.locator('.product-price-history').innerText(), /120,00/)
    assert.match(await page.locator('.product-price-history').innerText(), /160,25/)
    for (const width of [320,390,1440]) {
      await page.setViewportSize({ width, height: 950 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `price history overflow at ${width}`)
    }
    assert.equal((await sql("SELECT count(*) AS n FROM audit_logs WHERE entity_id=? AND action='product.updated' AND json_type(metadata,'$.old_price_kurus')='integer'", [product.id]))[0].n, 1)
    await page.goto(meta.origin + '/#/urunler/' + (await post('products', { name: 'İzole geçmişsiz ürün', current_price_kurus: 5000 })).id)
    await page.getByRole('heading', { name: 'Henüz fiyat değişikliği yok', exact: true }).waitFor()
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id])
    let historyRequests = 0
    page.on('request', request => { if (request.url().includes('/price-history')) historyRequests++ })
    await page.reload(); await title('İzole geçmişsiz ürün').waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Fiyat geçmişi', exact: true }).count(), 0)
    assert.equal(historyRequests, 0)
    passed.push('price history uses real audit values, has a genuine empty state and is not requested by employees')
    return { passed }
  } finally { await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id]); await context.close() }
}
