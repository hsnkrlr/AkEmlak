# Ak Emlak — Emlak İlan Sitesi

Backend'siz, statik bir emlak ilan sitesi (React + Vite + TypeScript). İlanlar tek bir dosyada, **`public/data.json`** içinde elle tutulur.

| Adres | İçerik |
|---|---|
| `/` | İlan listesi, arama ve filtreler |
| `/detay/{ilan-adi}` | İlan detayı, fotoğraf galerisi ve WhatsApp iletişim |

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

## Google Analytics

GA4 ölçüm kimliği `G-D2F1KZ11MT`. Etiket `index.html` içinde, başlatma kodu `public/ga-init.js` dosyasında. Kimliği değiştirmek için bu iki dosyayı güncelleyin. Sayfa geçişleri GA4'ün "geliştirilmiş ölçüm" (enhanced measurement) özelliğiyle otomatik sayılır.

## Güvenlik

- WhatsApp numarası ilan dosyasında değil kodda tutulur; tüm ilanlar her zaman resmi numaraya yönlenir.
- Sitede "kapora / ön ödeme istemeyiz" uyarısı ve ilan numaraları gösterilir.
- İlan dosyasındaki tüm metinler güvenli biçimde gösterilir (HTML/kod çalıştırılamaz).
- Fotoğraflar yalnızca sitenin kendi `img/` klasöründen yüklenir.
- CSP uygulanır: betikler yalnızca sitenin kendisinden ve Google Analytics'ten yüklenebilir. Site başka bir sayfaya gömülemez (clickjacking koruması).
- Sunucu başlık dosyaları:
  - Vercel: `vercel.json`
  - Netlify / Cloudflare: `_headers`, `_redirects`
  - Apache / cPanel: `.htaccess`
