import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function verifyDashboardFilters(browserPage, metadataPath) {
  const meta = JSON.parse(await readFile(metadataPath, 'utf8'))
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), passed = [], screenshots = [], errors = [], requests = [], keys = [], bodies = []
  let health = 0, lose = false, loseDelete = false, failPayments = false
  const deleteKeys = []
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message))
  const sql = async (sql, params = []) => { const response = await fetch(meta.api + '/__test/sql', { method: 'POST', headers: { 'X-Test-Key': meta.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) }); assert.equal(response.status, 200); return (await response.json()).results }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), headers = { ...request.headers(), 'X-Test-Key': meta.key }
    if (url.pathname === '/api/health') health++
    if (url.pathname.startsWith('/api/v1/customers/') && request.method() === 'DELETE') {
      deleteKeys.push(headers['idempotency-key'])
      if (loseDelete) { loseDelete = false; const response = await route.fetch({ headers }); assert.equal(response.status(), 200); await response.dispose(); return route.abort('failed') }
    }
    if (url.pathname === '/api/v1/payments' && request.method() === 'GET') { requests.push(url.search); if (failPayments) headers['X-Test-Mode'] = 'finance-db-error' }
    if (url.pathname === '/api/v1/sales' && request.method() === 'POST') {
      keys.push(headers['idempotency-key']); bodies.push(request.postDataJSON())
      if (lose) { lose = false; const response = await route.fetch({ headers }); assert.equal(response.status(), 201); await response.dispose(); return route.abort('failed') }
    }
    return route.continue({ headers })
  })
  const title = name => page.getByRole('heading', { name, exact: true, level: 1 })
  const hash = async value => { await page.evaluate(value => { location.hash = value }, value) }
  const fit = async label => {
    for (const width of [320,360,390,430,768,1024,1440]) {
      await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0,0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: ${width}px overflow`)
      if (label === 'dashboard') {
        assert.ok(await page.locator('.overview-welcome').evaluate(async hero => {
          const source = /^url\(["']?(.*?)["']?\)$/.exec(getComputedStyle(hero).backgroundImage)?.[1]
          if (!source) return false
          const image = new Image(); image.src = source
          await image.decode()
          const box = hero.getBoundingClientRect(), content = hero.querySelector('.overview-welcome__content').getBoundingClientRect()
          return image.complete && image.naturalWidth === 1672 && image.naturalHeight === 941
            && content.height < box.height && content.left > box.left && content.right < box.right
        }), `${width}px dashboard image did not load`)
        for (const action of ['Yeni Satış','Hızlı Satış']) {
          const box = await page.locator('.overview-welcome').getByRole('link', { name: action, exact: true }).boundingBox()
          assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.height >= 44)
        }
        const path = join(tmpdir(), `akcat-dashboard-${width}.png`)
        await page.screenshot({ path, fullPage: true }); screenshots.push(path)
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  try {
    await page.goto(meta.origin + '/#/genel-bakis')
    await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username); await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password)
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click(); await title('Genel Bakış').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Özeti Yenile', exact: true }).count(), 0)
    assert.equal(await page.locator('.dashboard-report').count(), 0)
    assert.equal(health, 0); assert.equal(await page.getByRole('button', { name: 'Bağlantıyı kontrol et', exact: true }).count(), 0)
    await fit('dashboard'); passed.push('dashboard fits 320/360/390/430/768/1024/1440px; employee sees no summary or health section and sends no health requests')
    const hero = page.locator('.overview-welcome')
    await hero.getByRole('link', { name: 'Hızlı Satış', exact: true }).click(); await title('Yeni Satış').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Hızlı Satış', exact: true }).getAttribute('aria-pressed'), 'true')
    const auth = await (await context.request.get(meta.origin + '/api/v1/auth/me', { headers: { 'X-Test-Key': meta.key } })).json()
    const post = async (path, data) => { const response = await context.request.post(meta.origin + '/api/v1/' + path, { headers: { 'X-Test-Key': meta.key, Origin: meta.origin, 'X-CSRF-Token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data }); assert.equal(response.status(), 201, await response.text()); return (await response.json()).data }
    await sql("UPDATE users SET role='admin' WHERE id=?", [meta.fixture.id]); await page.reload()
    const product = await post('products', { name: 'İzole arayüz ürünü', current_price_kurus: 200000 })
    const a = await post('customers', { name: 'İpek filtre müşterisi', address: 'İzole test adresi' })
    const b = await post('customers', { name: 'Diğer müşteri', address: 'İzole test adresi' })
    const sale = (customer, paid) => post('sales', { customer_id: customer.id, items: [{ product_id: product.id, quantity: 1, expected_list_price_kurus: 200000 }], payment: { amount_kurus: paid, method: 'cash' } })
    await sale(a, 150000); await sale(b, 100000)
    await hash('#/genel-bakis'); await page.getByRole('button', { name: 'Bağlantıyı kontrol et', exact: true }).click(); await page.getByText('Bağlantı başarılı', { exact: true }).waitFor(); assert.equal(health, 1)
    await hero.getByRole('link', { name: 'Hızlı Satış', exact: true }).click()
    await page.getByLabel('Müşteri Adı (İsteğe Bağlı)').fill('Korunan taslak adı')
    await page.getByRole('button', { name: product.name + ' seç', exact: true }).click()
    await hash('#/genel-bakis'); await hero.getByRole('link', { name: 'Yeni Satış', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Normal Satış', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByLabel(product.name + ' miktarı').inputValue(), '1')
    await page.getByRole('button', { name: 'Hızlı Satış', exact: true }).click(); assert.equal(await page.getByLabel('Müşteri Adı (İsteğe Bağlı)').inputValue(), 'Korunan taslak adı')
    lose = true; await page.getByRole('button', { name: 'Satışı Kaydet', exact: true }).click(); await page.getByRole('heading', { name: 'Satış kaydı doğrulanamadı', exact: true }).waitFor()
    await hash('#/genel-bakis'); await hero.getByRole('link', { name: 'Yeni Satış', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Hızlı Satış', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByRole('button', { name: 'Normal Satış', exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: 'Aynı satışı tekrar dene', exact: true }).click(); await title('Satış detayı').waitFor()
    assert.equal(keys[0], keys[1]); assert.deepEqual(bodies[0], bodies[1]); passed.push('requested sale mode opens; draft fields survive navigation; ambiguous requests retain original mode, payload and key')
    await hash('#/musteriler'); await page.locator('.customer-more').first().waitFor()
    const buttons = page.locator('.customer-more'), popup = page.locator('.customer-action-popover:popover-open')
    await buttons.first().focus(); await page.keyboard.press('ArrowDown'); await popup.waitFor(); assert.equal(await popup.getByRole('menuitem').first().evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('End'); assert.equal(await popup.getByRole('menuitem', { name: 'Sil', exact: true }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Escape'); assert.equal(await popup.count(), 0); assert.equal(await buttons.first().evaluate(el => el === document.activeElement), true)
    await buttons.nth(1).click(); await buttons.first().click(); assert.equal(await popup.count(), 1)
    await page.waitForFunction(() => document.querySelectorAll('.customer-more')[1].getAttribute('aria-expanded') === 'false')
    await page.getByRole('heading', { name: 'Müşteriler', exact: true }).click(); assert.equal(await popup.count(), 0)
    for (const width of [320,360,390,430,768,1024,1440]) {
      await page.setViewportSize({ width, height: 1000 }); await buttons.first().click()
      const box = await popup.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 1000)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.keyboard.press('Escape')
    }
    await buttons.first().click(); await popup.getByRole('menuitem', { name: 'Düzenle', exact: true }).click(); await title('Müşteriyi düzenle').waitFor(); assert.equal(await popup.count(), 0)
    await hash('#/musteriler'); await buttons.first().click(); await popup.getByRole('menuitem', { name: 'Sil', exact: true }).click(); await page.getByRole('dialog').waitFor(); assert.equal(await popup.count(), 0)
    await page.getByRole('button', { name: 'Vazgeç', exact: true }).click(); assert.equal(await buttons.first().evaluate(el => el === document.activeElement), true)
    await buttons.first().click(); await popup.getByRole('menuitem', { name: 'Pasife al', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Müşteri pasife alındı' }).waitFor()
    await buttons.first().click(); await popup.getByRole('menuitem', { name: 'Aktifleştir', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Müşteri yeniden aktifleştirildi' }).waitFor()
    const disposable = await post('customers', { name: 'Silinebilir izole müşteri', address: 'İzole adres' })
    await page.reload()
    await page.getByRole('button', { name: disposable.name + ' müşteri işlemleri', exact: true }).click()
    await popup.getByRole('menuitem', { name: 'Sil', exact: true }).click(); loseDelete = true
    await page.getByRole('button', { name: 'Kalıcı olarak sil', exact: true }).click()
    await page.getByRole('dialog').getByRole('alert').waitFor()
    await page.getByRole('button', { name: 'Kalıcı olarak sil', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Müşteri kalıcı olarak silindi' }).waitFor()
    assert.equal(deleteKeys[0], deleteKeys[1]); assert.equal((await sql('SELECT count(*) AS n FROM customers WHERE id=?', [disposable.id]))[0].n, 0)
    await sql("UPDATE users SET role='employee' WHERE id=?", [meta.fixture.id]); await page.reload(); await buttons.first().click()
    assert.deepEqual(await popup.getByRole('menuitem').allTextContents(), ['Müşteriyi Görüntüle','Düzenle']); await page.keyboard.press('Escape')
    passed.push('ellipsis: keyboard/focus, exclusivity, outside/Escape, viewport bounds, edit, activate/deactivate and deletion with lost-response idempotent retry work; employee sees view/edit only')
    await hash('#/tahsilatlar'); await page.locator('.finance-history > li').first().waitFor()
    const filters = page.getByRole('button', { name: /^Filtreler/ })
    assert.equal(await filters.getAttribute('aria-expanded'), 'false')
    assert.equal(await page.getByLabel('Minimum tutar (₺)', { exact: true }).isVisible(), false)
    await filters.focus(); await page.keyboard.press('Enter')
    assert.equal(await page.getByLabel('Minimum tutar (₺)', { exact: true }).isVisible(), true)
    await page.getByLabel('Minimum tutar (₺)', { exact: true }).fill('25,50')
    await filters.click(); assert.equal(await page.getByLabel('Minimum tutar (₺)', { exact: true }).isVisible(), false)
    await filters.click(); assert.equal(await page.getByLabel('Minimum tutar (₺)', { exact: true }).inputValue(), '25,50')
    await page.getByLabel('Minimum tutar (₺)', { exact: true }).fill('2000'); await page.getByLabel('Maksimum tutar (₺)', { exact: true }).fill('500')
    const before = requests.length; await page.getByRole('button', { name: 'Filtrele', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Minimum tutar' }).waitFor(); assert.equal(requests.length, before)
    await page.getByLabel('Minimum tutar (₺)', { exact: true }).fill('1499,99'); await page.getByLabel('Maksimum tutar (₺)', { exact: true }).fill('1500')
    await page.getByLabel('Müşteri adı', { exact: true }).fill('ipek'); await page.getByLabel('Ödeme yöntemi filtresi').selectOption('cash')
    const filtered = page.waitForResponse(r => { const u = new URL(r.url()); return u.pathname === '/api/v1/payments' && u.searchParams.get('min_amount_kurus') === '149999' })
    await page.getByRole('button', { name: 'Filtrele', exact: true }).click(); const response = await filtered; assert.equal(response.status(), 200)
    assert.equal(new URL(response.url()).searchParams.get('max_amount_kurus'), '150000'); assert.equal(new URL(response.url()).searchParams.get('page'), '1')
    await page.getByRole('status').filter({ hasText: '1 kayıt' }).waitFor(); assert.equal(await page.locator('.finance-history > li').count(), 1)
    await fit('payment filters'); await page.getByRole('button', { name: 'Temizle', exact: true }).click(); await page.getByRole('status').filter({ hasText: '3 kayıt' }).waitFor()
    failPayments = true; await page.reload(); await page.getByRole('heading', { name: 'Tahsilatlar yüklenemedi', exact: true }).waitFor(); assert.equal(await page.locator('.finance-history > li').count(), 0); failPayments = false
    await hash('#/veresiye'); await page.locator('.finance-customer-name').first().waitFor()
    assert.equal(await filters.getAttribute('aria-expanded'), 'false'); await filters.click()
    await page.getByLabel('Minimum borç (₺)', { exact: true }).fill('500'); await page.getByLabel('Maksimum borç (₺)', { exact: true }).fill('500')
    await page.getByRole('button', { name: 'Filtrele', exact: true }).click(); await page.getByRole('status').filter({ hasText: '1 kayıt' }).waitFor(); assert.equal(await page.locator('.finance-customer-name').innerText(), a.name)
    assert.equal(await filters.getAttribute('aria-expanded'), 'false'); await filters.click()
    await fit('debt filters'); await page.getByRole('button', { name: 'Temizle', exact: true }).click(); await page.getByRole('status').filter({ hasText: '2 kayıt' }).waitFor()
    passed.push('filter panels start closed, open via click/keyboard and retain drafts on toggle; filters send exact kuruş, reject reversed bounds, reset pagination, intersect search/method, clear and preserve API errors')
    assert.deepEqual(errors, []); return { passed, screenshots }
  } finally { await context.close() }
}
