import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyukHarfUygula, type BuyukHarfDurumu } from './buyukHarf.ts';

/** Klavyeden tek tek yazmayı taklit eder */
function yaz(metin: string, mod: 'kelime' | 'cumle', durum: BuyukHarfDurumu = { iptal: new Set() }, baslangic = '') {
  let v = baslangic;
  for (const c of metin) v = buyukHarfUygula(v, v + c, mod, durum);
  return v;
}

test('başlıkta her kelimenin ilk harfi büyür (Türkçe i → İ)', () => {
  assert.equal(yaz('nurdağı esenyurt ilan', 'kelime'), 'Nurdağı Esenyurt İlan');
});

test('açıklamada yalnızca cümle başları büyür', () => {
  assert.equal(yaz('camiye yakın ev. yola cepheli! iyi\nyeni satır', 'cumle'), 'Camiye yakın ev. Yola cepheli! İyi\nYeni satır');
});

test('yapıştırılan metne dokunulmaz', () => {
  assert.equal(buyukHarfUygula('', 'küçük yapıştırma', 'kelime', { iptal: new Set() }), 'küçük yapıştırma');
});

test('otomatik büyütülen harf silinip küçük yazılırsa tekrar büyütülmez', () => {
  const d: BuyukHarfDurumu = { iptal: new Set() };
  let v = yaz('ev', 'kelime', d); // "Ev"
  v = buyukHarfUygula(v, 'v', 'kelime', d); // baştaki "E" silindi
  v = buyukHarfUygula(v, 'ev', 'kelime', d); // küçük "e" yazıldı
  assert.equal(v, 'ev');
});
