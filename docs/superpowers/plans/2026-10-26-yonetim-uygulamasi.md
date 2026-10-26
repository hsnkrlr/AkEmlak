# Ak Emlak Yönetim Uygulaması — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/yonetim` adresinde, yalnızca yetkili Google hesaplarının girebildiği bir PWA kurmak. Uygulama başvuruları okuyup onaylar, ilan girer ve yönetir; değişiklikleri GitHub'daki `public/data.json` dosyasına yazarak siteye yansıtır.

**Architecture:** Mevcut Vite projesine ikinci bir giriş noktası (`yonetim/index.html`) eklenir.
- İstemci Firestore ve Storage'ı doğrudan kullanır; okuma, durum ve not işlemleri kurallarla korunur.
- Siteyi değiştiren her işlem App Check zorunlu callable fonksiyonlardan geçer. Bu fonksiyonlar Git Data API ile tek commit atar.
- Push bildirimi FCM ile, mevcut başvuru tetikleyicisinden gönderilir.

**Tech Stack:** React 18 + Vite 5 + TypeScript, Firebase JS SDK 13 (auth, firestore, storage, functions, messaging, app-check), Cloud Functions v2 (Node 22, europe-west3), firebase-admin, sharp, GitHub REST (Git Data API), node:test (Node 22 type stripping), @firebase/rules-unit-testing, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-yonetim-uygulamasi-design.md`

## Global Constraints

- Yetkili koşulu: `sign_in_provider == 'google.com'` VE `email_verified == true` VE `yetkililer/{email}` belgesi var. Bu koşul kurallarda, Storage'da ve fonksiyonlarda aynı biçimde uygulanır.
- İlk yetkililer: `hasankurulurofficial@gmail.com`, `akdemirh540@gmail.com`.
- GitHub: depo `hsnkrlr/AkEmlak`, yayın dalı `ccr-02329762-r3ekpj`, secret `GITHUB_TOKEN`; test dalı `yonetim-test`.
- Fonksiyon bölgesi `europe-west3`; callable seçenekleri `enforceAppCheck: true`, `consumeAppCheckToken: false`.
- Firebase istemcisi `initializeApp(FIREBASE_CONFIG, 'yonetim')` ile başlatılır; `authDomain: 'ak-emlak.vercel.app'`; giriş `signInWithRedirect`.
- Durumlar: başvuru `yeni|supheli|inceleniyor|onaylandi|reddedildi`; ilan `durum` `yayinda|satildi|gizli`.
- Fotoğraflar: en fazla 10; `sharp` ile en fazla 1600 px, webp q82, meta veri yok; ad deseni `ak-<n>-<sira>-<4 karakter>.webp`.
- Commit mesajı: `Yönetim: <ilanNo> <eklendi|güncellendi|satıldı|gizlendi|yayına alındı|fırsat|silindi> (<email>)`.
- Kullanıcıya görünen bütün metinler Türkçe olmalı. Ziyaretçi paketine yönetim kodu girmemeli.
- `data.json` yazımı: `JSON.stringify(veri, null, 2) + '\n'`. Bilinmeyen alanlar ve elle eklenen ilanlar korunur.
- Saf (ağsız) modüller yerel dosyaları yalnızca `import type` ile alır; testler `node --test` ile `.ts` dosyalarını doğrudan çalıştırır.

## Review Focus

1. Elle düzenlenmiş `data.json`'da `ilanNo` olmayan ya da `AK-` dışı numaralı ilanlar: numara üretimi bozulmamalı, bu ilanlar korunmalı ve "baglanti" ile bulunabilmeli. → Görev 1'de `sonrakiIlanNo` ve `guncelle` testleri.
2. İki yetkilinin aynı anda kaydetmesi (ref çakışması): ikinci kayıt ilkinin değişikliğini silmemeli. → Görev 2'de çakışma testi.
3. Süresi dolmuş veya yanlış GitHub anahtarı (401/403/404): kullanıcıya "GitHub anahtarının süresi dolmuş veya yetkisi yok" mesajı gitmeli, form kaybolmamalı. → Görev 2 testi ve Görev 9 hata durumu.
4. Başka ilanda da kullanılan fotoğrafı olan ilanın silinmesi: ortak dosya silinmemeli. → Görev 1'de `kullanilmayanFotograflar` testi.
5. Yetkili listesinde olmayan Google hesabı veya e-postası doğrulanmamış hesap: hiçbir okuma, yazma ya da fonksiyon çalışmamalı; "yetkiniz yok" ekranı görünmeli. → Görev 4 kural testleri, Görev 3 `yetkiliMi` testi, Görev 11 uçtan uca.

---

### Görev 1: İlan verisi mantığı (`functions/src/ilanlar.ts`)

**Files:**
- Create: `functions/src/ilanlar.ts`
- Test: `functions/test/ilanlar.test.ts`
- Modify: `functions/package.json` (script `"test": "node --test test/"`)

**Interfaces:**
- Produces:
  - `type DataJson = { ilanlar: IlanJson[]; [k: string]: unknown }`
  - `type IlanJson = { ilanNo?: string; baslik: string; durum?: string; firsat?: boolean; fotograflar?: string[]; baglanti?: string; [k: string]: unknown }`
  - `type IlanIslem = 'yayinda' | 'satildi' | 'gizli' | 'firsat' | 'firsatKaldir' | 'sil'`
  - `dogrula(girdi: unknown): { ok: true; ilan: IlanJson } | { ok: false; hata: string }`
    - Alanlar ve sınırlar `src/lib/schema.ts` ile aynıdır: `baslik` ≤140 zorunlu; `tur ∈ {satilik,kiralik}`; `kategori ∈ CATEGORY_LABEL anahtarları`; `fiyat` 0–1e12; `paraBirimi ∈ {TRY,USD,EUR}`; `ozellikler` ≤20 adet ×60; `aciklama` ≤5000; `durum ∈ {yayinda,satildi,gizli}`.
    - `ilanNo`, `tarih` ve `fotograflar` girdiden alınmaz.
  - `sonrakiIlanNo(ilanlar: IlanJson[]): string`
  - `ekle(veri: DataJson, ilan: IlanJson, ilanNo: string, tarih: string, fotograflar: string[]): DataJson` (ilanı listenin başına ekler)
  - `guncelle(veri: DataJson, ilanNo: string, ilan: IlanJson, fotograflar: string[]): DataJson` (bilinmeyen alanları, `tarih`'i ve `ilanNo`'yu korur)
  - `islemUygula(veri: DataJson, ilanNo: string, islem: IlanIslem): DataJson`
  - `kullanilmayanFotograflar(eski: DataJson, yeni: DataJson): string[]`
  - `fotografAdi(ilanNo: string, sira: number, rastgele: string): string` (örnek: `('AK-10008', 1, 'x7k2') → 'ak-10008-1-x7k2.webp'`)
  - `yaziyaDok(veri: DataJson): string`
  - `ilanBul(veri: DataJson, ilanNo: string): IlanJson | undefined`; bulunamazsa diğer fonksiyonlar `Error('İlan bulunamadı: <ilanNo>')` fırlatır.

- [ ] **Step 1: Write the failing tests** — `node:test` + `assert/strict`:
  - `sonrakiIlanNo([{ilanNo:'AK-10006'},{ilanNo:'AK-10007'},{baslik:'x'},{ilanNo:'ÖZEL-1'}]) === 'AK-10008'`; boş listede `'AK-10001'`.
  - `dogrula({})` → `ok:false`, hata `'Başlık zorunlu.'`. `dogrula({baslik:' Ev ', fiyat:'8.000', kategori:'uzay'})` → `baslik:'Ev'`, `fiyat:8000`, `kategori:'diger'`. `dogrula({baslik:'a', ilanNo:'AK-1', fotograflar:['../x']})` sonucunda `ilanNo` ve `fotograflar` yok.
  - `guncelle` sonrası elle eklenmiş `{ozelAlan: 1}` ve `tarih` korunur, `ilanNo` değişmez.
  - `islemUygula(v,'AK-10006','satildi').ilanlar[i].durum === 'satildi'`; `'firsat'` → `firsat:true`; `'sil'` → ilan yok, diğerleri aynı sırada.
  - `kullanilmayanFotograflar`: A ve B ilanı `ortak.webp`'yi paylaşıyorsa A silinince sonuç `['a-1.webp']` (`ortak.webp` yok).
  - `yaziyaDok` 2 boşluk girintili ve `\n` ile biter.
  - Bilinmeyen `ilanNo` için `guncelle` ve `islemUygula` `/İlan bulunamadı/` fırlatır.
- [ ] **Step 2:** `cd functions && node --test test/` → FAIL (modül yok).
- [ ] **Step 3:** `ilanlar.ts`'i yaz.
- [ ] **Step 4:** `cd functions && node --test test/` → PASS; `npm run typecheck` temiz.
- [ ] **Step 5:** Commit `Yönetim: ilan verisi mantığı ve testleri`.

### Görev 2: GitHub yazıcı (`functions/src/github.ts`)

**Files:**
- Create: `functions/src/github.ts`
- Test: `functions/test/github.test.ts`

**Interfaces:**
- Consumes: `DataJson`, `yaziyaDok` (Görev 1, yalnızca `import type` + parametre olarak geçirilen `yaziyaDok`)
- Produces:
  - `interface Depo { oku(): Promise<{ veri: DataJson; commit: string }>; yaz(hazirla: (veri: DataJson) => Promise<Hazirlik>, mesaj: string): Promise<{ commit: string; veri: DataJson }> }`
  - `interface Hazirlik { veri: DataJson; ekle: { yol: string; icerik: Buffer }[]; sil: string[] }`
  - `depoOlustur(o: { token: string; repo: string; branch: string; fetch?: typeof fetch; yaziyaDok: (v: DataJson) => string }): Depo`
  - `class GithubHatasi extends Error { kod: 'anahtar' | 'cakisma' | 'diger' }`

`yaz` akışı:
1. Ref → commit → base tree okunur.
2. `data.json` okunur: `contents?ref=` ile ham içerik.
3. `hazirla(veri)` çağrılır.
4. Her `ekle` için blob oluşturulur (base64), `data.json` için blob oluşturulur.
5. Tree (`base_tree` + `sil` için `sha: null`), ardından commit oluşturulur.
6. `PATCH refs/heads/<branch>` `force:false` ile güncellenir.

Hata durumları:
- 422 veya "not a fast forward": baştan başlanır, `hazirla` yeniden çağrılır. En fazla 3 deneme; sonra `GithubHatasi('cakisma')`.
- 401, 403 veya 404: `GithubHatasi('anahtar', 'GitHub anahtarının süresi dolmuş veya yetkisi yok')`.

- [ ] **Step 1: Failing tests** — sahte `fetch`, istekleri kaydeden bir tablo:
  - Başarılı yazımda son istek `PATCH .../git/refs/heads/yonetim-test` ve gövdesi `{sha:'<yeni commit>', force:false}`.
  - Tree isteğinde `public/data.json` ve `public/img/ak-10008-1-x7k2.webp` var; `sil:['public/img/eski.webp']` için `{path:'public/img/eski.webp', sha:null}` var.
  - İlk PATCH 422 dönerse `hazirla` iki kez çağrılır ve ikinci çağrıya güncel `veri` gelir; sonuç başarılı.
  - Üç kez 422 dönerse `GithubHatasi` fırlar, `kod === 'cakisma'`.
  - İlk istek 401 dönerse `kod === 'anahtar'`.
- [ ] **Step 2:** `node --test test/` → FAIL.
- [ ] **Step 3:** `github.ts`'i yaz. `Authorization: Bearer`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28` başlıklarını kullan.
- [ ] **Step 4:** Testler PASS, typecheck temiz.
- [ ] **Step 5:** Commit `Yönetim: GitHub'a tek commit ile yazma`.

### Görev 3: Yetki, fotoğraf işleme ve callable fonksiyonlar

**Files:**
- Create: `functions/src/yetki.ts`, `functions/src/resim.ts`, `functions/src/yonetim.ts`
- Modify: `functions/src/index.ts` (`isImage`'i `resim.ts`'e taşı ve oradan import et; `export * from './yonetim'`; `gunlukTemizlik` `yonetim/` altındaki 24 saatten eski dosyaları da siler), `functions/package.json` (`sharp` bağımlılığı)
- Test: `functions/test/yetki.test.ts`, `functions/test/resim.test.ts`

**Interfaces:**
- Consumes: Görev 1 ve Görev 2'nin tümü.
- Produces:
  - `yetkiliMi(auth: { token: Record<string, unknown> } | undefined, varMi: (email: string) => Promise<boolean>): Promise<string | null>` (yetkiliyse e-postayı döner)
  - `isImage(buf: Buffer): boolean`
  - `fotografIsle(buf: Buffer): Promise<Buffer>` (resim değilse `Error('Fotoğraf okunamadı')`)
  - Callable `ilanlariGetir() → { ilanlar: IlanJson[]; commit: string }`
  - Callable `ilanKaydet(req: { ilan: unknown; ilanNo?: string; fotograflar: ({ mevcut: string } | { yukleme: string } | { basvuru: string })[]; basvuruId?: string }) → { ilanNo: string; baglanti: string; commit: string }`
  - Callable `ilanIslem(req: { ilanNo: string; islem: IlanIslem }) → { commit: string }`

Kurallar:
- `yukleme` yolu `^yonetim/<çağıranın uid'i>/[A-Za-z0-9_-]{16,40}\.(webp|jpg)$` desenine uymalı.
- `basvuru` yolu, `basvuruId` belgesinin `photos` listesinde bulunmalı.
- `mevcut` yolu, düzenlenen ilanın mevcut fotoğraflarından biri olmalı.
- `baglanti` = `https://ak-emlak.vercel.app/detay/<baglanti ya da slugify(baslik)>`.
- `ilanKaydet` başvuru ile çağrıldıysa başvuru `status:'onaylandi'`, `inceleme:{guncelleyen, guncellendi: serverTimestamp, ilanNo}` olur.
- Her callable `islemler`'e `{kim, ne, ilanNo, commit, tarih}` yazar.
- `secrets: [GITHUB_TOKEN]`; `GITHUB_BRANCH` `defineString` ile tanımlanır, varsayılanı `ccr-02329762-r3ekpj`.
- `HttpsError` kodları: yetkisiz → `permission-denied` ('Bu hesabın yetkisi yok.'); `dogrula` hatası → `invalid-argument`; `GithubHatasi` → `failed-precondition` (`anahtar`) veya `aborted` (`cakisma`).

- [ ] **Step 1: Failing tests:**
  - `yetkiliMi` geçerli `{email:'a@b.co', email_verified:true, firebase:{sign_in_provider:'google.com'}}` ve `varMi→true` için `'a@b.co'` döner.
  - Şu durumlarda `null` döner: `email_verified:false`, sağlayıcı `anonymous`, `varMi→false`, `auth` undefined.
  - `fotografIsle`: 3000×2000 EXIF'li JPEG (sharp ile üretilmiş) → çıktı webp, genişlik 1600, `metadata().exif` undefined.
  - `fotografIsle(Buffer.from('<svg'))` `/Fotoğraf okunamadı/` fırlatır.
- [ ] **Step 2:** Testler FAIL.
- [ ] **Step 3:** Modülleri yaz; callable'ları `yonetim.ts`'e koy.
- [ ] **Step 4:** `npm test` PASS. `npm run build` temiz. Emülatörde `ilanlariGetir`'i yetkisiz bir Auth emülatörü kullanıcısıyla çağır; `permission-denied` dönmeli.
- [ ] **Step 5:** Commit `Yönetim: yetki kontrolü, fotoğraf işleme ve ilan fonksiyonları`.

### Görev 4: Güvenlik kuralları ve indeksler

**Files:**
- Modify: `firebase/firestore.rules`, `firebase/storage.rules`, `firebase/firestore.indexes.json`
- Test: `firebase/test/rules.test.mjs` (yeni `describe('yönetim')` bloğu)

**Interfaces:**
- Produces (istemcinin güvendiği şekiller):
  - `basvurular/{id}` güncellemesinde yalnızca `status` ve `inceleme` değişebilir.
  - `inceleme` anahtarları `guncelleyen`, `guncellendi`, `ilanNo`, `redSebebi` dışına çıkamaz.
  - `notlar` için `{metin, yazan, tarih}`.
  - `yetkililer/{email}/cihazlar/{id}` için `{token, eklendi, cihaz}`.
  - `islemler` yalnızca okunabilir.
  - İndeks: `basvurular (status ASC, createdAt DESC)`.

- [ ] **Step 1: Failing tests.** Kimlikler: `yetkili` (google, doğrulanmış, kayıtlı), `kayitsiz` (google, doğrulanmış, kayıt yok), `dogrulanmamis` (google, `email_verified:false`, kayıtlı), `anonim`. Beklenenler:
  - yetkili `basvurular` okur; diğer üçü okuyamaz.
  - yetkili `{status:'inceleniyor', inceleme:{guncelleyen:<kendi>, guncellendi:serverTimestamp()}}` günceller.
  - `seller` alanını değiştiremez; başka bir `guncelleyen` yazamaz; silemez.
  - yetkili not ekler. Başka yetkilinin notunu silemez, kendi notunu siler. Not güncellenemez.
  - yetkili yalnızca kendi `cihazlar` koleksiyonuna yazar.
  - yetkili kendi `yetkililer` belgesini okur, başkasınınkini okuyamaz, hiçbirine yazamaz.
  - Storage: yetkili `yonetim/<uid>/abcdefghijklmnop1234.webp` (1 KB webp) yükler; kayitsiz yükleyemez; yetkili `basvurular/x/…` okur, anonim okuyamaz.
  - Mevcut 36 test hâlâ geçer.
- [ ] **Step 2:** Emülatör açıkken `npm run test:rules` → yeni testler FAIL.
- [ ] **Step 3:** Kuralları yaz. Storage için `firestore.exists(/databases/(default)/documents/yetkililer/$(request.auth.token.email))` kullan.
- [ ] **Step 4:** `npm run test:rules` → tümü PASS. İfade sınırı uyarısı olmamalı.
- [ ] **Step 5:** Commit `Yönetim: güvenlik kuralları ve testleri`.

### Görev 5: Bildirim (FCM) gönderimi

**Files:**
- Create: `functions/src/push.ts`
- Modify: `functions/src/index.ts` (`basvuruKontrolVeBildirim` içinde, e-postadan sonra `await bildirimGonder(...)`; hata e-postayı engellemez)
- Test: `functions/test/push.test.ts`

**Interfaces:**
- Produces: `bildirimGonder(o: { basvuru: { id: string; number: string; status: string; listing: { type: string; district?: string; city?: string } }; tokenlar: { ref: { delete(): Promise<unknown> }; token: string }[]; gonder: (mesajlar: object[]) => Promise<{ responses: { success: boolean; error?: { code: string } }[] }> }): Promise<{ gonderilen: number; silinen: number }>`
- Mesaj içeriği:
  - Başlık: `Yeni ilan başvurusu <number>`.
  - Gövde: `<TYPE_LABEL> · <district ya da city>`.
  - `webpush.fcmOptions.link`: `https://ak-emlak.vercel.app/yonetim/#/basvuru/<id>`.

- [ ] **Step 1: Failing tests:**
  - `status:'supheli'` → `gonder` hiç çağrılmaz, sonuç `{0,0}`.
  - İki token, ikincisi `messaging/registration-token-not-registered` döner → `silinen:1`, ikinci `ref.delete` çağrılır.
  - Başlık `'Yeni ilan başvurusu B-7K2Q9X'`, gövde `'Müstakil Ev · Nurdağı'`.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz. `index.ts` tokenları `collectionGroup('cihazlar')` ile toplar ve `getMessaging().sendEach` kullanır.
- [ ] **Step 4:** `npm test` ve `npm run build` PASS.
- [ ] **Step 5:** Commit `Yönetim: yeni başvuruda telefona bildirim`.

### Görev 6: Yönetim derlemesi, PWA kabuğu ve yayın ayarları

**Files:**
- Create: `yonetim/index.html`, `public/yonetim/manifest.webmanifest`, `public/yonetim/sw.js`, `public/yonetim/icon-192.png`, `public/yonetim/icon-512.png`, `src/yonetim/main.tsx` (geçici "Yükleniyor")
- Modify: `vite.config.ts`, `vercel.json`, `public/robots.txt` veya robots'u üreten yer (`scripts/seo-plugin.ts`)

Ayrıntılar:
- `vite.config.ts`:
  - `build.rollupOptions.input = { main: 'index.html', yonetim: 'yonetim/index.html' }`.
  - `cspPlugin` yönetim HTML'ine ayrı bir CSP koyar (`ctx.filename` ile ayırt edilir).
  - Yönetim CSP'sinde `script-src`'de googletagmanager yok.
  - `connect-src`'ye FIREBASE_CONNECT + `https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://europe-west3-akemlak-ilan.cloudfunctions.net` eklenir.
  - `img-src 'self' data: blob:`, `frame-src 'self' https://www.google.com https://recaptcha.google.com`.
- `vercel.json`:
  - rewrites `/__/auth/:path*` → `https://akemlak-ilan.firebaseapp.com/__/auth/:path*`.
  - `/yonetim` ve `/yonetim/` → `/yonetim/index.html`.
  - catch-all istisnasına `yonetim|__/` eklenir.
  - headers `/yonetim(.*)`: `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`.
- `robots.txt`: `Disallow: /yonetim`.
- `sw.js`: yalnızca Firebase Messaging compat arka plan işleyicisi ve `notificationclick` (bağlantıyı açma). `fetch` dinleyicisi yok.
- `yonetim/index.html`: `<meta name="robots" content="noindex,nofollow">`, manifest bağlantısı, `theme-color`.

- [ ] **Step 1:** `npm run build`.
- [ ] **Step 2:** Doğrulamalar:
  - `test -f dist/yonetim/index.html`.
  - `grep -L "signInWithRedirect\|yetkililer" dist/assets/index-*.js` ziyaretçi paketini listeler (yönetim kodu sızmamış).
  - `grep -c "fcmregistrations" dist/yonetim/index.html` ≥1.
  - `grep -c googletagmanager dist/yonetim/index.html` = 0.
- [ ] **Step 3:** Commit `Yönetim: ayrı derleme, PWA kabuğu ve yayın ayarları`.

### Görev 7: Oturum ve uygulama iskeleti

**Files:**
- Create: `src/yonetim/firebase.ts`, `src/yonetim/oturum.ts`, `src/yonetim/router.ts`, `src/yonetim/App.tsx`, `src/yonetim/Giris.tsx`, `src/yonetim/yonetim.css`
- Modify: `src/yonetim/main.tsx`, `src/firebase/config.ts` (gerekirse `ADMIN_AUTH_DOMAIN = 'ak-emlak.vercel.app'`)

**Interfaces:**
- Produces:
  - `firebase.ts`: `yonetimApp`, `auth`, `db`, `storage`, `functions` (`getFunctions(app,'europe-west3')`), `girisYap(): Promise<void>` (redirect), `cikisYap()`.
    - App Check: `ReCaptchaEnterpriseProvider` ile başlatılır.
    - Emülatör: `VITE_FIREBASE_EMULATOR==='1'` ise auth 9099, firestore 8080, storage 9199, functions 5001'e bağlanır ve App Check atlanır.
  - `oturum.ts`: `useOturum(): { durum: 'yukleniyor' | 'girissiz' | 'yetkisiz' | 'yetkili'; email?: string }`. Yetkiyi `getDoc(doc(db,'yetkililer',email))` ile denetler; okuma reddedilirse sonuç `yetkisiz` olur.
  - `router.ts`: `useRota(): { yol: string; parametre?: string }` ve `git(yol: string)`. Rotalar: `#/basvurular`, `#/basvuru/:id`, `#/ilanlar`, `#/ilan/yeni`, `#/ilan/:ilanNo`, `#/basvuru/:id/ilan`, `#/ayarlar`.
  - `App.tsx`: durumlara göre Giriş / Yetkisiz / alt sekmeli kabuk (Başvurular · İlanlar · Ayarlar) ve sağ üstte `+ Yeni ilan`.

- [ ] **Step 1:** `VITE_FIREBASE_EMULATOR=1` derlemesi + emülatör + Playwright.
  - Auth emülatöründe Google sağlayıcısıyla `kayitsiz@ornek.com` girişi yapılır → "Bu hesabın yetkisi yok" ve Çıkış görünür.
  - Firestore emülatörüne `yetkililer/hasankurulurofficial@gmail.com` eklenir, o hesapla giriş yapılır → alt sekmeler görünür.
  - Emülatörde redirect, Auth emülatörünün sahte Google ekranından geçer.
- [ ] **Step 2:** Bileşenleri yaz. Step 1'deki senaryo geçmeli; `npx tsc --noEmit -p .` temiz olmalı.
- [ ] **Step 3:** Commit `Yönetim: Google ile giriş ve uygulama iskeleti`.

### Görev 8: Başvurular, başvuru detayı ve notlar

**Files:**
- Create: `src/yonetim/basvurular/Liste.tsx`, `src/yonetim/basvurular/Detay.tsx`, `src/yonetim/basvurular/Notlar.tsx`, `src/yonetim/basvurular/veri.ts`, `src/yonetim/donustur.ts`, `src/yonetim/donustur.test.ts`
- Modify: `package.json` (script `"test:unit": "node --test src/yonetim/"`)

**Interfaces:**
- Consumes: `db`, `storage` (Görev 7); `TYPE_LABEL`, `FIELDS_BY_TYPE` (`src/lib/apply.ts`).
- Produces:
  - `veri.ts`:
    - `useBasvurular(durum: BasvuruDurum): { liste: Basvuru[]; sayilar: Record<BasvuruDurum, number> }` (`onSnapshot`, `orderBy('createdAt','desc')`, `limit(100)`)
    - `useBasvuru(id)`
    - `durumYaz(id, status, ek?: { redSebebi?: string; ilanNo?: string })`
    - `fotografUrl(yol): Promise<string>` (`getBlob` → `URL.createObjectURL`)
    - `useNotlar(id)`, `notEkle(id, metin)`, `notSil(id, notId)`
  - `donustur.ts`: `basvurudanIlan(b: { listing: Record<string, unknown> }): IlanTaslak` ve `baslikOner(listing): string`. Yerel importlar yalnızca `import type`; tip etiketleri dosyanın içinde tutulur.
  - Kategori eşlemesi:

    | Başvuru tipi | İlan `kategori` |
    |---|---|
    | daire | daire |
    | mustakil | mustakil |
    | villa | villa |
    | arsa | arsa |
    | tarla | tarla |
    | isyeri | isyeri |
    | arac | otomobil |
    | diger | diger |

  - Alan eşlemesi:

    | Başvuru alanı | İlan alanı |
    |---|---|
    | deal | tur |
    | city | il |
    | district | ilce |
    | neighborhood | mahalle |
    | price | fiyat |
    | grossM2 | brutM2 |
    | netM2 | netM2 |
    | rooms | odaSayisi |
    | bathrooms | banyoSayisi |
    | floor | kat |
    | buildingAge | binaYasi |
    | heating | isitma |
    | brand | marka |
    | model | model |
    | modelYear | modelYili |
    | km | km |
    | fuel | yakit |
    | gear | vites |
    | features | ozellikler |
    | description | aciklama |
    | address | — (ilana konmaz; açık adres yayınlanmaz) |
    | furnished: true | ozellikler'e `'Eşyalı'` |
    | inSite: true | ozellikler'e `'Site İçinde'` |

  - `IlanTaslak` = `IlanJson` alanları (Görev 1 ile aynı adlar), `ilanNo` ve `fotograflar` hariç.

- [ ] **Step 1: Failing test (`donustur.test.ts`):**
  - `baslikOner({type:'mustakil', deal:'kiralik', district:'Nurdağı', neighborhood:'Esenyurt'}) === "Nurdağı Esenyurt'ta Kiralık Müstakil Ev"`.
  - `basvurudanIlan({listing:{type:'arac', brand:'Renault', km:120000}})` → `kategori:'otomobil'`, `marka:'Renault'`, `km:120000`.
  - `address` sonuçta yok.
  - `furnished:true` → `ozellikler` `'Eşyalı'` içerir.
- [ ] **Step 2:** `npm run test:unit` FAIL. **Step 3:** Yaz. **Step 4:** PASS.
- [ ] **Step 5:** Ekranlar:
  - Liste: filtre çipleri ve sayılar; kart: kapak, tip, konum, satıcı, göreli zaman, `resubmission.revision>0` ise "N. sürüm".
  - Detay:
    - Açılınca `yeni` → `inceleniyor`.
    - Galeri, bilgiler.
    - `tel:+90…` ve `https://wa.me/90…?text=` düğmeleri. Mesaj: `Merhaba, <number> numaralı ilan başvurunuzla ilgili yazıyorum.`
    - Notlar.
    - Reddet (sebep ≤300).
    - "İlana dönüştür" → `#/basvuru/:id/ilan`.
- [ ] **Step 6:** Emülatörde Playwright, 390 px:
  - Seed edilmiş başvuru listede görünür.
  - Detay açılınca durum `inceleniyor` olur.
  - Not eklenir ve görünür.
  - Reddet → durum `reddedildi`.
  - Ekran görüntüleri alınır.
- [ ] **Step 7:** Commit `Yönetim: başvuru listesi, detay ve notlar`.

### Görev 9: İlan düzenleyici ve İlanlar ekranı

**Files:**
- Create: `src/yonetim/ilanlar/Duzenleyici.tsx`, `src/yonetim/ilanlar/Liste.tsx`, `src/yonetim/ilanlar/api.ts`, `src/yonetim/ilanlar/Fotograflar.tsx`

**Interfaces:**
- Consumes: Görev 3'teki callable'lar; `basvurudanIlan`, `baslikOner` (Görev 8); `preparePhoto`, `MAX_PHOTOS` (`src/lib/apply.ts`); `CATEGORY_LABEL`, `STATUS_LABEL` (`src/types.ts`).
- Produces:
  - `api.ts`: `ilanlariGetir()`, `ilanKaydet(req)`, `ilanIslem(ilanNo, islem)` (`httpsCallable` sarmalayıcıları).
  - `hataMetni(e: unknown): string`: `HttpsError` mesajını aynen gösterir; ağ hatasında `'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.'`

Ayrıntılar:
- **Düzenleyici:**
  - Kategori seçimi, tipe göre alanlar, özellik çipleri, açıklama.
  - Fotoğraflar: seç, ok düğmeleriyle sırala, kaldır; ilki kapak. Başvurudan açıldığında başvurunun fotoğrafları `{ basvuru: yol }` olarak seçili gelir; düzenlemede mevcutlar `{ mevcut: dosya }` olur.
  - Yeni fotoğraf `preparePhoto` → `uploadBytes(ref(storage, 'yonetim/<uid>/<24 karakter>.<ext>'))`.
  - Kaydet: "Yayına alınıyor…" → başarıda "Sitede yayında, 1–2 dk içinde görünür" + bağlantı. Hatada form durur, `hataMetni` ve "Tekrar dene" görünür.
- **İlanlar:**
  - Kartlar: kapak (`/img/<dosya>`), başlık, fiyat, durum etiketi.
  - Menü: Düzenle · Satıldı/Kiralandı · Gizle/Yayına al · Fırsat ekle/kaldır · Sil (`confirm` ile ikinci onay).

- [ ] **Step 1:** Emülatörde fonksiyonlar `GITHUB_BRANCH=yonetim-test` ve sahte bir GitHub sunucusuyla çalışır. Sahte sunucu, Görev 2 testindeki uç noktaları uygulayan küçük bir Node HTTP sunucusudur; `GITHUB_API` parametresiyle verilir ve varsayılanı `https://api.github.com`'dur. Playwright senaryosu:
  - Başvurudan ilana dönüştür → kaydet → başarı mesajında `AK-10008`; sahte depoda `data.json` yeni ilanı ve `public/img/ak-10008-1-*.webp` içerir; başvuru `onaylandi` olur.
  - Doğrudan yeni ilan (fotoğrafsız) eklenir.
  - Satıldı işaretlenir, sonra silinir.
  - Sahte sunucu 401 dönerken kaydet → form korunur ve "GitHub anahtarının süresi dolmuş veya yetkisi yok" görünür.
- [ ] **Step 2:** Yaz. Senaryo geçmeli, typecheck temiz olmalı.
- [ ] **Step 3:** Commit `Yönetim: ilan düzenleyici ve ilan yönetimi`.

### Görev 10: Ayarlar ve bildirim izni

**Files:**
- Create: `src/yonetim/Ayarlar.tsx`, `src/yonetim/bildirim.ts`

**Interfaces:**
- Produces: `bildirimDurumu(): Promise<'desteklenmiyor' | 'kapali' | 'acik'>`, `bildirimAc(): Promise<void>`, `bildirimKapat(): Promise<void>`.
  - Açma akışı: `navigator.serviceWorker.register('/yonetim/sw.js', {scope:'/yonetim/'})` → `getToken(messaging, { serviceWorkerRegistration })` (varsayılan VAPID) → `yetkililer/<email>/cihazlar/<sha256(token) ilk 20 hex>` yazılır.
  - Kapatma: `deleteToken` + belge silinir.

- [ ] **Step 1:** Ekran:
  - Bildirim anahtarı.
  - iPhone'da tarayıcı sekmesinde (standalone değilse) "Önce ana ekrana ekleyin" anlatımı.
  - Hesap e-postası, Çıkış düğmesi.
- [ ] **Step 2:** Playwright (Chromium, izin verilmiş): `bildirimAc` sonrası Firestore emülatöründe cihaz belgesi oluşur; `bildirimKapat` sonrası silinir. FCM token'ı emülatörde gerçek alınamazsa `getToken` sarmalayıcısı test için `window.__testToken`'ı kullanır; bu yalnızca `VITE_FIREBASE_EMULATOR` derlemesinde etkin olur.
- [ ] **Step 3:** Commit `Yönetim: ayarlar ve bildirim izni`.

### Görev 11: Uçtan uca doğrulama

**Files:**
- Create: `scripts/e2e-yonetim.mjs` (emülatör + sahte GitHub + Playwright; Görev 7–10 senaryolarını sırayla çalıştırır)
- Modify: `README.md` (Yönetim uygulaması bölümü: giriş, yetkili ekleme `yetkililer/<email>`, ana ekrana ekleme, bildirim, GitHub anahtarı yenileme)

- [ ] **Step 1:** `node scripts/e2e-yonetim.mjs` tüm senaryoları geçer:
  - Yetkisiz hesap ve e-postası doğrulanmamış hesap → "yetkiniz yok" ekranı.
  - Anonim ziyaretçi formu hâlâ başvuru gönderebilir.
- [ ] **Step 2:** `npm run build`, `npm run test:rules`, `cd functions && npm test && npm run build` → hepsi temiz.
- [ ] **Step 3:** 390 px ekran görüntüleri: giriş, başvurular, detay, düzenleyici, ilanlar, ayarlar.
- [ ] **Step 4:** Commit `Yönetim: uçtan uca test ve belgeler`.

### Görev 12: Bulut kurulumu ve canlıya alma

**Files:**
- Modify: `firebase.json` (gerekirse), `.firebaserc`

- [ ] **Step 1: Kullanıcı rehberi.** Ekran ekran yazılır; kullanıcı yapar ve "tamam" der.
  1. Firebase konsolu → Authentication → Sign-in method → Google → Etkinleştir (destek e-postası hasankurulurofficial).
  2. Google Cloud → APIs & Services → Credentials → "Web client (auto created by Google Service)" → Authorized redirect URIs'e `https://ak-emlak.vercel.app/__/auth/handler` eklenir.
  3. GitHub → Settings → Developer settings → Fine-grained token:
     - Repository: yalnızca `hsnkrlr/AkEmlak`.
     - Contents: Read and write.
     - Süre: 1 yıl.
     - Token, Secret Manager'a `GITHUB_TOKEN` olarak eklenir (europe-west3, kullanıcı yönetimli çoğaltma).
- [ ] **Step 2:** `gcloud`/`firebase` ile:
  - `yetkililer` belgeleri (iki e-posta).
  - Bucket CORS: `origin: https://ak-emlak.vercel.app`, `method: GET`, `maxAgeSeconds: 3600`.
  - FCM Registration API etkinleştirilir.
  - API anahtarı kısıtlamasına `fcmregistrations.googleapis.com` ve `cloudfunctions.googleapis.com` eklenir.
  - Authorized domains'de `ak-emlak.vercel.app` olduğu doğrulanır.
  - Cloud Functions için App Check zorunlu olduğu doğrulanır.
  - Storage hizmet aracısına Firestore okuma izni verilir (`firestore.exists` için; deploy sorarsa onaylanır).
- [ ] **Step 3:** `GITHUB_BRANCH=yonetim-test` ile yayınlanır:
  - `firebase deploy --only firestore,storage,functions`.
  - `yonetim-test` dalı `origin/ccr-02329762-r3ekpj`'den oluşturulur.
  - Kullanıcı canlı `/yonetim`'de giriş yapar, bir deneme ilanı kaydeder.
  - `yonetim-test` dalında commit görülür ve yayın dalının değişmediği doğrulanır.
- [ ] **Step 4:** `GITHUB_BRANCH` yayın dalına çevrilip fonksiyonlar yeniden yayınlanır.
  - Kullanıcı deneme ilanını ekler: sitede 1–2 dk içinde görünmeli.
  - İlan silinir: siteden kalkmalı.
  - Telefona bildirim gitmeli: kullanıcı formdan bir test başvurusu gönderir.
  - `yonetim-test` dalı silinir; test başvurusu ve test işlem kayıtları temizlenir.
- [ ] **Step 5:** Commit ve push. Kullanıcıya kısa kullanım özeti verilir.
