import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depoOlustur, GithubHatasi } from '../src/github.ts';
import { yaziyaDok, type DataJson } from '../src/ilanlar.ts';

type Istek = { method: string; path: string; body?: Record<string, unknown> };

/** Git Data API'nin yazımda kullanılan uçlarını taklit eden sahte GitHub */
function sahteGithub(o: { refCevaplari?: number[]; ilkCevap?: number; araYazim?: DataJson; blobCevap?: number } = {}) {
  const istekler: Istek[] = [];
  let ref = 'c0';
  const dosyalar: Record<string, string> = { c0: yaziyaDok({ ilanlar: [{ ilanNo: 'AK-10006', baslik: 'Eski' }] }) };
  const refCevaplari = [...(o.refCevaplari ?? [])];
  let sayac = 0;
  const fetchFn = (async (url: string | URL, init: RequestInit = {}) => {
    const u = new URL(String(url));
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    istekler.push({ method, path: u.pathname + u.search, body });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (o.ilkCevap && istekler.length === 1) return json(o.ilkCevap, { message: 'Bad credentials' });
    const p = u.pathname.replace('/repos/hsnkrlr/AkEmlak', '');
    if (method === 'GET' && p === '/git/ref/heads/yonetim-test') return json(200, { object: { sha: ref } });
    if (method === 'GET' && p.startsWith('/git/commits/')) return json(200, { sha: p.split('/').pop(), tree: { sha: `t-${p.split('/').pop()}` } });
    if (method === 'GET' && p.startsWith('/git/trees/')) return json(200, { truncated: false, tree: [{ path: 'public/data.json', type: 'blob' }, { path: 'public/img/var.webp', type: 'blob' }, { path: 'public/img/eski.webp', type: 'blob' }] });
    if (method === 'GET' && p === '/contents/public/data.json') return new Response(dosyalar[u.searchParams.get('ref')!], { status: 200 });
    if (method === 'POST' && p === '/git/blobs') return o.blobCevap ? json(o.blobCevap, { message: 'Resource not accessible by personal access token' }) : json(201, { sha: `b${++sayac}` });
    if (method === 'POST' && p === '/git/trees') return json(201, { sha: `t${++sayac}` });
    if (method === 'POST' && p === '/git/commits') return json(201, { sha: `c${++sayac}` });
    if (method === 'PATCH' && p === '/git/refs/heads/yonetim-test') {
      const kod = refCevaplari.shift() ?? 200;
      if (kod === 422) {
        // Bu arada başka biri yazmış gibi: dal ilerler ve data.json değişir
        ref = `dis${++sayac}`;
        dosyalar[ref] = yaziyaDok(o.araYazim ?? { ilanlar: [{ ilanNo: 'AK-10006', baslik: 'Eski' }, { ilanNo: 'AK-10007', baslik: 'Araya giren' }] });
        return json(422, { message: 'Update is not a fast forward' });
      }
      ref = String(body.sha);
      return json(200, { object: { sha: ref } });
    }
    return json(404, { message: 'Not Found' });
  }) as typeof fetch;
  return { fetchFn, istekler };
}

const depo = (f: typeof fetch) => depoOlustur({ token: 'gizli', repo: 'hsnkrlr/AkEmlak', branch: 'yonetim-test', fetch: f, yaziyaDok });

test('oku dalın son commit ini ve data.json içeriğini döner', async () => {
  const g = sahteGithub();
  const r = await depo(g.fetchFn).oku();
  assert.equal(r.commit, 'c0');
  assert.equal(r.veri.ilanlar[0].ilanNo, 'AK-10006');
});

test('yaz fotoğrafları ve data.json u tek commit ile, force olmadan yazar', async () => {
  const g = sahteGithub();
  const sonuc = await depo(g.fetchFn).yaz(
    async (veri) => ({
      veri: { ...veri, ilanlar: [{ ilanNo: 'AK-10008', baslik: 'Yeni' }, ...veri.ilanlar] },
      ekle: [{ yol: 'public/img/ak-10008-1-x7k2.webp', icerik: Buffer.from('RIFF') }],
      sil: ['public/img/eski.webp'],
    }),
    'Yönetim: AK-10008 eklendi (a@b.co)',
  );
  const tree = g.istekler.find((i) => i.path.endsWith('/git/trees'))!.body!;
  assert.equal(tree.base_tree, 't-c0');
  const girdiler = tree.tree as { path: string; sha: string | null; mode: string }[];
  assert.deepEqual(girdiler.map((x) => x.path).sort(), ['public/data.json', 'public/img/ak-10008-1-x7k2.webp', 'public/img/eski.webp']);
  assert.equal(girdiler.find((x) => x.path === 'public/img/eski.webp')!.sha, null);
  const commit = g.istekler.find((i) => i.path.endsWith('/git/commits') && i.method === 'POST')!.body!;
  assert.equal(commit.message, 'Yönetim: AK-10008 eklendi (a@b.co)');
  assert.deepEqual(commit.parents, ['c0']);
  const son = g.istekler.at(-1)!;
  assert.equal(son.method, 'PATCH');
  assert.equal(son.path, '/repos/hsnkrlr/AkEmlak/git/refs/heads/yonetim-test');
  assert.deepEqual(son.body, { sha: sonuc.commit, force: false });
  assert.equal(sonuc.veri.ilanlar[0].ilanNo, 'AK-10008');
});

test('dal araya giren bir değişiklikle ilerlediyse değişiklik güncel veriye yeniden uygulanır', async () => {
  const g = sahteGithub({ refCevaplari: [422] });
  const gorulen: string[][] = [];
  const sonuc = await depo(g.fetchFn).yaz(async (veri) => {
    gorulen.push(veri.ilanlar.map((i) => String(i.ilanNo)));
    return { veri: { ...veri, ilanlar: [{ ilanNo: 'AK-10008', baslik: 'Yeni' }, ...veri.ilanlar] }, ekle: [], sil: [] };
  }, 'm');
  assert.deepEqual(gorulen, [['AK-10006'], ['AK-10006', 'AK-10007']]);
  assert.deepEqual(sonuc.veri.ilanlar.map((i) => i.ilanNo), ['AK-10008', 'AK-10006', 'AK-10007']);
});

test('üç denemede de çakışma olursa cakisma hatası verir', async () => {
  const g = sahteGithub({ refCevaplari: [422, 422, 422] });
  await assert.rejects(
    depo(g.fetchFn).yaz(async (veri) => ({ veri, ekle: [], sil: [] }), 'm'),
    (e: unknown) => e instanceof GithubHatasi && e.kod === 'cakisma',
  );
});

test('geçersiz ya da süresi dolmuş anahtar (401) açıkça söylenir', async () => {
  const g = sahteGithub({ ilkCevap: 401 });
  await assert.rejects(depo(g.fetchFn).oku(), (e: unknown) => e instanceof GithubHatasi && e.kod === 'anahtar' && /geçersiz ya da süresi dolmuş/.test(e.message) && e.durum === 401);
});

test('okuyabilen ama yazamayan anahtar (403 yazmada) yazma izni eksik diye söylenir', async () => {
  const g = sahteGithub({ blobCevap: 403 });
  await assert.rejects(
    depo(g.fetchFn).yaz(async (veri) => ({ veri, ekle: [], sil: [] }), 'm'),
    (e: unknown) => e instanceof GithubHatasi && e.kod === 'anahtar' && /yazma izni yok/.test(e.message) && /Read and write/.test(e.message) && e.durum === 403 && /Resource not accessible/.test(e.github),
  );
});

test('depoya erişemeyen anahtar (404 okumada) depo seçimi diye söylenir', async () => {
  const g = sahteGithub({ ilkCevap: 404 });
  await assert.rejects(depo(g.fetchFn).oku(), (e: unknown) => e instanceof GithubHatasi && e.kod === 'anahtar' && /erişemiyor/.test(e.message));
});

test('commit mesajı, hazırlık sonrası belirlenen ilan numarasıyla yazılabilir', async () => {
  const g = sahteGithub();
  let no = '';
  await depo(g.fetchFn).yaz(async (veri) => {
    no = 'AK-10008';
    return { veri, ekle: [], sil: [] };
  }, () => `Yönetim: ${no} eklendi (a@b.co)`);
  const commit = g.istekler.find((i) => i.path.endsWith('/git/commits') && i.method === 'POST')!.body!;
  assert.equal(commit.message, 'Yönetim: AK-10008 eklendi (a@b.co)');
});

test('depoda olmayan dosyanın silinmesi istenirse yok sayılır (GitHub 422 vermesin)', async () => {
  const g = sahteGithub();
  await depo(g.fetchFn).yaz(async (veri) => ({ veri, ekle: [], sil: ['public/img/var.webp', 'public/img/hic-yuklenmemis.jpg'] }), 'm');
  const tree = g.istekler.find((i) => i.path.endsWith('/git/trees') && i.method === 'POST')!.body!;
  const yollar = (tree.tree as { path: string }[]).map((x) => x.path);
  assert.ok(yollar.includes('public/img/var.webp'));
  assert.equal(yollar.includes('public/img/hic-yuklenmemis.jpg'), false);
});
