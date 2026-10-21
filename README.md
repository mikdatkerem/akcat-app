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
- Sidebar/drawer hesabı ve Çıkış Yap işlemini gösterir. Navigasyonun isteğe bağlı `roles` alanı, menü ve sayfa görünürlüğü için ortaktır; mevcut altı iskelet her iki rolde de korunur. Gerçek yetki güvenliği API middleware’lerinde kalır. Müşteri/ürün/satış/tahsilat işlevi eklenmemiştir.

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

## Tasarım altyapısı

Tasarım kararlarının kaynağı kökteki AKCAT_DESIGN_SYSTEM.md dosyasıdır.

- src/styles/tokens.css: renk, tipografi, spacing, border ve radius değişkenleri.
- src/components/ui/: Button, Input, Select, Card, Badge, EmptyState, LoadingState, ErrorState; ortak dışa aktarımlar index.ts içindedir. ui.css global olarak index.css üzerinden yüklenir.
- Input/Select: label zorunlu; hint ve error isteğe bağlıdır. Etiket ve açıklama kimlikleri useId ile eşleştirilir; native required, inputMode, autoComplete, ref ve diğer HTML özellikleri aktarılır.
- Button: primary / secondary / danger / ghost; loading sırasında devre dışıdır, varsayılan type=button. Danger varyantı tek başına silme/onay iş akışı sağlamaz.
- Card: title zorunlu, description ve accessory isteğe bağlı. Badge: neutral / info / success / warning / danger; renk yanında metin ve ikon gösterir.
- EmptyState yalnızca açıklama ve varsa gerçek aksiyon alır. ErrorState yalnızca onRetry verilirse yeniden deneme düğmesi gösterir. LoadingState metinli, veri içermeyen skeleton gösterir.
- src/layout/: tüm cihazlarda aynı altı hedefi kullanan ortak NavigationLinks, 1024 px altında hamburger header + modal drawer, üstünde sabit sidebar. Alt navigasyon yoktur. Drawer dışarı tıklama/Escape/sayfa seçimiyle kapanır; modal odak, arka plan kaydırma kilidi ve konum geri yükleme desteklenir. Masaüstüne geçişte drawer kapanır. Hash yönlendirmeleri ve eski #/menu adresi korunur. Raporlar/Ayarlar henüz uygulanmadığı için bağlantıları gösterilmez.
- src/pages/: altı iş ekranının iskeleti ve mevcut Menü sayfası. PageHeader isteğe bağlı actions alanı sunar; yalnızca gerçek aksiyonlar eklenir. İş endpoint’leri henüz bağlı olmadığından kayıt yok veya borç sıfır iddiası yerine verilerin bağlı olmadığı açıklanır. Form ve kayıt işlemi henüz sunulmaz.
- src/components/ApiHealth.tsx: mevcut gerçek sağlık kontrolü; Genel Bakış içindedir. Başarı, yüklenme ve yeniden deneme durumları ortak bileşenlerle sunulur.
- src/utils/format.ts: formatMoney tam sayı kuruş kabul eder; Türkiye biçimini sayısal hassasiyet kaybetmeden üretir. Para metinlerinde money, belirgin tutarlarda ek olarak money--prominent sınıfı kullanılır. Sahte tutar gösterilmez.

Font sırası Inter, system-ui, sans-serif’tir. Harici font isteği veya font paketi eklenmemiştir; Inter cihazda yoksa Türkçe karakterleri destekleyen sistem fontu kullanılır. Header, içerik ve drawer iPhone güvenli alanlarıyla uyumludur (viewport-fit=cover). Sabit alt navigasyon boşluğu yoktur. prefers-reduced-motion drawer/overlay ve diğer geçişleri kapatır.
