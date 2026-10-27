# Ak Emlak — Emlak İlan Sitesi

Statik bir emlak ilan sitesi (React + Vite + TypeScript). İlanlar tek bir dosyada, **`public/data.json`** içinde tutulur; elle ya da yönetim uygulamasından (`/yonetim`) düzenlenir.

| Adres | İçerik |
|---|---|
| `/` | İlan listesi, arama ve filtreler |
| `/detay/{ilan-adi}` | İlan detayı, fotoğraf galerisi ve WhatsApp iletişim |
| `/ilan-basvurusu` | İlan başvuru formu (Firebase) |
| `/yonetim` | Yönetim uygulaması (yalnızca yetkililer) |

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ klasörü oluşur
```

İşletme bilgileri `src/config.ts` dosyasındadır:

- WhatsApp numarası
- görünen telefon
- şehir
- çalışma saatleri

## İlan ekleme / düzenleme / silme

1. `public/data.json` dosyasını açın.
2. `"ilanlar"` listesine ilan ekleyin, değiştirin ya da silin.
3. Fotoğrafları `public/img/` klasörüne koyun ve dosya adlarını ilanın `"fotograflar"` listesine yazın.
4. Değişikliği GitHub'a gönderin. Vercel siteyi 1–2 dakika içinde günceller.

Örnek ilan (tüm alanlar):

```json
{
  "ilanNo": "AK-10008",
  "baslik": "Merkezde 3+1 Asansörlü Daire",
  "tur": "satilik",
  "kategori": "daire",
  "kategoriAdi": "",
  "fiyat": 2500000,
  "paraBirimi": "TRY",
  "il": "Gaziantep",
  "ilce": "Nurdağı",
  "mahalle": "Bahçelievler Mahallesi",
  "brutM2": 150,
  "netM2": 130,
  "odaSayisi": "3+1",
  "banyoSayisi": 2,
  "kat": "3. Kat",
  "binaYasi": 5,
  "isitma": "Kombi (Doğalgaz)",
  "marka": "",
  "model": "",
  "modelYili": null,
  "km": null,
  "yakit": "",
  "vites": "",
  "renk": "",
  "ozellikler": ["Asansör", "Otopark", "Balkon"],
  "aciklama": "Birinci paragraf.\n\nİkinci paragraf.",
  "fotograflar": ["daire-1.jpg", "daire-2.jpg"],
  "durum": "yayinda",
  "firsat": false,
  "tarih": "2026-10-21",
  "baglanti": ""
}
```

| Alan | Açıklama |
|---|---|
| `baslik` | **Zorunlu olan tek alan.** Diğer alanlar boş bırakılabilir ya da hiç yazılmayabilir. |
| `ilanNo` | Müşteriye gösterilen ilan numarası. Her ilanda farklı olmalı. |
| `tur` | `satilik` veya `kiralik`. Kiralıkta fiyatın yanına "/ ay" eklenir. |
| `kategori` | Konut: `daire`, `rezidans`, `villa`, `mustakil`, `yazlik`<br>Arsa: `arsa`, `tarla`<br>İş yeri: `isyeri`, `ofis`, `depo`<br>Vasıta: `otomobil`, `arazi_suv`, `motosiklet`, `ticari`, `is_makinesi`<br>Hiçbiri değilse: `diger` (adını `kategoriAdi` alanına yazın, örn. "Tekne") |
| `fiyat` | Sadece rakam, örn. `8000`. **`0` yazılırsa sitede "Fiyat için arayın" görünür.** |
| `paraBirimi` | `TRY` (varsayılan), `USD` veya `EUR` |
| `il` / `ilce` / `mahalle` | Konum. `il` boşsa `src/config.ts` içindeki şehir kullanılır. |
| `marka`, `model`, `modelYili`, `km`, `yakit`, `vites`, `renk` | Yalnızca araç ilanlarında doldurulur. |
| `ozellikler` | Etiket listesi, örn. `["Camiye Yakın", "Bahçe"]` |
| `aciklama` | Metin. Paragraf için `\n\n` yazın. |
| `fotograflar` | `public/img/` içindeki dosya adları. En fazla 10 fotoğraf; ilki kapak olur. |
| `durum` | `yayinda`, `satildi` (kiralıkta "Kiralandı" yazar) veya `gizli` (sitede görünmez) |
| `firsat` | `true` ise ilan "Fırsat" etiketiyle en üstte gösterilir. |
| `tarih` | `YYYY-AA-GG`. "En yeni" sıralaması bu tarihe göre yapılır. |
| `baglanti` | İsteğe bağlı. Boşsa sayfa adresi başlıktan otomatik üretilir (`/detay/merkezde-3-1-asansorlu-daire`). |

**Fotoğraf ipuçları**

- Dosya adlarında Türkçe karakter ve boşluk kullanılabilir. Yine de `esenyurt-ev-1.jpg` gibi sade adlar önerilir.
- JPG, PNG, WEBP ve AVIF desteklenir.
- Telefondan çekilmiş büyük fotoğrafları yüklemeden önce yaklaşık 1600 piksel genişliğe küçültmek siteyi hızlandırır.
- Fotoğraftaki konum (GPS) bilgisini silmeniz önerilir.

**Hata yaparsanız**

- JSON yazım hatası (eksik virgül, tırnak gibi) olursa ana sayfada "İlanlar yüklenemedi" yazar. Dosyayı kaydetmeden önce [jsonlint.com](https://jsonlint.com) gibi bir araçla kontrol edin.
- Tek bir ilanda eksik/hatalı alan varsa yalnızca o ilan atlanır. Nedeni tarayıcı konsolunda (F12) yazar.

## SEO

Derleme (`npm run build`) sırasında `public/data.json`'daki her ilan için hazır bir sayfa üretilir: `dist/detay/<adres>/index.html`. Böylece Google, Yandex ve WhatsApp/Facebook bağlantı önizlemeleri ilanı JavaScript beklemeden görür. Her sayfada şunlar bulunur:

- ilan adı ve ilçesiyle başlık; tür, konum, fiyat ve açıklamadan oluşan ~160 karakterlik açıklama,
- canonical adres,
- Open Graph / Twitter etiketleri (önizleme görseli: ilanın ilk fotoğrafı, yoksa `public/og.jpg`),
- Google için yapılandırılmış veri (JSON-LD): emlakta `RealEstateListing`, araçta `Car`, ayrıca sayfa yolu (breadcrumb),
- ilanın metin içeriği (sayfa açılınca yerini uygulama alır).

Ana sayfaya emlakçı bilgisi (`RealEstateAgent`) ve ilan listesi eklenir. Ayrıca `sitemap.xml` üretilir ve `robots.txt` dosyasına sitemap satırı yazılır.

Tam adresler (canonical, sitemap) için sitenin alan adı gerekir:

- **Vercel'de:** alan adı otomatik alınır (`VERCEL_PROJECT_PRODUCTION_URL`). Özel alan adı bağlıysa o kullanılır.
- **Başka yerde:** `SITE_URL=https://alanadiniz.com npm run build` ile ya da `src/config.ts` içindeki `siteUrl` ile verilebilir.

Site yayına girdikten sonra Google Search Console'a `https://alanadiniz/sitemap.xml` adresini eklemeniz önerilir.

## İlan başvuru formu (Firebase)

`/ilan-basvurusu` sayfasındaki form, başvuruları Firebase projesine (**akemlak-ilan**, Frankfurt / europe-west3) kaydeder.

- **Zorunlu alanlar:** ilan tipi, ad soyad ve cep telefonu (`+90 5XX XXX XX XX`). Diğer alanlar tipe göre değişir ve isteğe bağlıdır.
- **Bağlantıyla doldurma:** form bağlantı parametreleriyle doldurulmuş açılabilir, örneğin `/ilan-basvurusu?tip=mustakil&tur=kiralik&il=gaziantep&ilce=nurdagi&mahalle=esenyurt&fiyat=8000`. Ziyaretçi formu doldurdukça bağlantı da kendiliğinden güncellenir; sayfa yenilense ya da bağlantı kopyalanıp paylaşılsa bile form aynı bilgilerle açılır. Ad, telefon ve e-posta güvenlik için bağlantıya yazılmaz (elle eklenen `ad`, `telefon`, `eposta` yine okunur).
  - Parametreler: `tip`, `tur`, `il`, `ilce`, `mahalle`, `adres`, `fiyat`, `oda`, `m2`, `net`, `kat`, `yas`, `banyo`, `isitma`, `esyali` (evet/hayir), `site` (evet/hayir), `imar`, `tapu`, `parsel`, `marka`, `model`, `yil`, `km`, `yakit`, `vites`, `ozellik` (virgülle: `ozellik=Bahçe,Otopark`), `aciklama`, `ad`, `telefon`, `eposta`.
  - `tip` değerleri: `daire`, `mustakil`, `villa`, `arsa`, `tarla` (bahçe), `isyeri`, `arac`, `diger`. `tur`: `satilik` / `kiralik`.
- **Cihazdaki geçmiş:** Başvurular ziyaretçinin cihazında saklanır ("Başvurularım"). Düzenlenip tekrar gönderilen başvuru `resubmission` alanında önceki numara, ilk numara ve sürümle işaretlenir.
- **Başvuruları görme:** Firebase konsolu → Firestore → `basvurular`. Fotoğraflar Storage → `basvurular/` altında. Her yeni başvuruda fotoğraflar ekli bir e-posta gelir.
- **Bildirim alıcıları:** Firestore → `ayarlar/bildirim` belgesindeki `alicilar` listesi. Yeni adres eklemek için kod değiştirmek gerekmez.
- **Gönderen hesap:** Gmail hesabı `gonderen` alanında, uygulama şifresi Secret Manager'da `GMAIL_APP_PASSWORD` adıyla durur. Şifre değişirse yeni bir sürüm ekleyin ve fonksiyonları yeniden yayınlayın.

**Güvenlik**

- Ziyaretçiler anonim oturumla yalnızca **yeni başvuru oluşturabilir**. Okuma, değiştirme ve silme kapalıdır. Başvuruları yalnızca yetkililer (yönetim uygulaması) okur.
- Kurallar alan beyaz listesini, telefon biçimini, KVKK onayını, sunucu saatini ve kimliği denetler. Aynı oturumdan dakikada en fazla 1 başvuru yapılabilir.
- Fotoğraflar yalnızca kişinin kendi klasörüne, en fazla 3 MB'lık JPEG/WEBP olarak yüklenebilir.
- **App Check (reCAPTCHA Enterprise):** İstekler yalnızca sitenizden gelen gerçek tarayıcılardan kabul edilir.
- **API anahtarı:** Yalnızca `ak-emlak.vercel.app` ve yerel test adreslerinden, yalnızca formun kullandığı servislerle çalışır.
- **Cloud Functions:**
  - fotoğrafların gerçekten resim olduğunu ve alanları sunucuda tekrar doğrular,
  - sık gönderimi "şüpheli" işaretler (bunlar için e-posta gönderilmez),
  - yarıda kalmış fotoğrafları ve 2 yıldan eski başvuruları her gece siler.
- **Bütçe uyarısı:** aylık 170 TL.

**Geliştirme ve test**

```bash
npm run emulators                     # yerel Firebase emülatörleri (Java gerekir)
npm run test:rules                    # güvenlik kuralı testleri (emülatör açıkken)
VITE_FIREBASE_EMULATOR=1 npm run dev  # formu emülatöre bağlı çalıştır
npx firebase deploy --only firestore,storage   # kuralları yayınla
npx firebase deploy --only functions           # fonksiyonları yayınla
```

## Yönetim uygulaması (`/yonetim`)

Telefona kurulabilen (ana ekrana eklenen) yönetim uygulaması. Başvuruları okur, not düşer, satıcıyı arar/WhatsApp'tan yazar, başvuruyu ilana dönüştürür ya da reddeder; doğrudan ilan girer, ilanları düzenler, satıldı/kiralandı işaretler, gizler, fırsat yapar, siler. Yeni başvuruda telefona bildirim gelir.

**Kurulum (telefonda)**

1. `https://ak-emlak.vercel.app/yonetim` adresini açıp **Google ile giriş yap**.
2. **iPhone (Safari):** Paylaş → “Ana Ekrana Ekle”. **Android (Chrome):** ⋮ → “Ana ekrana ekle / Uygulamayı yükle”.
3. Ana ekrandaki simgeden açın → **Ayarlar → Bu cihazda bildirimleri aç**. (iPhone'da bildirim yalnızca ana ekrandan açılan uygulamada çalışır, iOS 16.4+.)

**Kimler girebilir**

- Yalnızca Firestore'daki **`yetkililer`** koleksiyonunda belgesi olan, Google ile giriş yapmış ve e-postası doğrulanmış hesaplar. Belge kimliği e-posta adresidir (ör. `yetkililer/hasankurulurofficial@gmail.com`, içerik `{ ad: "Hasan" }`).
- **Yeni yetkili eklemek:** Firebase konsolu → Firestore → `yetkililer` → belge ekle (kimlik = e-posta). **Kaldırmak:** belgeyi silin. Uygulamadan kimse kendini ekleyemez.
- Listede olmayan biri Google ile giriş yapsa bile hiçbir veriyi göremez, hiçbir şeyi değiştiremez (Firestore/Storage kuralları ve sunucu fonksiyonları ayrıca denetler; App Check açık).

**Siteye nasıl yansır**

- “Siteye ekle”, “Kaydet”, “Satıldı”, “Gizle”, “Sil” işlemleri sunucu fonksiyonu üzerinden GitHub'daki `public/data.json` ve `public/img/` dosyalarını **tek commit** ile günceller; Vercel siteyi 1–2 dakikada yeniden yayınlar. Commit mesajında işlemi yapan kişi yazar (`Yönetim: AK-10008 eklendi (…@gmail.com)`), Firestore `islemler` koleksiyonunda da kayıt tutulur.
- Fotoğraflar sunucuda en fazla 1600 px webp olarak yeniden kodlanır, konum (EXIF/GPS) bilgisi silinir. Silinen ilanın başka ilanda kullanılmayan fotoğrafları da depodan kaldırılır.
- Aynı anda iki kişi kaydederse biri diğerinin değişikliğini ezmez (çakışmada güncel dosya okunup yeniden uygulanır).
- `data.json`'u yine elle de düzenleyebilirsiniz; yönetim uygulaması her açılışta güncel dosyayı GitHub'dan okur.

**GitHub anahtarı**

Fonksiyonlar, Secret Manager'daki **`GITHUB_TOKEN`** ile yazar: yalnızca `hsnkrlr/AkEmlak` deposu, *Contents: Read and write*, 1 yıl geçerli (fine-grained token). Süresi dolunca uygulama “GitHub anahtarının süresi dolmuş” der: GitHub'da yeni token oluşturup Secret Manager'a yeni sürüm olarak ekleyin ve `npx firebase deploy --only functions` çalıştırın. Yazılan dal `GITHUB_BRANCH` parametresidir (varsayılan: Vercel'in yayın dalı).

**Giriş teknik notu:** Google girişi açılır pencereyle yapılır; giriş sayfası Firebase'in kendi adresindedir (`akemlak-ilan.firebaseapp.com`), ek ayar gerekmez. Pencere açılamazsa uygulama yönlendirmeyle dener.

**Test**

```bash
npm run test:unit                      # yönetim arayüzü saf mantık testleri
(cd functions && npm test)             # sunucu mantığı (data.json, GitHub, yetki, fotoğraf, bildirim)
npm run test:rules                     # güvenlik kuralları (emülatör açıkken)
node scripts/e2e-yonetim.mjs           # uçtan uca (hazırlık adımları dosyanın başında)
```

## Google Analytics

GA4 ölçüm kimliği `G-D2F1KZ11MT` (`public/ga-init.js`). **Analytics yalnızca ziyaretçi çerez bandında "Tümünü kabul et" derse yüklenir.** "Yalnızca zorunlu" seçilirse yüklenmez; tercih değiştirilirse Analytics çerezleri silinir. Sayfa geçişleri GA4'ün "geliştirilmiş ölçüm" özelliğiyle otomatik sayılır.

## Güvenlik

- WhatsApp numarası ilan dosyasında değil kodda tutulur; tüm ilanlar her zaman resmi numaraya yönlenir.
- Sitede "kapora / ön ödeme istemeyiz" uyarısı ve ilan numaraları gösterilir.
- İlan dosyasındaki tüm metinler güvenli biçimde gösterilir (HTML/kod çalıştırılamaz).
- Fotoğraflar yalnızca sitenin kendi `img/` klasöründen yüklenir.
- CSP uygulanır: betikler ve bağlantılar yalnızca sitenin kendisine ve gerekli Google hizmetlerine (Analytics, Firebase, reCAPTCHA) izinlidir. Site başka bir sayfaya gömülemez (clickjacking koruması).
- Sunucu başlık dosyaları:
  - Vercel: `vercel.json`
  - Netlify / Cloudflare: `_headers`, `_redirects`
  - Apache / cPanel: `.htaccess`
