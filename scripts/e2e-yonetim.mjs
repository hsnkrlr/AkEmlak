// Yönetim uygulaması uçtan uca testi (Firebase emülatörleri + sahte GitHub + Playwright, 390 px telefon ekranı).
//
// Hazırlık (ayrı terminallerde):
//   printf 'GITHUB_API=http://127.0.0.1:4555\nGITHUB_BRANCH=yonetim-test\n' > functions/.env.local
//   printf 'GMAIL_APP_PASSWORD=x\nGITHUB_TOKEN=x\n' > functions/.secret.local
//   (cd functions && npm run build) && npm run emulators
//   VITE_FIREBASE_EMULATOR=1 npm run build
// Çalıştırma:
//   node scripts/e2e-yonetim.mjs [ekran-goruntusu-klasoru]
//
// Betik dist/ klasörünü 4174 portunda, sahte GitHub'ı 4555 portunda kendisi açar.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const ROOT = resolve(import.meta.dirname, '..');
// playwright ortamda genel kurulu olabilir (NODE_PATH); sharp fonksiyonların bağımlılığıdır
const { chromium } = createRequire(import.meta.url)('playwright');
const sharp = createRequire(join(ROOT, 'functions/package.json'))('sharp');
const DIST = join(ROOT, 'dist');
const SHOTS = resolve(process.argv[2] ?? join(ROOT, 'dist-e2e-shots'));
mkdirSync(SHOTS, { recursive: true });
const SITE = 'http://localhost:4174';
const ADMIN = `${SITE}/yonetim/index.html`;
const GH = 'http://127.0.0.1:4555';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-akemlak/databases/(default)/documents';
const YETKILI = 'hasankurulurofficial@gmail.com';

/* ---------- statik site (Vercel benzeri) ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const site = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, SITE).pathname);
  const aday = [join(DIST, p), join(DIST, p, 'index.html')];
  let f = aday.find((x) => {
    try {
      return statSync(x).isFile();
    } catch {
      return false;
    }
  });
  if (!f && p.startsWith('/img/')) return res.writeHead(404).end();
  f ??= join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
}).listen(4174);

/* ---------- sahte GitHub (Git Data API) ---------- */
const sha = (x) => createHash('sha1').update(String(x)).update(String(Math.random())).digest('hex');
const blobs = new Map(), trees = new Map(), commits = new Map();
const d0 = sha('d');
blobs.set(d0, readFileSync(join(ROOT, 'public/data.json')));
const t0 = sha('t');
trees.set(t0, new Map([['public/data.json', d0]]));
let ref = sha('c');
commits.set(ref, { tree: t0, parents: [] });
let authFail = false;
const mesajlar = [];
const gh = createServer(async (req, res) => {
  const u = new URL(req.url, GH);
  let body = '';
  for await (const c of req) body += c;
  const b = body ? JSON.parse(body) : {};
  const json = (st, d) => res.writeHead(st, { 'content-type': 'application/json' }).end(JSON.stringify(d));
  if (authFail || !/^Bearer .+/.test(req.headers.authorization ?? '')) return json(401, { message: 'Bad credentials' });
  const p = u.pathname.replace('/repos/hsnkrlr/AkEmlak', '');
  if (req.method === 'GET' && p.startsWith('/git/ref/heads/')) return json(200, { object: { sha: ref } });
  if (req.method === 'GET' && p.startsWith('/git/commits/')) return json(200, { tree: { sha: commits.get(p.split('/').pop()).tree } });
  if (req.method === 'GET' && p === '/contents/public/data.json') return res.writeHead(200).end(blobs.get(trees.get(commits.get(u.searchParams.get('ref')).tree).get('public/data.json')));
  if (req.method === 'POST' && p === '/git/blobs') {
    const s = sha(b.content);
    blobs.set(s, Buffer.from(b.content, 'base64'));
    return json(201, { sha: s });
  }
  if (req.method === 'POST' && p === '/git/trees') {
    const m = new Map(trees.get(b.base_tree));
    for (const e of b.tree) e.sha === null ? m.delete(e.path) : m.set(e.path, e.sha);
    const s = sha('t');
    trees.set(s, m);
    return json(201, { sha: s });
  }
  if (req.method === 'POST' && p === '/git/commits') {
    const s = sha('c');
    commits.set(s, { tree: b.tree, parents: b.parents, message: b.message });
    return json(201, { sha: s });
  }
  if (req.method === 'PATCH' && p.startsWith('/git/refs/heads/')) {
    if (commits.get(b.sha).parents[0] !== ref) return json(422, { message: 'Update is not a fast forward' });
    ref = b.sha;
    mesajlar.push(commits.get(ref).message);
    return json(200, { object: { sha: ref } });
  }
  json(404, { message: 'Not Found' });
}).listen(4555, '127.0.0.1');
const depo = () => {
  const files = trees.get(commits.get(ref).tree);
  return { dosyalar: [...files.keys()], data: JSON.parse(blobs.get(files.get('public/data.json')).toString()) };
};

/* ---------- emülatör verisi ---------- */
const enc = (v) =>
  typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? { integerValue: v } : typeof v === 'boolean' ? { booleanValue: v } : v === null ? { nullValue: null }
  : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const H = { Authorization: 'Bearer owner', 'content-type': 'application/json' };
const setDoc = async (path, data) => assert.ok((await fetch(`${FS}/${path}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: enc(data).mapValue.fields }) })).ok, path);
const getDoc = async (path) => (await fetch(`${FS}/${path}`, { headers: H })).json();
const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#4a7a8c' } }).jpeg().toBuffer();

await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-akemlak/databases/(default)/documents', { method: 'DELETE' });
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-akemlak/accounts', { method: 'DELETE' });
await setDoc(`yetkililer/${YETKILI}`, { ad: 'Hasan' });
await setDoc('yetkililer/akdemirh540@gmail.com', { ad: 'Akdemir' });
const UID = 'ziyaretciuid1234567890';
const FOTO = `basvurular/${UID}/abcdefghijklmnop0001.jpg`;
await fetch(`http://127.0.0.1:9199/v0/b/demo-akemlak.appspot.com/o?name=${encodeURIComponent(FOTO)}`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'content-type': 'image/jpeg' }, body: jpeg });
await setDoc('basvurular/e2ebasvuru1', {
  number: 'B-7K2Q9X', uid: UID, createdAt: new Date(Date.now() - 20 * 60000), status: 'yeni', seller: { name: 'Mehmet Köse', phone: '+905321234567' },
  listing: { type: 'mustakil', deal: 'kiralik', city: 'Gaziantep', district: 'Nurdağı', neighborhood: 'Esenyurt', address: 'Cami karşısı', price: 8000, rooms: '3+1' },
  photos: [FOTO], resubmission: { isResubmission: false, of: null, original: null, revision: 0 }, consent: { kvkk: true, version: '2026-10' },
});

/* ---------- senaryolar ---------- */
const browser = await chromium.launch();
const hatalar = [];
async function sayfa(email, dogrulanmis = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__testToken = 'fcm-test-token';
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => hatalar.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(ADMIN);
  await page.waitForSelector('text=Google ile giriş yap');
  await page.screenshot({ path: join(SHOTS, '1-giris.png') });
  if (email) {
    await page.evaluate(([e, v]) => window.__testGiris(e, v), [email, dogrulanmis]);
    await page.waitForSelector('.y-kabuk, h1:has-text("yetkisi yok")', { timeout: 20000 });
  }
  return page;
}
const adim = (ad) => console.log(`✓ ${ad}`);

// Yetkisiz hesaplar hiçbir şey göremez
for (const [email, dog, ad] of [['kayitsiz@ornek.com', true, 'listede olmayan hesap'], ['akdemirh540@gmail.com', false, 'listede olan ama e-postası doğrulanmamış hesap']]) {
  const p = await sayfa(email, dog);
  assert.equal(await p.locator('h1').innerText(), 'Bu hesabın yetkisi yok');
  adim(`${ad} → "yetkiniz yok" ekranı`);
  await p.context().close();
}

const page = await sayfa(YETKILI);
await page.waitForSelector('.y-liste .y-satir');
await page.screenshot({ path: join(SHOTS, '2-basvurular.png') });
adim('yetkili → başvuru listesi');

await page.click('.y-satir:has-text("Müstakil")');
await page.waitForSelector('.y-galeri img');
await page.screenshot({ path: join(SHOTS, '3-basvuru-detay.png') });
await page.fill('.y-alan textarea', 'Yarın yerinde bakılacak');
await page.click('text=Notu kaydet');
await page.waitForSelector('.y-not p:has-text("Yarın yerinde bakılacak")');
assert.equal((await getDoc('basvurular/e2ebasvuru1')).fields.status.stringValue, 'inceleniyor');
adim('başvuru açıldı → inceleniyor, not eklendi');

await page.click('text=İlana dönüştür');
await page.waitForSelector('.y-fotolar img');
await page.screenshot({ path: join(SHOTS, '4-duzenleyici.png') });
await page.click('text=Siteye ekle');
await page.waitForSelector('h1:has-text("Kaydedildi")', { timeout: 60000 });
let d = depo();
const no = d.data.ilanlar[0].ilanNo;
assert.match(mesajlar.at(-1), new RegExp(`^Yönetim: ${no} eklendi \\(${YETKILI}\\)$`));
assert.equal(d.data.ilanlar[0].fotograflar.length, 1);
assert.ok(d.dosyalar.includes(`public/img/${d.data.ilanlar[0].fotograflar[0]}`));
assert.equal('address' in d.data.ilanlar[0], false);
assert.equal((await getDoc('basvurular/e2ebasvuru1')).fields.status.stringValue, 'onaylandi');
adim(`başvurudan ilan → ${no}, fotoğraf depoda, başvuru onaylandı`);

await page.goto(`${ADMIN}#/ilanlar`);
await page.waitForSelector(`.y-liste li:has-text("${no}")`);
await page.screenshot({ path: join(SHOTS, '5-ilanlar.png') });
await page.click(`.y-liste li:has-text("${no}") .y-satir`);
await page.click('text=Kiralandı işaretle');
await page.waitForSelector('.y-basari');
assert.equal(depo().data.ilanlar.find((i) => i.ilanNo === no).durum, 'satildi');
await page.waitForSelector(`.y-liste li:has-text("${no}") .y-etiket:has-text("Kiralandı")`);
await page.click(`.y-liste li:has-text("${no}") .y-satir`);
await page.click(`.y-liste li:has-text("${no}") button:has-text("Sil")`);
await page.waitForFunction(() => document.querySelector('.y-basari')?.textContent?.includes('silindi'), null, { timeout: 30000 });
d = depo();
assert.equal(d.data.ilanlar.some((i) => i.ilanNo === no), false);
assert.equal(d.dosyalar.some((f) => f.startsWith(`public/img/${no.toLowerCase()}`)), false);
adim('ilan kiralandı işaretlendi, sonra fotoğraflarıyla silindi');

authFail = true;
await page.goto(`${ADMIN}#/ilan/yeni`);
await page.fill('.y-alan:has-text("Başlık") input', 'Kaybolmaması gereken başlık');
await page.click('text=Siteye ekle');
await page.waitForSelector('.y-hata[role=alert]');
assert.match(await page.locator('.y-hata[role=alert]').innerText(), /^GitHub anahtarının süresi dolmuş veya yetkisi yok\./);
assert.equal(await page.locator('.y-alan:has-text("Başlık") input').inputValue(), 'Kaybolmaması gereken başlık');
authFail = false;
adim('GitHub anahtarı geçersiz → açık hata, form korundu');

await page.goto(`${ADMIN}#/ayarlar`);
await page.click('text=Bu cihazda bildirimleri aç');
await page.waitForSelector('text=Bu cihazda bildirimleri kapat');
await page.screenshot({ path: join(SHOTS, '6-ayarlar.png') });
assert.equal(((await getDoc(`yetkililer/${YETKILI}/cihazlar`)).documents ?? []).length, 1);
await page.click('text=Bu cihazda bildirimleri kapat');
await page.waitForSelector('text=Bu cihazda bildirimleri aç');
adim('bildirim aç/kapat → cihaz kaydı eklendi/silindi');

// Ziyaretçi formu hâlâ çalışıyor
const z = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
z.on('pageerror', (e) => hatalar.push(String(e)));
await z.goto(`${SITE}/ilan-basvurusu?tip=daire&ilce=Nurdağı`);
await z.click('.apply-gate >> text=Yalnızca zorunlu');
await z.fill('.af:has-text("Ad Soyad") input', 'Ali Veli');
await z.fill('.af-input.phone input', '0532 123 45 67');
await z.check('.apply-submit .check input');
await z.click('button[type=submit]');
await z.waitForSelector('.apply-done', { timeout: 30000 });
adim('anonim ziyaretçi başvuru formu hâlâ gönderiliyor');

await browser.close();
site.close();
gh.close();
assert.deepEqual(hatalar, []);
console.log(`\nTüm senaryolar geçti. Ekran görüntüleri: ${SHOTS}`);
