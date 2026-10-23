# Google Haritalar yol tarifi

Müşteri ve satış detayındaki adresin altında ortak `DirectionsLink` bulunur. Mevcut Button sınıfları/tokenları ve navigasyon SVG ikonu kullanılır; dokunma yüksekliği en az 44 px. Liste ekranlarına eylem eklenmez. Adres boşsa bağlantı gösterilmez.

## Web sözleşmesi ve gizlilik

`src/utils/directions.ts` yalnızca sabit `https://www.google.com/maps/dir/` hedefini, `URLSearchParams` ile `api=1`, kayıtlı adresi taşıyan `destination`, `travelmode=driving`, `dir_action=navigate` parametrelerini oluşturur. Adresin yalnızca dış boşlukları kırpılır; kayıt değiştirilmez. URL'ye benzeyen metin de hedef adres verisi olarak kodlanır; dış host olamaz. `origin`, koordinat, tahmini yer veya Place ID eklenmez. Kodlanmış bağlantı Google'ın 2.048 karakter sınırını aşarsa adres kesilmez; açıklama gösterilir.

Normal bir dış bağlantıdır: Google script'i, embed, geocoding, prefetch, API anahtarı veya tarayıcı konum sorgusu yoktur. Adres ancak kullanıcı bağlantıyı etkinleştirdiğinde Google'a gönderilir. `noopener noreferrer` ve `referrerPolicy=no-referrer` kullanılır; dış sayfaya AKÇAT URL'si/opener erişimi verilmez.

Masaüstü koşulu mevcut 1024 px breakpoint'i ile ince işaretçi/hover desteğidir; yeni sekme açılır ve erişilebilir adda bu belirtilir. Küçük veya dokunmatik ekranda aynı sekme kullanılır. JavaScript popup, zamanlayıcı veya özel scheme ile web'de uygulama açılması zorlanmaz. Resmî evrensel URL cihaz tercihine göre Google Maps uygulamasına veya web'e gider. Konum erişilemezse Google başlangıç girişi/rota önizlemesi gösterebilir. Yetersiz adresin doğru hedefe çözümleneceği garanti edilmez. [Resmî Maps URLs belgesi](https://developers.google.com/maps/documentation/urls/get-started).

## Gelecekteki native mobil

Bu bölüm tasarım kararıdır; `akcat-mobile` kodu ve yeni paket eklenmedi. Native istemci mevcut API'den aldığı adresi kullanır, paylaşımı yalnızca kullanıcı eylemiyle başlatır. Ortak davranış platform adaptörünün güvenli adres girdisinden URL üretmesi ve harici açılış sonucunu izlemesidir; API rastgele dış URL döndürmez.

- Öncelik aynı HTTPS Maps URL'sini platformun harici URL açma mekanizmasıyla açmaktır. Universal/App Link çözümlemesi uygulama yokken web'e dönüşü destekler; kesin kurulu-uygulama açılışı varsayılmaz.
- Android'de doğrudan Google Maps navigasyonu gerekiyorsa `ACTION_VIEW`, `google.navigation:q=<kodlanmış adres>&mode=d`, `com.google.android.apps.maps` paketi kullanılabilir. Intent çözümleme/başlatma hatasında aynı HTTPS URL'sine dönülür. Kurulum kontrolü gerekiyorsa package visibility manifest gereksinimi ayrıca uygulanır. [Android resmî intent belgesi](https://developer.android.com/guide/components/google-maps-intents).
- iOS'ta platforma özel gerekirse `comgooglemaps://?daddr=<kodlanmış adres>&directionsmode=driving` kullanılır. Önce `canOpenURL` ve gerekli `LSApplicationQueriesSchemes` bildirimi; uygulama açılamazsa HTTPS Maps URL'sine dönüş uygulanır. [iOS resmî URL scheme belgesi](https://developers.google.com/maps/documentation/urls/ios-urlscheme).

Kullanıcı konumu için sabit başlangıç eklenmez. Native bağlantı/fallback gerçek Android/iOS cihazında, uygulama kurulu/kurulu değil ve konum izni açık/kapalı durumlarında ayrıca test edilmelidir. Web sidebar/drawer ve gelecekteki native bottom navigation kararları değişmez.

## Kontroller

`npm.cmd run test:directions`: güvenli URL, Türkçe/özel karakter, boş adres, URL/HTML görünümlü girdi ve uzunluk sınırı. `test:directions:browser` mevcut `test:auth:serve` metadata'sıyla gerçek React/proxy/API ve geçici D1 kullanır; Google'a giden navigasyon testte yerelde yakalanır. Gerçek müşteri adresi Google'a gönderilmez. Müşteri/satış regresyon paketleri, TypeScript/build ve lint ayrıca çalıştırılır. Test sonuçları teslim raporunda belirtilir; fiziksel cihazda uygulamaya geçiş bu tarayıcı testinin kapsamında değildir.

23 Ekim 2026 sonuçları: 5 yeni URL birim testi + 8 mevcut tutar/yapılandırma testi başarılı. Tarayıcıda 5 yol tarifi kontrolü + 10 müşteri + 7 satış regresyonu başarılı. 320/390 px bağlantı dokunma alanı ve taşma, 1440 px yeni sekme ve güvenli opener/referrer davranışı kontrol edildi. TypeScript (`tsc -b`), Vite build ve lint başarılı; üretilmiş web tip dosyasındaki önceden bulunan iki lint uyarısı korunuyor. Test verileri yalnızca ayrı geçici D1'deydi; mevcut yerel/uzak iş verisi değiştirilmedi. API kaynaklarında değişiklik olmadığından API test paketi yeniden çalıştırılmadı.

Değişen dosyalar: `src/utils/directions.ts`, `src/components/DirectionsLink.tsx`, `src/components/directions.css`, `src/components/ui/Icon.tsx`, `src/customers/CustomerRecordPage.tsx`, `src/sales/SaleRecord.tsx`, `tests/directions.test.mjs`, `tests/directions.browser.mjs`, `tests/run-auth.mjs`, `package.json`, `README.md` ve bu belge. Yeni bağımlılık, migration, API anahtarı veya native uygulama kodu yoktur.
