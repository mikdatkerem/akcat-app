import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function verifyWalkIn(browserPage, metadataPath) {
  const meta=JSON.parse(await readFile(metadataPath,'utf8')), context=await browserPage.context().browser().newContext({viewport:{width:1440,height:1000}})
  const page=await context.newPage(), passed=[], errors=[], keys=[], payloads=[]
  page.setDefaultTimeout(15000); page.on('pageerror',error=>errors.push(error.message))
  let lose=false
  await page.route('**/api/**',async route=>{
    const request=route.request(), headers={...request.headers(),'X-Test-Key':meta.key}
    if(new URL(request.url()).pathname==='/api/v1/sales' && request.method()==='POST') {
      keys.push(headers['idempotency-key']);payloads.push(request.postDataJSON())
      if(lose){lose=false;const actual=await route.fetch({headers});assert.equal(actual.status(),201);await actual.dispose();return route.abort('failed')}
    }
    return route.continue({headers})
  })
  const sql=async(sql,params=[])=>{const response=await fetch(meta.api+'/__test/sql',{method:'POST',headers:{'X-Test-Key':meta.key,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});assert.equal(response.status,200);return(await response.json()).results}
  const title=name=>page.getByRole('heading',{name,exact:true,level:1})
  const quick=()=>page.getByRole('button',{name:'Hızlı Satış',exact:true}), normal=()=>page.getByRole('button',{name:'Normal Satış',exact:true})
  const save=()=>page.getByRole('button',{name:'Satışı Kaydet',exact:true})
  const fit=async label=>{for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+':'+width)}await page.setViewportSize({width:1440,height:1000})}
  try{
    await page.goto(meta.origin+'/#/satislar/yeni');await page.getByLabel(/^Kullanıcı adı/).fill(meta.fixture.username);await page.getByLabel(/^Parola(?:\s|\*)*$/).fill(meta.fixture.password);await page.getByRole('button',{name:'Giriş Yap',exact:true}).click();await title('Yeni Satış').waitFor()
    const auth=await(await context.request.get(meta.origin+'/api/v1/auth/me',{headers:{'X-Test-Key':meta.key}})).json()
    const post=async(path,data)=>{const response=await context.request.post(meta.origin+'/api/v1/'+path,{headers:{'X-Test-Key':meta.key,Origin:meta.origin,'X-CSRF-Token':auth.csrfToken,'Idempotency-Key':randomUUID()},data});assert.equal(response.status(),201);return(await response.json()).data}
    const customer=await post('customers',{name:'İzole normal müşteri',address:'Yalnızca test adresi'})
    await sql("UPDATE users SET role='admin' WHERE id=?",[meta.fixture.id])
    const product=await post('products',{name:'İzole tezgâh ürünü',current_price_kurus:15000})
    await sql("UPDATE users SET role='employee' WHERE id=?",[meta.fixture.id])
    await page.reload();await title('Yeni Satış').waitFor()
    await page.getByRole('button',{name:customer.name+' seç',exact:true}).click();await page.getByRole('button',{name:product.name+' seç',exact:true}).click()
    await page.getByLabel('Alınan ödeme (₺)',{exact:false}).fill('50');await page.getByLabel('Ödeme yöntemi',{exact:false}).selectOption('bank')
    await quick().click()
    assert.equal(await page.getByRole('searchbox',{name:'Müşteri ara',exact:true}).count(),0);assert.equal(await page.getByLabel('Alınan ödeme (₺)',{exact:false}).count(),0)
    assert.deepEqual(await page.getByLabel('Ödeme yöntemi',{exact:false}).locator('option').allTextContents(),['Nakit','Kart'])
    await page.getByLabel('Müşteri Adı (İsteğe Bağlı)').fill('Ayşe & <img src=x onerror="window.__xss=1">')
    await page.getByLabel('Ödeme yöntemi',{exact:false}).selectOption('card')
    await normal().click();assert.equal(await page.getByLabel('Alınan ödeme (₺)',{exact:false}).inputValue(),'50');assert.equal(await page.getByLabel('Ödeme yöntemi',{exact:false}).inputValue(),'bank')
    await quick().click();assert.equal(await page.getByLabel('Ödeme yöntemi',{exact:false}).inputValue(),'card')
    await page.getByLabel(product.name+' birim fiyatı (₺)').fill('120')
    await page.getByRole('button',{name:product.name+' liste fiyatına dön',exact:true}).click()
    assert.equal(await page.getByLabel(product.name+' birim fiyatı (₺)').inputValue(),'150,00')
    await page.getByLabel(product.name+' birim fiyatı (₺)').fill('119,99');await page.getByLabel(product.name+' miktarı').fill('3')
    assert.match(await page.locator('.sale-totals dd').first().innerText(),/359,97/)
    await fit('quick form');await sql('UPDATE products SET current_price_kurus=17000 WHERE id=?',[product.id])
    lose=true;await save().click();await page.getByRole('heading',{name:'Satış kaydı doğrulanamadı',exact:true}).waitFor()
    assert.equal(await quick().isDisabled(),true)
    await page.getByRole('button',{name:'Aynı satışı tekrar dene',exact:true}).click();await title('Satış detayı').waitFor()
    assert.equal(keys[0],keys[1]);assert.deepEqual(payloads[0],payloads[1]);assert.equal(payloads[0].customer_id,null)
    assert.equal((await sql('SELECT count(*) AS n FROM customers'))[0].n,1)
    assert.equal(await page.getByRole('link',{name:'Yol Tarifi Al',exact:true}).count(),0);assert.equal(await page.getByText('Telefon',{exact:true}).count(),0)
    assert.equal(await page.locator('img[onerror]').count(),0)
    await fit('quick detail');passed.push('mode switch preserves normal draft and keeps payment methods separate; optional name, custom price, full card payment and lost-response retry work without creating customers')
    await page.goto(meta.origin+'/#/satislar/yeni');await quick().click();await page.getByRole('button',{name:product.name+' seç',exact:true}).click()
    await sql('UPDATE products SET current_price_kurus=18000 WHERE id=?',[product.id])
    await save().click();await page.getByRole('button',{name:'Yeni fiyatı kabul et',exact:true}).click()
    assert.match(await page.locator('.sale-totals dd').first().innerText(),/180,00/)
    await save().click();await title('Satış detayı').waitFor();await page.getByText('Misafir Müşteri',{exact:true}).waitFor()
    passed.push('unnamed cash sale requires explicit catalog-price acceptance and automatically uses the new full total')
    const sale=(await sql("SELECT id FROM sales WHERE sale_type='walk_in' AND walk_in_customer_name IS NULL"))[0]
    const longName='Uzun Türkçe müşteri adı '.repeat(8).slice(0,160)
    await post('sales',{sale_type:'walk_in',customer_id:null,walk_in_customer_name:longName,items:[{product_id:product.id,quantity:1,expected_list_price_kurus:18000}],payment:{amount_kurus:18000,method:'cash'}})
    await post('sales',{customer_id:customer.id,items:[{product_id:product.id,quantity:1,expected_list_price_kurus:18000}],payment:{amount_kurus:0,method:null}})
    await page.goto(meta.origin+'/#/satislar');await page.locator('.sale-kind-label').first().waitFor();await fit('mixed list')
    const row=page.locator('.sale-table tbody tr').filter({hasText:'Misafir Müşteri'})
    assert.equal(await row.locator('a[href^="#/musteriler/"]').count(),0)
    const geometry=await row.evaluate(row=>{const cells=[...row.cells];return{align:cells.map(cell=>getComputedStyle(cell).verticalAlign),margin:getComputedStyle(cells[1].querySelector('strong')).marginTop}})
    assert.ok(geometry.align.every(value=>value==='middle'));assert.equal(geometry.margin,'0px')
    const normalRow=page.locator('.sale-table tbody tr').filter({hasText:customer.name})
    const normalGeometry=await normalRow.evaluate(row=>{
      const link=row.cells[1].querySelector('a'), amount=row.cells[2].querySelector('.money'), a=link.getBoundingClientRect(),b=amount.getBoundingClientRect()
      return{margin:getComputedStyle(link).marginTop,difference:Math.abs((a.top+a.height/2)-(b.top+b.height/2))}
    })
    assert.equal(normalGeometry.margin,'0px');assert.ok(normalGeometry.difference<=4,JSON.stringify(normalGeometry))
    await page.goto(meta.origin+'/#/tahsilatlar');await page.getByText('Misafir Müşteri · Hızlı Satış',{exact:true}).waitFor()
    await sql("UPDATE users SET role='admin' WHERE id=?",[meta.fixture.id])
    await page.goto(meta.origin+'/#/raporlar/tahsilatlar');await page.getByRole('table',{name:'Geçerli tahsilat hareketleri'}).getByText('Misafir Müşteri · Hızlı Satış',{exact:true}).waitFor()
    passed.push('mixed desktop/mobile sales list aligns cells, distinguishes quick sales and never links anonymous names to customer details; payment/report rows remain visible')
    await sql("UPDATE users SET role='employee' WHERE id=?",[meta.fixture.id])
    const payment=(await sql('SELECT id FROM payments WHERE sale_id=?',[sale.id]))[0]
    const correction=await post('correction-requests',{target_type:'payment',target_id:payment.id,correction_type:'payment_refund',reason:'İzole hızlı satış iadesi',requested_change:'Tam iade ve iptal'})
    await sql("UPDATE users SET role='admin' WHERE id=?",[meta.fixture.id]);await page.goto(meta.origin+'/#/duzeltmeler/'+correction.id);await page.reload()
    await page.getByRole('button',{name:'Finansal Düzeltmeyi İncele',exact:true}).waitFor()
    await page.getByRole('button',{name:'Finansal Düzeltmeyi İncele',exact:true}).click()
    await page.getByLabel(/^Onay gerekçesi/).fill('İzole tam iade teyidi')
    await page.getByRole('checkbox',{name:/Tam tutarın aynı ödeme yöntemiyle/}).check()
    await page.getByLabel(/referans/i).fill('isolated-'+randomUUID())
    await page.getByRole('button',{name:'Harici İadeyi Teyit Et ve Kaydet',exact:true}).click()
    await page.getByRole('region',{name:'Uygulanan finansal düzeltme',exact:true}).waitFor()
    assert.equal((await sql('SELECT status FROM sales WHERE id=?',[sale.id]))[0].status,'cancelled')
    passed.push('admin full refund preview/approval works with null customer, cancels sale atomically and keeps zero debt')
    assert.deepEqual(errors,[]);return{passed}
  }finally{await context.close()}
}
