import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dogrula, ekle, fotografAdi, guncelle, ilanBul, islemUygula, kullanilmayanFotograflar, sonrakiIlanNo, yaziyaDok,
  type DataJson,
} from '../src/ilanlar.ts';

const ornek = (): DataJson => ({
  ilanlar: [
    { ilanNo: 'AK-10007', baslik: 'Toki', mahalle: 'Bahçelievler', fotograflar: ['ortak.webp', 'b-1.webp'], tarih: '2026-10-20', ozelAlan: 1 },
    { ilanNo: 'AK-10006', baslik: 'Müstakil', fotograflar: ['a-1.webp', 'ortak.webp'], durum: 'yayinda' },
  ],
  notlar: 'elle eklenmiş üst alan',
});

test('sonrakiIlanNo en büyük AK numarasının bir fazlasını verir, diğer biçimleri yok sayar', () => {
  assert.equal(sonrakiIlanNo([{ ilanNo: 'AK-10006', baslik: 'a' }, { ilanNo: 'AK-10007', baslik: 'b' }, { baslik: 'x' }, { ilanNo: 'ÖZEL-1', baslik: 'y' }]), 'AK-10008');
  assert.equal(sonrakiIlanNo([]), 'AK-10001');
});

test('dogrula başlıksız ilanı reddeder', () => {
  assert.deepEqual(dogrula({}), { ok: false, hata: 'Başlık zorunlu.' });
  assert.deepEqual(dogrula('metin'), { ok: false, hata: 'Başlık zorunlu.' });
});

test('dogrula metni kırpar, sayıyı çevirir, bilinmeyen kategoriyi diger yapar', () => {
  const r = dogrula({ baslik: ' Ev ', fiyat: '8.000', kategori: 'uzay', tur: 'kiralik', ozellikler: [' Bahçe ', '', 5] });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ilan.baslik, 'Ev');
  assert.equal(r.ilan.fiyat, 8000);
  assert.equal(r.ilan.kategori, 'diger');
  assert.equal(r.ilan.tur, 'kiralik');
  assert.deepEqual(r.ilan.ozellikler, ['Bahçe', '5']);
});

test('dogrula ilanNo, tarih ve fotograflar alanlarını girdiden almaz; geçersiz değerleri atar', () => {
  const r = dogrula({ baslik: 'a', ilanNo: 'AK-1', tarih: '2020-01-01', fotograflar: ['../x'], tur: 'takas', durum: 'silindi', baglanti: '../evil', fiyat: -5 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  for (const k of ['ilanNo', 'tarih', 'fotograflar', 'tur', 'durum', 'baglanti', 'fiyat']) assert.equal(k in r.ilan, false, k);
});

test('ekle ilanı başa ekler, girdiyi değiştirmez', () => {
  const v = ornek();
  const yeni = ekle(v, { baslik: 'Yeni' }, 'AK-10008', '2026-10-26', ['ak-10008-1-x7k2.webp']);
  assert.equal(yeni.ilanlar.length, 3);
  assert.deepEqual(yeni.ilanlar[0], { ilanNo: 'AK-10008', baslik: 'Yeni', fotograflar: ['ak-10008-1-x7k2.webp'], durum: 'yayinda', tarih: '2026-10-26' });
  assert.equal(yeni.notlar, 'elle eklenmiş üst alan');
  assert.equal(v.ilanlar.length, 2);
});

test('guncelle elle eklenmiş alanları, tarihi ve ilanNo yu korur; boşaltılan alanı kaldırır', () => {
  const yeni = guncelle(ornek(), 'AK-10007', { baslik: 'Toki zemin kat', fiyat: 9000 }, ['b-1.webp']);
  const i = ilanBul(yeni, 'AK-10007')!;
  assert.equal(i.baslik, 'Toki zemin kat');
  assert.equal(i.fiyat, 9000);
  assert.equal(i.ozelAlan, 1);
  assert.equal(i.tarih, '2026-10-20');
  assert.equal(i.ilanNo, 'AK-10007');
  assert.equal('mahalle' in i, false);
  assert.deepEqual(i.fotograflar, ['b-1.webp']);
});

test('islemUygula durum, fırsat ve silme işlemlerini yapar', () => {
  assert.equal(ilanBul(islemUygula(ornek(), 'AK-10006', 'satildi'), 'AK-10006')!.durum, 'satildi');
  assert.equal(ilanBul(islemUygula(ornek(), 'AK-10006', 'gizli'), 'AK-10006')!.durum, 'gizli');
  assert.equal(ilanBul(islemUygula(ornek(), 'AK-10006', 'firsat'), 'AK-10006')!.firsat, true);
  assert.equal(ilanBul(islemUygula(islemUygula(ornek(), 'AK-10006', 'firsat'), 'AK-10006', 'firsatKaldir'), 'AK-10006')!.firsat, false);
  const silindi = islemUygula(ornek(), 'AK-10007', 'sil');
  assert.deepEqual(silindi.ilanlar.map((i) => i.ilanNo), ['AK-10006']);
});

test('bilinmeyen ilan numarası hata verir', () => {
  assert.throws(() => guncelle(ornek(), 'AK-99999', { baslik: 'x' }, []), /İlan bulunamadı: AK-99999/);
  assert.throws(() => islemUygula(ornek(), 'AK-99999', 'sil'), /İlan bulunamadı/);
});

test('kullanilmayanFotograflar başka ilanda kullanılan dosyayı silmez', () => {
  const v = ornek();
  assert.deepEqual(kullanilmayanFotograflar(v, islemUygula(v, 'AK-10006', 'sil')), ['a-1.webp']);
});

test('fotografAdi ve yaziyaDok biçimleri', () => {
  assert.equal(fotografAdi('AK-10008', 1, 'x7k2'), 'ak-10008-1-x7k2.webp');
  const s = yaziyaDok({ ilanlar: [{ baslik: 'a' }] });
  assert.equal(s, '{\n  "ilanlar": [\n    {\n      "baslik": "a"\n    }\n  ]\n}\n');
});

/* ---- Son inceleme düzeltmeleri ---- */
import { basvuruFotografiMi, ilanSurumu, slugify } from '../src/ilanlar.ts';

test('dogrula sitenin kabul ettiği yazımları normalleştirir (taslak, kiralık, usd, bilinmeyen kategori)', () => {
  const r = dogrula({ baslik: 'a', tur: 'kiralık', durum: 'taslak', paraBirimi: 'usd', kategori: 'Tekne' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.ilan.tur, 'kiralik');
  assert.equal(r.ilan.durum, 'gizli');
  assert.equal(r.ilan.paraBirimi, 'USD');
  assert.equal(r.ilan.kategori, 'diger');
  assert.equal(r.ilan.kategoriAdi, 'Tekne');
  for (const [girdi, beklenen] of [['kiralandı', 'satildi'], ['satıldı', 'satildi'], ['yayında', 'yayinda'], ['gizli', 'gizli']]) {
    const x = dogrula({ baslik: 'a', durum: girdi });
    assert.equal(x.ok && x.ilan.durum, beklenen, girdi);
  }
});

test('dogrula sitenin sınırlarını kullanır: 40 özellik, 6000 karakter açıklama', () => {
  const r = dogrula({ baslik: 'a', ozellikler: Array.from({ length: 45 }, (_, i) => `ö${i}`), aciklama: 'x'.repeat(6100) });
  assert.equal(r.ok && (r.ilan.ozellikler as string[]).length, 40);
  assert.equal(r.ok && (r.ilan.aciklama as string).length, 6000);
});

test('ilanSurumu ilan değişince değişir, aynı ilan için aynıdır', () => {
  const a = { ilanNo: 'AK-1', baslik: 'Ev', fiyat: 5 };
  assert.equal(ilanSurumu(a), ilanSurumu(JSON.parse(JSON.stringify(a))));
  assert.notEqual(ilanSurumu(a), ilanSurumu({ ...a, fiyat: 6 }));
});

test('ekle yeni ilana mevcut bir ilanın adresini vermez', () => {
  const v: DataJson = { ilanlar: [{ ilanNo: 'AK-1', baslik: 'Merkezde Satılık Arsa' }, { ilanNo: 'AK-2', baslik: 'x', baglanti: 'merkezde-satilik-arsa-2' }] };
  const y = ekle(v, { baslik: 'Merkezde Satılık Arsa' }, 'AK-3', '2026-10-27', []);
  assert.equal(y.ilanlar[0].baglanti, 'merkezde-satilik-arsa-3');
  const z = ekle(v, { baslik: 'Başka Bir Ev' }, 'AK-3', '2026-10-27', []);
  assert.equal('baglanti' in z.ilanlar[0], false);
  assert.equal(slugify("Nurdağı Esenyurt'ta Ev"), 'nurdagi-esenyurtta-ev');
});

test('basvuruFotografiMi yalnızca başvuru sahibinin klasöründeki fotoğrafı kabul eder', () => {
  assert.equal(basvuruFotografiMi('basvurular/uid1234567890/abcdefghijklmnop0001.jpg', 'uid1234567890'), true);
  assert.equal(basvuruFotografiMi('basvurular/baskasi12345/abcdefghijklmnop0001.jpg', 'uid1234567890'), false);
  assert.equal(basvuruFotografiMi('yonetim/uid1234567890/abcdefghijklmnop0001.jpg', 'uid1234567890'), false);
  assert.equal(basvuruFotografiMi('basvurular/uid1234567890/../x.jpg', 'uid1234567890'), false);
});
