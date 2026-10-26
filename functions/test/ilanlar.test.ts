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
