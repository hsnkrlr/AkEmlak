# Ak Emlak Yönetim Uygulaması — Tasarım

Tarih: 2026-10-26 · Durum: onay bekliyor

## 1. Amaç

İki yetkilinin (hasankurulurofficial@gmail.com, akdemirh540@gmail.com) telefondan:

- `/ilan-basvurusu` formundan gelen başvuruları okuması, not düşmesi, satıcıyı araması / WhatsApp'tan yazması,
- başvuruyu onaylayıp ilana dönüştürmesi ya da reddetmesi,
- doğrudan yeni ilan girmesi,
- sitedeki ilanları düzenlemesi, satıldı/kiralandı işaretlemesi, gizlemesi, silmesi,
- yeni başvuruda telefona bildirim alması.

**Başarı ölçütü:** `data.json`'a elle dokunmadan ilan yayınlanabilir ve yönetilebilir. Yetkili listesinde olmayan hiç kimse (Google hesabı olsa bile) hiçbir veriyi göremez ve değiştiremez.

### Kullanıcının kararları

- Telefona kurulum: ana ekrana eklenen web uygulaması (PWA). Mağaza yok, APK yok.
- Giriş: Google hesabı. Yalnızca yetkili listesindeki hesaplar çalışır.
- Siteye yansıtma: GitHub'daki `public/data.json` (ve `public/img/`) güncellenir, Vercel yeniden yayınlar (1–2 dk).
- Kapsam: okuma, onay/ret, ilana dönüştürme, doğrudan ilan girme, yayındaki ilanları yönetme, push bildirimi, ara/WhatsApp, notlar.

### Kapsam dışı

- Çevrimdışı çalışma.
- Birden fazla rol (herkes aynı yetkide).
- Ziyaretçi tarafında değişiklik. Başvuru formu ve mevcut kurallar aynen kalır.

## 2. Mimari

```
Telefon (PWA, /yonetim)
  ├─ Firebase Auth (Google, ayrı uygulama örneği "yonetim")
  ├─ Firestore: basvurular (oku, durum/not yaz), yetkililer (kendi kaydı), cihazlar
  ├─ Storage: basvurular/** (oku), yonetim/{uid}/** (ilan fotoğrafı yükle)
  └─ Callable fonksiyonlar (App Check zorunlu)
        ├─ ilanlariGetir  → GitHub'dan data.json (+ sha)
        ├─ ilanKaydet     → yeni/güncel ilan + fotoğraflar → tek GitHub kaydı
        └─ ilanIslem      → durum (yayinda/satildi/gizli), firsat, sil → tek GitHub kaydı
basvuruKontrolVeBildirim (mevcut) → e-postaya ek olarak FCM push
GitHub kaydı → Vercel yeniden derler → site + SEO sayfaları güncellenir
```

### 2.1 Ayrı derleme

- `yonetim/index.html` Vite'a ikinci giriş noktası (`build.rollupOptions.input`) olarak eklenir. Yönetim kodu ve Firebase Auth/Messaging ziyaretçi paketine girmez.
- Kod `src/yonetim/` altında durur. Ortak tipler ve biçimlendirme (`format.ts`, `apply.ts` sabitleri) paylaşılır.
- `vercel.json`:
  - `/yonetim` ve `/yonetim/*` → `/yonetim/index.html`.
  - Ana sayfaya yönlendiren catch-all kuralına istisna eklenir.
  - Başlıklar: `X-Robots-Tag: noindex, nofollow` ve HTML için `Cache-Control: no-store`.
- `robots.txt`: `Disallow: /yonetim`.
- PWA:
  - Manifest: `yonetim/manifest.webmanifest`, `scope` ve `start_url` `/yonetim/`, adı "Ak Emlak Yönetim", logodaki AK simgesi.
  - Service worker: `/yonetim/sw.js`, yalnızca push bildirimi. Önbellekleme yapmaz; her açılışta veriler sunucudan gelir.
- Yönetim sayfasının kendi CSP'si:
  - `connect-src`'ye eklenenler: `fcmregistrations.googleapis.com`, `firebaseinstallations.googleapis.com`, `europe-west3-akemlak-ilan.cloudfunctions.net`.
  - `img-src`: `blob:`. Başvuru fotoğrafları `getBlob` ile okunur.
  - `frame-src`: `'self'` (oturum açma iframe'i).

### 2.2 Giriş

- `signInWithRedirect` + `GoogleAuthProvider` kullanılır. iPhone'da ana ekrandan açılan uygulamada açılır pencere (popup) güvenilir değil.
- `authDomain` = `ak-emlak.vercel.app`. Vercel `/__/auth/*` isteklerini `https://akemlak-ilan.firebaseapp.com/__/auth/*` adresine aktarır. Böylece üçüncü taraf çerez kısıtlamalarına (Safari, Chrome) takılmaz.
- Firebase uygulaması `initializeApp(config, 'yonetim')` adıyla başlatılır. Oturum, ziyaretçi formunun anonim oturumuyla karışmaz.
- **Kullanıcının yapacağı tek seferlik işler (konsolda):**
  1. Authentication → Google sağlayıcısını etkinleştirmek.
  2. Google Cloud → OAuth istemcisine `https://ak-emlak.vercel.app/__/auth/handler` yönlendirme adresini eklemek.

### 2.3 Yetki

- Firestore `yetkililer/{eposta}` belgeleri: `{ ad, eklendi }`. İlk iki kayıt kurulumda eklenir. Yalnızca Firebase konsolundan değiştirilir; istemci yalnızca kendi belgesini okuyabilir.
- Kurallardaki ortak koşul:
  ```
  function yetkili() {
    return request.auth != null
      && request.auth.token.firebase.sign_in_provider == 'google.com'
      && request.auth.token.email_verified == true
      && exists(/databases/$(database)/documents/yetkililer/$(request.auth.token.email));
  }
  ```
- Callable fonksiyonlar:
  - Seçenekler: `enforceAppCheck: true`, `consumeAppCheckToken: false`.
  - Her çağrıda aynı üç koşulu Admin SDK ile denetler. Yetkisizse `permission-denied` döner.
- App Check ve API anahtarı kısıtlamaları mevcut hâliyle kalır. API anahtarına `fcmregistrations.googleapis.com` ve `cloudfunctions.googleapis.com` eklenir.

## 3. Veri

### 3.1 Başvuru (mevcut `basvurular/{id}`)

Yeni alanlar (yalnızca yetkili yazabilir):

- `status`: `yeni` | `supheli` | `inceleniyor` | `onaylandi` | `reddedildi`
- `inceleme`: `{ guncelleyen: email, guncellendi: timestamp, ilanNo?: string, redSebebi?: string (≤300) }`

Kurallar:

- Yetkili okuyabilir.
- Yetkili güncellemede yalnızca `status` ve `inceleme` değişebilir. Bu kurallar `affectedKeys().hasOnly([...])` ile denetlenir.
- `inceleme.guncelleyen == request.auth.token.email` olmalı.
- `inceleme.guncellendi == request.time` olmalı.
- Silme kapalı. Başvurular 2 yıl sonra mevcut gece temizliğiyle silinir.

### 3.2 Notlar (`basvurular/{id}/notlar/{notId}`)

- Alanlar: `{ metin (1–1000), yazan: email, tarih }`.
- Yetkili oluşturabilir (`yazan` kendi e-postası, `tarih == request.time`).
- Yetkili okuyabilir.
- Yalnızca yazan silebilir.
- Güncelleme kapalı.

### 3.3 Cihazlar (`yetkililer/{eposta}/cihazlar/{id}`)

- Alanlar: `{ token, eklendi, cihaz (kısa tarayıcı adı) }`.
- Kişi yalnızca kendi altına ekleyip silebilir.
- Fonksiyon geçersiz token'ları temizler.

### 3.4 İşlem kaydı (`islemler/{auto}`)

- Yalnızca fonksiyonlar yazar.
- Alanlar: `{ kim, ne (ekle|duzenle|durum|sil), ilanNo, commit, tarih }`.
- Yetkili okuyabilir.

### 3.5 İlan fotoğrafı yükleme (Storage `yonetim/{uid}/{dosya}`)

- Yalnızca yetkili ve kendi uid klasörüne yükleyebilir. Yetki için Firestore'daki `yetkililer` belgesi `firestore.exists` ile denetlenir.
- Dosya kuralları: webp/jpeg, < 3 MB, ad deseni mevcut kuraldakiyle aynı.
- Başvuru fotoğrafları (`basvurular/**`): yetkili okuyabilir, ziyaretçi kuralı değişmez.
- Gece temizliği `yonetim/` altındaki 24 saatten eski dosyaları siler; yayınlananlar zaten depoya kopyalanmıştır.
- Bucket CORS: `https://ak-emlak.vercel.app` için GET (`getBlob` için gerekli).

## 4. Sunucu fonksiyonları (europe-west3, Node 22)

Ortak modül `functions/src/github.ts`:

- Secret Manager'dan `GITHUB_TOKEN` alınır: fine-grained, yalnızca `hsnkrlr/AkEmlak` deposu, Contents: Read and write, 1 yıl geçerli.
- Parametreler: `GITHUB_REPO = hsnkrlr/AkEmlak`, `GITHUB_BRANCH = ccr-02329762-r3ekpj` (Vercel'in yayın dalı).
- `oku()`: dalın son commit'i, `public/data.json` içeriği ve sha.
- `yaz(degisiklik, mesaj)`: Git Data API ile çalışır. Adımlar:
  1. Fotoğraflar için blob oluşturulur.
  2. Yeni `data.json` için blob oluşturulur.
  3. Silinen fotoğraflar için `sha: null` ağaç girdisi eklenir.
  4. Tree, ardından commit oluşturulur.
  5. Ref, `force: false` ile güncellenir.
  - Ref çakışırsa (başka bir değişiklik araya girdiyse) `data.json` yeniden okunur, değişiklik yeniden uygulanır ve en fazla 3 kez denenir.
  - Commit mesajı: `Yönetim: AK-10008 eklendi (hasankurulurofficial@gmail.com)`.

Saf mantık modülü `functions/src/ilanlar.ts` (birim testli, ağ erişimi yok):

- `dogrula(girdi)`: alanları `src/lib/schema.ts` ile aynı sınırlara göre temizler. `baslik` zorunlu, metinler kırpılır, sayılar aralıkta tutulur, kategori/tür/durum listede olmalı, en fazla 10 fotoğraf.
- `sonrakiIlanNo(ilanlar)`: en büyük `AK-n` + 1.
- `ekle / guncelle / durumDegistir / sil(veri, ...)`: `data.json` nesnesini değiştirir. Bilinmeyen alanlar ve elle eklenmiş ilanlar korunur. JSON 2 boşluk girintiyle yazılır.
- `kullanilmayanFotograflar(eski, yeni)`: başka bir ilanda kullanılmayan dosyalar silinir.

Callable'lar:

- `ilanlariGetir()` → `{ ilanlar, sha }`.
- `ilanKaydet({ ilan, ilanNo?, fotograflar: [{ mevcut: "dosya.webp" } | { yukleme: "yonetim/uid/x.webp" } | { basvuru: "basvurular/uid/x.webp" }], basvuruId? })`:
  - Storage kaynakları okunur. Sihirli baytlarla gerçekten resim olduğu doğrulanır. `sharp` ile en fazla 1600 px, webp q82 olarak yeniden kodlanır; EXIF/GPS bilgisi silinir.
  - Dosya adı: `ak-10008-1-x7k2.webp`.
  - Tek commit atılır.
  - `basvuruId` verilmişse başvuru `onaylandi` yapılır ve `inceleme.ilanNo` yazılır.
  - İşlem kaydı eklenir.
  - Dönen değer: `{ ilanNo, baglanti, commit }`.
- `ilanIslem({ ilanNo, islem: 'yayinda'|'satildi'|'gizli'|'firsat'|'firsatKaldir'|'sil' })` → tek commit + işlem kaydı.
- Mevcut `basvuruKontrolVeBildirim` fonksiyonuna ek: başvuru `supheli` değilse tüm yetkililerin cihazlarına FCM gönderilir. Bildirim başlığı "Yeni ilan başvurusu B-XXXXXX", gövdesi "Müstakil Ev · Nurdağı". Bildirime dokununca `/yonetim/#/basvuru/{id}` açılır. Gönderilemeyen token'lar silinir.

Hata mesajları kullanıcıya Türkçe ve açık döner:

- "GitHub anahtarının süresi dolmuş"
- "Başka bir değişiklik aynı anda yapıldı, tekrar deneyin"
- "Fotoğraf okunamadı"

## 5. Ekranlar (`src/yonetim/`)

Alt sekmeler: **Başvurular · İlanlar · Ayarlar**. Sağ üstte **+ Yeni ilan**. Yönlendirme hash tabanlıdır (`#/basvuru/:id`), çünkü PWA ve Vercel yönlendirmesi bu yolla daha basit.

1. **Giriş:** logo + "Google ile giriş yap". Yetkisiz hesapta "Bu hesabın yetkisi yok" mesajı ve Çıkış düğmesi.
2. **Başvurular:**
   - Filtre çipleri ve sayıları: Yeni · İnceleniyor · Onaylandı · Reddedildi · Şüpheli.
   - Kart: kapak fotoğrafı, tip, konum, satıcı, göreli zaman; tekrar gönderimlerde "2. sürüm" etiketi.
   - Firestore `onSnapshot` ile canlı liste (son 100).
3. **Başvuru detayı:**
   - Galeri (büyütme), bilgiler, Ara (`tel:`), WhatsApp (`wa.me`, hazır mesaj).
   - Notlar (canlı).
   - Açılınca `yeni` → `inceleniyor`.
   - Reddet (sebep sorulur).
   - **İlana dönüştür:** düzenleyici başvurudan doldurulur, başlık önerisi hazır gelir, fotoğraflar seçili gelir.
4. **İlan düzenleyici:**
   - `data.json` alanları tipe göre gösterilir; tipler ve alanlar `apply.ts` ile ortak.
   - Fotoğraf seç/sırala/kaldır (en fazla 10, ilki kapak). Yeni fotoğraflar `preparePhoto` ile cihazda küçültülüp `yonetim/{uid}/` altına yüklenir.
   - Kaydet → "Yayına alınıyor…" → "Sitede yayında, 1–2 dk içinde görünür" + bağlantı.
   - Hata olursa form korunur, "Tekrar dene" çıkar.
5. **İlanlar:**
   - `ilanlariGetir` ile güncel liste ve durum etiketleri.
   - İşlemler: Düzenle, Satıldı/Kiralandı, Gizle/Göster, Fırsat, Sil (ikinci onay).
6. **Ayarlar:** bu cihazda bildirim aç/kapat (izin ister, token kaydeder/siler), hesap, Çıkış, iPhone için "Ana ekrana ekle" anlatımı.

Görünüm sitenin açık temasıyla uyumludur. Mobil önceliklidir, büyük dokunma alanları kullanılır.

## 6. Güvenlik özeti

- Ziyaretçi: hiçbir değişiklik yok; anonim oturum yalnızca başvuru oluşturabilir.
- Yetkisiz Google hesabı: Firestore, Storage ve fonksiyonların hepsi reddeder.
- App Check zorunlu: Firestore, Storage, Auth, Functions.
- Siteye yazma yalnızca sunucuda yapılır. GitHub anahtarı istemciye hiç inmez ve yalnızca tek depoya yazabilir.
- Her değişiklik GitHub geçmişinde ve `islemler`'de kimle birlikte kayıtlıdır.
- Girdiler sunucuda yeniden doğrulanır, fotoğraflar yeniden kodlanır.
- Yönetim sayfası Google'da çıkmaz, başka sitelere gömülemez, HTML'i önbelleğe alınmaz.

## 7. Test

- **Kural testleri** (emülatör): anonim, yetkisiz Google, e-postası doğrulanmamış ve yetkili kullanıcılarla okuma ve güncellemeler; yalnızca izinli alanların değişmesi; notlar; cihazlar; Storage `yonetim/`. Mevcut 36 test de geçmeli.
- **Birim testleri** (`node --test`): `ilanlar.ts` (doğrulama, numara, ekle/güncelle/sil, fotoğraf temizliği, elle eklenmiş alanların korunması).
- **Fonksiyon testi:** emülatörde ve gerçek GitHub'da önce `yonetim-test` dalına yazılır, sonra yayın dalına geçilir.
- **Uçtan uca** (Playwright + emülatör): giriş (Auth emülatörü Google), başvuru → ilana dönüştür → kaydet, ilan işlemleri, yetkisiz hesap ekranı. 390 px mobil ekran görüntüleri.

## 8. Kurulum adımları (sıra)

1. Kullanıcı: Google sağlayıcısını etkinleştirir, OAuth yönlendirme adresini ekler, GitHub anahtarını oluşturup Secret Manager'a `GITHUB_TOKEN` olarak koyar. Bunlar için adım adım rehber verilecek.
2. Kurallar, indeksler, `yetkililer` kayıtları, CORS, API anahtarı ve FCM API'si.
3. Fonksiyonların yayınlanması (`ilanlariGetir`, `ilanKaydet`, `ilanIslem`, güncellenen bildirim).
4. Site derlemesi (`/yonetim`), Vercel.
5. Kullanıcı telefonda giriş yapar, ana ekrana ekler, bildirimi açar; birlikte bir deneme ilanı yayınlayıp siler.
