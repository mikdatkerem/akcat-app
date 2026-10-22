# AKÇAT Web

React + TypeScript + Vite arayüzüdür. Bağımsız API `akcat-api` projesindedir; web D1’e doğrudan erişmez.

## Yerel geliştirme

API terminalinde (Windows PowerShell):

```powershell
cd ../akcat-api
npm.cmd run dev -- --local --port 8787
```

Web terminalinde, bu klasörde:

```powershell
npm run dev
```

Diğer kabuklarda API için `npm run dev -- --local --port 8787` kullanılabilir. Web http://localhost:5173 üzerinde çalışır; port doluysa hata verir. API http://localhost:8787 üzerinde çalışır. Vite, /api ve /api/* isteklerini öneki koruyarak API’ye yönlendirir. Cloudflare eklentisi build ve preview için korunur; yerelde web Worker’ı proxy’yi yakalamaz.

Uygulama açılışında gerçek GET /api/v1/auth/me ile oturum doğrulanır. Giriş sonrası Genel Bakış içindeki bağlantı düğmesi gerçek GET /api/health isteğini yapar. Sağlık endpoint’i oturumsuz da erişilebilirdir; bağlantı hatası veya beklenmeyen yanıt başarı olarak gösterilmez. Diğer iş endpoint’leri gelecekte /api/v1 altında geliştirilecektir.

## Giriş ve ilk gerçek kullanım

API’nin `.dev.vars.example` dosyasını mevcut `.dev.vars` dosyasını ezmeden API klasöründe `.dev.vars` olarak hazırlayın. Yerelde gerekli değerler:

```dotenv
AUTH_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8787
AUTH_INSECURE_LOCAL_COOKIE=true
AUTH_ENABLE_MOBILE_BEARER=false
```

Bu değerler API içindir; web’in `VITE_*` değişkenlerine konmaz. API’yi yeniden başlatın. Web’i `http://localhost:5173` ile açın; aynı anda `127.0.0.1` origin’ine geçmeyin. Güvenlik ayarları eksikse API auth’u 503 ile kapalı tutar; web bunu oturum yok gibi yorumlamaz, yeniden deneme ekranı gösterir. API origin/CSRF kontrolü gevşetilmez ve proxy `Origin` başlığını yeniden yazmaz.

Gerçek admin otomatik oluşturulmaz. Yetkili kişi API klasöründe `npm.cmd run bootstrap:admin -- --local` komutunu **manuel** uygulamalı; görünmeyen parola istemi ve tek kullanımlık kurulum kilidi kullanılmalıdır. Mevcut admin varsa bootstrap tekrarlanmaz. Uzak D1 yetkileri ve kurulum ayrıntıları [API AUTH.md](../akcat-api/docs/AUTH.md) içindedir. Bu çalışma gerçek kullanıcı oluşturmaz veya mevcut yerel/canlı D1’e test verisi yazmaz.

## Web oturum davranışı

- `src/services/apiClient.ts`: mevcut `src/config/api.ts` üzerinden merkezi API adresi, `credentials: include`, `cache: no-store`, süre sınırı ve güvenli hata metinleri. JSON içeriği gereken isteklerde `Content-Type: application/json`; login dışındaki yazmalarda bellekten `X-CSRF-Token`. Otomatik login/logout tekrarı yoktur. Gelecekteki korumalı iş istekleri de bu istemciyi kullanmalıdır; 401 oturumu geçersizleştirir, 403 çıkış yaptırmaz.
- `src/services/auth.ts`: gerçek API’nin `{username,password}`, `{user:{id,username,role},expiresAt,csrfToken}` ve `{success:true}` sözleşmeleri. Web oturum yanıtı çalışma anında doğrulanır. Bearer yöntemi kullanılmaz.
- `src/auth/`: bellek içi oturum/CSRF, başlangıç kontrolü, giriş ekranı, yüklenme ve yeniden deneme. Login sonrası `/me` ile cookie’nin kabul edildiği doğrulanmadan korumalı yerleşim açılmaz. localStorage/sessionStorage kullanılmaz; ham oturum tokenı JavaScript’e alınmaz.
- Yalnızca doğrulanmış oturumda AppLayout ve korumalı ekranlar render edilir. Hash adresi korunur; örneğin oturumsuz `#/musteriler` giriş ekranını gösterir ve giriş sonrası aynı alana döner. Yenilemede cookie üzerinden `/me` tekrar çağrılır. Oturumun sabit son kullanma zamanı istemcide kontrolü tetikler; yeni token/ek süre verilmez. API’de refresh endpoint’i yoktur.
- Sekmeye dönüşte mevcut oturum en sık 30 saniyede bir tekrar kontrol edilir. Ağ/5xx hatasında son bilinen oturum bellekte tutulur, korumalı içerik yeniden doğrulanana kadar gizlenir ve tekrar dene sunulur; kullanıcı anonim kabul edilmez. Logout hatasında oturum korunur, hata gösterilir; yeniden kontrol düğmesi `/me` çağırır, mutasyonu körlemesine tekrarlamaz. Başarılı logout sunucudaki oturumu iptal eder.
- Sidebar/drawer hesabı ve Çıkış Yap işlemini gösterir. Navigasyonun isteğe bağlı `roles` alanı, menü ve sayfa görünürlüğü için ortaktır; mevcut altı hedef korunur, Düzeltme Talepleri eklenmiştir. Employee kendi taleplerini, admin tüm talepleri ve inceleme işlemlerini görür. Gerçek yetki güvenliği API middleware’lerinde kalır. Müşteri, ürün, satış, tahsilat/veresiye, koşullu iptal ve talep modülleri çalışır.

## API adresi

.env.example dosyasındaki ayarlar gerektiğinde .env.local dosyasına alınabilir:

- VITE_API_BASE_URL: API origin’i; boş değer aynı origin’i kullanır. /api önekini eklemeyin. Tarayıcıya açıktır; sır içermez.
- API_PROXY_TARGET: yalnızca Vite geliştirme proxy’sinin hedefidir; varsayılan http://localhost:8787. Üretim paketine alınmaz.

Vite proxy’si üretimde çalışmaz. Varsayılan aynı-origin kullanımında /api/* bağımsız akcat-api Worker’ına yönlendirilmelidir. Alternatif olarak build sırasında VITE_API_BASE_URL gerçek HTTPS API origin’iyle ayarlanmalıdır; API `AUTH_ALLOWED_ORIGINS` yalnızca tam web origin’ini içermelidir. SameSite=Lax cookie nedeniyle web/API aynı origin veya aynı site altında HTTPS ile çalışmalıdır; farklı siteler için cookie/CORS koruması gevşetilmez. Üretimde AUTH_INSECURE_LOCAL_COOKIE=false kalır. Bu aşamada üretim yönlendirmesi veya API güvenlik yapılandırması değiştirilmedi. Üretim API adresi localhost olamaz. Web Worker’ına ulaşan API yolları SPA HTML’i veya sahte başarı yerine 404 döndürür.

## Kontroller

- TypeScript: npx --no-install tsc -b
- Build: npm run build
- Lint: npm run lint
- İzole tarayıcı entegrasyonu: `npm.cmd run test:auth:serve`, ardından ayrı terminalde `npm.cmd run test:auth:browser -- --metadata <yazdırılan browser.json yolu> --playwright-dir <mevcut Playwright paketinin üst dizini>`. Test komutu paket veya tarayıcı indirmez; mevcut Playwright + Chrome gerekir (`--channel msedge` de seçilebilir). Bu çalışma Codex’in mevcut paket/runtime’ını kullandı; projeye bağımlılık eklenmedi.

Test sunucusu etkileşimli terminal gerektirir; mevcut API test harness’ini `--local`, farklı DB kimliği, rastgele portlar ve OS geçici persistence diziniyle başlatır; tek rastgele **employee test fixture’ı yalnızca izole test D1’de** tutulur. Üretim UI’sinde sahte yanıt veya kullanıcı yoktur. Test anahtarı, parola ve cookie loglanmaz; geçici metadata yalnızca test süresince kullanılır. Test sonunda sunucu terminalinde Enter ile kapatın; süreçler ve geçici D1/metadata/görseller kaldırılır. Unutulursa 15 dakika sonra otomatik kapanır. Her tekrar için yeni test sunucusu açın; gerçek rate limiter devrede kalır. `tests/auth.browser.mjs` gerçek proxy/Worker isteklerini kullanır; yalnızca ağ kesintisi testinde isteği abort eder, sahte başarılı API yanıtı üretmez.

Tarayıcı kontrolleri: ilk oturum kontrolünde ağ hatası, 401 sonrası korumalı hash, 320/390/1440 px yerleşim, boş form/odak, klavye/parola görünürlüğü, gerçek başarısız giriş, izole başarılı giriş ve HttpOnly cookie, Web Storage kullanılmaması, yenilemede oturum, geçici hata sonrası toparlanma, mobil drawer + health, başarısız/başarılı CSRF logout, D1’de iptal ve cookie silme, süresi dolan oturum. Bunlar gerçek admin veya üretim HTTPS/edge doğrulaması değildir.

npm run preview üretim çıktısını yerel Worker ortamında önizler; geliştirme proxy’sini kullanmaz. Deploy ayrı bir işlemdir ve açık talimat olmadan çalıştırılmaz.

## Müşteri yönetimi

`#/musteriler` gerçek API listesidir; `#/musteriler/yeni`, `#/musteriler/:id` ve `#/musteriler/:id/duzenle` aynı korunmuş AppLayout içinde açılır. Arama, durum ve sayfa URL query’sinde korunur; tarayıcı geri/ileri çalışır. Masaüstü tablo, dar ekran okunabilir liste kullanır. Boş sonuç, yüklenme ve hata ayrıdır; API hatasında sahte kayıt veya başarılı boş liste üretilmez. Müşteri detayında toplam borç, açık satışlar, tahsilat/finansal hareketler ve işlem sonrası bakiyeler gerçek API’den gösterilir.

- `src/customers/`: liste, detay, yeni/düzenleme formu, hash alt yolları ve eski async sonuçları yok sayan veri yükleme hook’u.
- `src/services/customers.ts`: çalışma anında doğrulanan gerçek API sözleşmesi; merkezi cookie/CSRF istemcisini kullanır.
- `src/components/ui/Textarea.tsx`: mevcut Field/input diliyle etiketli, hata/hint bağlantılı çok satırlı alan.
- Her iki rol müşteri ekleyip temel bilgileri düzenler. Aktiflik checkbox’ı yalnızca admin’in düzenleme formunda görünür; sunucu ayrıca 403 ile sınırlar. Tarihler açıkça Europe/Istanbul ile gösterilir.
- Gönderim anında senkron kilit ve loading/disabled durumu ikinci tıklamayı engeller. Yeni formun `Idempotency-Key` değeri aynı formdaki tekrar isteğinde korunur; yanıt kaybında bile tek kayıt oluşur. 409’da liste kontrol edilmelidir; otomatik yeni anahtarla tekrar yoktur. Hata sırasında alanlar sıfırlanmaz, yalnızca değişen alanlar PATCH edilir. Veriler veya işlem anahtarı Web Storage’a yazılmaz.

API alanları, telefon doğrulaması, rol/audit ve atomiklik sınırları: [Customers API](../akcat-api/docs/CUSTOMERS.md).

Tarayıcı müşteri testleri için yeni izole ortam açın (`npm.cmd run test:auth:serve`). İkinci terminalde `npm.cmd run test:customers:browser -- --metadata <yazdırılan browser.json> --playwright-dir <mevcut Playwright paketinin üst dizini>` çalıştırın. Kurulu Chrome/Playwright kullanılır; paket/tarayıcı indirilmez. Testte üretilen müşteriler ve role değişimi yalnızca geçici DB’dedir. Test, gerçek API üzerinden create/edit/search/pagination/admin sınırlarını, 500/404 durumlarını ve yanıtı kaybolmuş create isteğinin tekrarını denetler; sahte başarılı yanıt üretmez. Ekran görüntüleri geçici ortamda kalır. Sonunda ortam terminalinde Enter ile süreçleri/fixture’ları temizleyin. Her test tekrarı için yeni ortam kullanın.

## Ürün yönetimi

- `#/urunler` arama, aktiflik filtresi ve sayfalama; `#/urunler/:id` detay; `#/urunler/yeni` ve `#/urunler/:id/duzenle` yalnızca admin formudur. Employee listeler/detay görür; doğrudan form adresinde izin mesajı alır. API yazmayı ayrıca 403 ile sınırlar.
- `src/products/`: liste, detay, form ve responsive stiller. Mobilde tablo kart/listelere dönüşür; mevcut sidebar/drawer korunur. `src/services/products.ts` gerçek API yanıtlarını doğrular; hata halinde sahte veri veya boş başarı üretmez.
- TL alanı metin/decimal klavye kullanır. `parsePriceToKurus` ve `priceInputFromKurus` BigInt ile tam hassasiyetlidir; binlik ayırıcı yoktur, virgül/nokta ve en fazla iki ondalık basamak kabul edilir. `formatMoney` Türkçe TL gösterir. Yeni form boş fiyatla açılır; demo ürün/fiyat yoktur.
- Form hata sırasında değerlerini ve oluşturma anahtarını korur; kaybolmuş yanıtta aynı anahtarla tekrar tek kayıt üretir. Aynı anahtarla farklı bilgi 409 verir; önce liste kontrol edilmelidir. Yalnızca değişen alanlar PATCH edilir. Aktiflik oluşturma/düzenlemede admin tarafından yönetilir.
- Sözleşme, kuruş sınırı, audit ve tarihsel fiyat güvenliği: [Products API](../akcat-api/docs/PRODUCTS.md). Satış/tahsilat/stok bu modüle dahil değildir.

Fiyat birim testleri: `npm.cmd run test:format`. Ürün tarayıcı testleri için yeni izole ortam açın (`npm.cmd run test:auth:serve`); ayrı terminalde `npm.cmd run test:products:browser -- --metadata <yazdırılan browser.json> --playwright-dir <kurulu Playwright paketinin üst dizini>` çalıştırın. Mevcut Chrome/Playwright kullanılır; paket/tarayıcı kurulmaz. Fixture kullanıcı rolü, ürünler ve fiyatlar yalnızca geçici D1’dedir. Gerçek React → Vite proxy → Worker → D1 kullanılır; sahte başarılı yanıt üretilmez. 320/390/1440 px form/liste kontrolleri ve geçici ekran görüntüleri dahildir. Her suite için yeni ortam kullanın; sonunda Enter ile süreçleri/geçici veriyi temizleyin.

## Satış yönetimi

- `#/satislar`: gerçek satış geçmişi, sayfalama ve müşteri/tarih filtreleri. Admin/employee tüm işletme satışlarını görür; oluşturan kişi korunur. Çalışan başka çalışanın satışına tahsilat yapabilir; düzenleme/silme/admin yetkisi açılmaz. Sidebar Satışlar bu listeyi açar. `#/yeni-satis` / `#/satislar/yeni`: yeni teslim edilmiş satış; `#/satislar/:id`: snapshot fiyatlar ve güncel geçerli ödemelerle detay. Genel Bakış Yeni Satış kısayolu korunur.
- `src/sales/`: müşteri/aktif ürün araması, sayfalı seçim, çoklu kalem/miktar, ürün kaldırma, TL ödeme, ödeme yöntemi, tam/kısmi/veresiye ve toplam/borç önizlemesi. Önizleme BigInt kullanır; asıl fiyat/aktiflik/toplam API transaction’ında belirlenir. Başarı yalnızca gerçek API verisiyle gösterilir; detay tekrar açıldığında sunucudan güncellenir.
- `src/services/sales.ts`: merkezi cookie/CSRF istemcisi ve çalışma anında tutar, kalem toplamı, ödeme ve bakiye doğrulaması. Satış completed/cancelled durumu ödeme durumundan ayrıdır. Kullanıcılara gerçek boş/yüklenme/hata/başarı gösterilir.
- Ağ/500/yanıt doğrulama belirsizliğinde formun özgün body/UUID anahtarı korunur ve alanlar kilitlenir. Aynı satış güvenle yeniden denenir; otomatik mutation retry yoktur. Kullanıcı kapsamlı bellek taslağı geçici auth kontrolü ve uygulama içi gezinmede korunur; başarılı kayıt/çıkış/401’de temizlenir. Refresh/sekme kapatma taslağı kaybettirir; böyle bir belirsizlikte önce satış geçmişini kontrol edin. Web Storage’a veri/token yazılmaz.
- Tam sözleşme, transaction/idempotency sınırları ve dosya listesi: [Sales API](../akcat-api/docs/SALES.md). Sonradan tahsilat [Finans API](../akcat-api/docs/FINANCE.md), koşullu iptal ve yönetici incelemesi [Düzeltme API](../akcat-api/docs/CORRECTIONS.md) ile bağlanmıştır. Ters kayıt/iade, kasa/rapor ve stok bu modülde yoktur.

Hesaplama: `npm.cmd run test:sales:math`. Tarayıcı: yeni `npm.cmd run test:auth:serve` ortamında, ayrı terminalden `npm.cmd run test:sales:browser -- --metadata <browser.json> --playwright-dir <kurulu Playwright üst dizini>`. Kurulu Chrome/Playwright kullanılır. Fixture kullanıcı, ürünler, müşteriler ve satışlar yalnızca geçici izole D1’de oluşturulur; gerçek API yerine sahte başarı yanıtı kullanılmaz. 320/390/1440 px form/detay/geçmiş, kayıp yanıt tekrarı, gerçek boş/hata durumları ve snapshot fiyatlar kontrol edilir. Diğer suite’leri kendi yeni ortamlarında çalıştırın; sonunda ortam terminalinde Enter ile temizleyin.

## Tahsilat ve veresiye

- `#/tahsilatlar`: ilk ödemeler dahil ortak tahsilat geçmişi, yöntem/tarih filtreleri ve sayfalama. Müşteri adı geçmişten müşteri detayına, her kayıt ilgili satışa bağlanır. Yöntem, kullanıcı, tarih, geçerlilik ve güncel satış borcu ayrı gösterilir.
- `#/tahsilatlar/yeni`: gerçek müşteri seçimi → güncel borç/açık satışlar → satış seçimi → tutar/yöntem → kayıt. `customer_id` / `sale_id` query’si müşteri/satış/veresiye ekranlarından başlatmayı sağlar. Pasif müşterilerin mevcut borcu da tahsil edilebilir. Her ödeme tek satışa bağlıdır; avans/otomatik dağıtım yoktur.
- `#/veresiye`: yalnızca pozitif borçlu müşteriler; ad araması, sayfalama, telefon/toplam borç/açık satış sayısı/son tahsilat, müşteri detayı ve Tahsilat al bağlantısı. Vade olmadığı için “Gecikmiş” etiketi yoktur.
- `src/finance/`: form/geçmiş/veresiye sayfaları; müşteri detayında kullanılan CustomerAccount/CustomerLedger; shared Pagination; responsive stiller. `src/services/finance.ts` gerçek yanıtları doğrular. İlk ödeme ikinci kez oluşturulmaz; borç snapshot satış toplamı eksi geçerli ödemelerden gelir. Başarılı POST sonrası borç yeniden API’den alınır; okuma hatası kayıt hatası gibi ele alınıp ikinci ödeme oluşturulmaz.
- Belirsiz ağ/500/yanıt doğrulama hatasında özgün body/anahtar kilitli tutulur; aynı tahsilat güvenle yeniden denenir. Taslak yalnızca kullanıcı kapsamlı bellektedir; geçici auth kontrolü/uygulama içi gezinmede korunur, başarılı kayıt/çıkış/401’de temizlenir. Refresh/sekme kapatma sonrası belirsizliği önce geçmişten kontrol edin. Web Storage veya otomatik mutation retry yoktur.
- Gerçek boş/yüklenme/hata/başarı durumları vardır; API hatası boş başarı veya sahte veriye dönüşmez. Sidebar/drawer ve mevcut tasarım tokenları korunur. Artık kullanılmayan ModulePage/modulePages iskeletleri kaldırıldı.

API sözleşmesi, borç/ledger semantiği, eşzamanlılık ve değişen dosyalar: [FINANCE.md](../akcat-api/docs/FINANCE.md). Tarayıcı kontrolü için yeni `npm.cmd run test:auth:serve` ortamında ayrı terminalden `npm.cmd run test:finance:browser -- --metadata <browser.json> --playwright-dir <kurulu Playwright üst dizini>` çalıştırın. Kurulu Chrome/Playwright kullanılır; paket/tarayıcı yüklenmez. Testteki müşteri/ürün/çalışan/satış/ödeme kayıtları yalnızca geçici D1’dedir. 320/390/1440 px form/geçmiş/müşteri/veresiye, başka çalışanın satışına tahsilat, kayıp yanıt tekrarı ve gerçek API hataları denetlenir. Her suite ayrı yeni ortam kullanır; sonunda ortam terminalinde Enter ile geçici verileri/süreçleri temizleyin.

## Satış iptali ve düzeltme talepleri

- `src/corrections/`: gerekçeli iptal dialog’u, talep formu, liste/detay, uygulanabilir admin onayı ve gerekçeli ret. `src/services/corrections.ts` merkezi cookie/CSRF istemcisini kullanır ve gerçek yanıtı doğrular. `operation.ts` belirsiz yazmaları aynı body/anahtarla yalnızca bellekte tutar; auth kontrolü veya sayfa içi gezinmede korunur, başarı/çıkış/401’de temizlenir. Refresh sonrası önce geçmiş kontrol edilmelidir.
- `#/duzeltmeler`, `#/duzeltmeler/:id`, `#/duzeltmeler/yeni?target_type=sale|payment&target_id=...`. Yeni talep satış detayı veya tahsilat geçmişinden açılır. Employee kendi taleplerini, admin tüm talepleri görür. Hiç ödeme kaydı olmayan satış iptali dışında onay butonu yoktur; sunucu da desteklenmeyen onayı reddeder.
- Satış detayında sunucunun uygunluk açıklaması, iptal onayı ve gerekçeli geçmiş bulunur. İptal güncel borcu kapatır; asıl toplam/kalemler korunur, müşteri ledger’ında ayrı iptal hareketi ve önceki borç görünür. İptal edilen satıştan tahsilat başlatılmaz.
- Sözleşme ve sınırlar: [CORRECTIONS.md](../akcat-api/docs/CORRECTIONS.md). Tarayıcı: yeni `test:auth:serve` ortamında `npm.cmd run test:corrections:browser -- --metadata <browser.json> --playwright-dir <kurulu Playwright dizini>`. Her suite ayrı izole D1 kullanır ve bitince Enter ile temizlenir. Mevcut regresyon komutları korunmuştur.

## Tasarım altyapısı

Tasarım kararlarının kaynağı kökteki AKCAT_DESIGN_SYSTEM.md dosyasıdır.

- src/styles/tokens.css: renk, tipografi, spacing, border ve radius değişkenleri.
- src/components/ui/: Button, Input, Select, Card, Badge, EmptyState, LoadingState, ErrorState; ortak dışa aktarımlar index.ts içindedir. ui.css global olarak index.css üzerinden yüklenir.
- Input/Select: label zorunlu; hint ve error isteğe bağlıdır. Etiket ve açıklama kimlikleri useId ile eşleştirilir; native required, inputMode, autoComplete, ref ve diğer HTML özellikleri aktarılır.
- Button: primary / secondary / danger / ghost; loading sırasında devre dışıdır, varsayılan type=button. Danger varyantı tek başına silme/onay iş akışı sağlamaz.
- Card: title zorunlu, description ve accessory isteğe bağlı. Badge: neutral / info / success / warning / danger; renk yanında metin ve ikon gösterir.
- EmptyState yalnızca açıklama ve varsa gerçek aksiyon alır. ErrorState yalnızca onRetry verilirse yeniden deneme düğmesi gösterir. LoadingState metinli, veri içermeyen skeleton gösterir.
- src/layout/: mevcut altı hedef ve Düzeltme Talepleri için ortak NavigationLinks, 1024 px altında hamburger header + modal drawer, üstünde sabit sidebar. Alt navigasyon yoktur. Drawer dışarı tıklama/Escape/sayfa seçimiyle kapanır; modal odak, arka plan kaydırma kilidi ve konum geri yükleme desteklenir. Masaüstüne geçişte drawer kapanır. Hash yönlendirmeleri ve eski #/menu adresi korunur. Raporlar/Ayarlar henüz uygulanmadığı için bağlantıları gösterilmez.
- src/pages/: Genel Bakış, PageHeader ve mevcut Menü sayfası. Gerçek müşteri/ürün/satış/finans ekranları src/customers/, src/products/, src/sales/, src/finance/ içindedir; ortak yükleme hook’u src/hooks/useResource.ts konumundadır. Dashboard rapor metrikleri henüz bağlanmadığından örnek tutar veya borç sıfır iddiası gösterilmez.
- src/components/ApiHealth.tsx: mevcut gerçek sağlık kontrolü; Genel Bakış içindedir. Başarı, yüklenme ve yeniden deneme durumları ortak bileşenlerle sunulur.
- src/utils/format.ts: formatMoney tam sayı kuruş kabul eder; Türkiye biçimini sayısal hassasiyet kaybetmeden üretir. Para metinlerinde money, belirgin tutarlarda ek olarak money--prominent sınıfı kullanılır. Sahte tutar gösterilmez.

Font sırası Inter, system-ui, sans-serif’tir. Harici font isteği veya font paketi eklenmemiştir; Inter cihazda yoksa Türkçe karakterleri destekleyen sistem fontu kullanılır. Header, içerik ve drawer iPhone güvenli alanlarıyla uyumludur (viewport-fit=cover). Sabit alt navigasyon boşluğu yoktur. prefers-reduced-motion drawer/overlay ve diğer geçişleri kapatır.
