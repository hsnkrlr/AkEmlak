# Ak Emlak — Emlak İlan Sitesi

Tamamen tarayıcıda çalışan, **backend'siz** emlak ilan sitesi. React + Vite + TypeScript ile yazıldı ve statik dosya olarak yayınlanır.

| Adres | İçerik |
|---|---|
| `/` | İlan listesi, arama ve filtreler |
| `/detay/{ilan-adi}` | İlan detayı, galeri ve WhatsApp iletişim |
| `/admin/login` | Yönetici girişi |
| `/admin` | Oturum yoksa **tamamen boş sayfa**. Giriş yapıldıysa ilan ekleme, düzenleme, silme ve yayınlama |

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ klasörü oluşur, bu klasörü barındırma hizmetine yükleyin
```

**Yayından önce `src/config.ts` içinde şu değerleri ayarlayın:**

- `whatsappNumber`
- `phoneDisplay`
- `city`
- `siteUrl`
- `GITHUB` (yayınların yazılacağı repo; varsayılanı `hsnkrlr/AkEmlak`)

> Site **HTTPS** ile sunulmalıdır. Tarayıcılar şifreleme API'sini (Web Crypto) yalnızca güvenli bağlantıda açar.

## Şifre

Şifre kodda düz metin olarak bulunmaz. `src/security/credentials.ts` dosyasında yalnızca PBKDF2 tuzu ve doğrulama özeti vardır.

Şifreyi değiştirmek için:

```bash
npm run setup-admin -- "YeniŞifre"
npm run build
```

Bu komut ayrıca:

- yeni bir yayın imza anahtarı üretir,
- `public/data/listings.json` dosyasını bu yeni anahtarla yeniden imzalar.

## Veri nasıl saklanır ve yayınlanır?

Sunucu yoktur; ilanların tek kaynağı repodaki `public/data/` klasörüdür (`listings.json` + `img/`).

1. Yöneticinin değişiklikleri önce o cihazın tarayıcısında (**IndexedDB**) saklanır. Bu aşamada müşteriler görmez.
2. **Yayınla → Siteye Yayınla** düğmesi ilanları imzalar ve fotoğraflarla birlikte GitHub reposuna tek commit olarak yazar.
3. Vercel bu commit'i görüp siteyi 1–2 dakika içinde otomatik günceller.

İlk kullanımda her cihaza bir kez GitHub erişim anahtarı (fine-grained token) girilir:

- Yalnızca bu repo seçilmeli ve yalnızca **Contents: Read and write** izni verilmelidir.
- Anahtar, yönetici şifresinden türetilen anahtarla şifrelenip yalnızca o cihazda saklanır.

GitHub dışı bir barındırma için alternatif: **Diğer seçenekler → Yayın paketini indir (.zip)**.

### Verilerin korunması

- **Kod güncellemeleri:** `public/data/` klasörüne dokunmaz. Bu klasörü yalnızca yönetim paneli değiştirir. Kod güncellemesi yapmadan önce mutlaka `git pull` ile panelden yapılan yayınları alın.
- **Şifre değişikliği:** `npm run setup-admin` mevcut ilanları silmez, yalnızca yeni anahtarla yeniden imzalar.
- **Birden fazla cihaz:** Başka bir cihazdan daha yeni bir yayın yapılmışsa, panel eski verinin üzerine yazmayı reddeder. Önce "Sitedeki sürümü yükle" ile güncellemeniz istenir.

## Güvenlik önlemleri

- **Şifre:** PBKDF2-SHA256 (600.000 tur) ve HKDF ile türetilir. Karşılaştırma sabit sürede yapılır.
- **Deneme sınırı:** Her cihazda 10 dakikada en fazla 3 hatalı deneme yapılabilir.
  - Kayıt üç ayrı yerde tutulur: localStorage, çerez ve IndexedDB. Yalnızca birini silmek kilidi kaldırmaz.
  - Oynanmış bir kayıt tam kilit olarak sayılır.
- **Oturum:** 15 dakika sonra kesin olarak biter ve uzatılmaz. Her girişte şifre yeniden istenir.
  - Belirteç HMAC ile imzalanır, sekmeye ve cihaza bağlıdır. Anahtar dışa aktarılamaz.
  - Yeni bir giriş eski oturumu geçersiz kılar. Çıkış yapıldığında tüm sekmelere haber verilir.
- **/admin:** Oturum yoksa hiçbir şey göstermez. Arama motorlarına kapalıdır (`noindex` ve robots.txt). Yönetim kodu ziyaretçi kodundan ayrı yüklenir.
- **İmzalı yayın (sahte yöneticiye karşı):** İlan verisi ECDSA P-256 özel anahtarıyla imzalanır. Bu anahtar yalnızca yönetici şifresiyle açılabilir.
  - Giriş ekranını atlatan biri geçerli bir yayın üretemez.
  - Barındırma tarafında dosya değiştirilirse (sahte ilan, sahte fiyat) site ilanları göstermeyi reddeder.
- **Ziyaretçi koruması:** WhatsApp numarası veri dosyasında değil kodda tutulur. Sitede "kapora istemeyiz" uyarısı ve ilan numaraları gösterilir.
- **İçerik güvenliği:**
  - Tüm metinler React tarafından kaçışlanır (escape).
  - CSP uygulanır ve sitenin başka bir sayfaya gömülmesi (clickjacking) engellenir.
  - Yüklenen görsellerin gerçek dosya imzası (magic bytes) kontrol edilir. Görseller tuvalde yeniden kodlanır; bu işlem EXIF/GPS bilgisini ve gizli içeriği siler.
  - Dışarıdan gelen veri katı şema doğrulamasından geçer.
- **Sunucu başlıkları:** Hazır yapılandırma dosyaları vardır:
  - Netlify / Cloudflare: `_headers` ve `_redirects`
  - Apache / cPanel: `.htaccess`
  - Vercel: `vercel.json`

> **Sınır:** Backend olmayan bir sistem, sunucu düzeyinde koruma sağlayamaz.
>
> - Cihaz başına deneme sınırı farklı bir tarayıcı veya cihazla aşılabilir.
> - Koddaki şifre özeti çevrimdışı saldırıya maruz kalabilir; 600 bin tur bunu ciddi biçimde yavaşlatır.
>
> Asıl koruma şudur: yayın yapmak için **hem şifre (imza) hem de barındırma paneline erişim** gerekir. Güçlü bir şifre kullanın ve barındırma şifrenizi koruyun.
