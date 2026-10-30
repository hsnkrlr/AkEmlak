import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlUret } from '../src/sql.ts';

test('sqlUret tabloyu oluşturur ve her ilan için INSERT yazar', () => {
  const s = sqlUret([
    { ilanNo: 'AK-1', baslik: "Esenyurt'ta Ev", fiyat: 8000, tur: 'kiralik', ozellikler: ['Bahçe'], firsat: true, tarih: '2026-10-30' },
    { baslik: 'Numarasız', aciklama: 'satır1\nsatır2 \\ ters' },
  ]);
  assert.match(s, /CREATE TABLE ilanlar \(/);
  assert.match(s, /DROP TABLE IF EXISTS ilanlar;/);
  assert.match(s, /'Esenyurt''ta Ev'/);
  assert.match(s, /'AK-1'.*8000/s);
  assert.match(s, /'\["Bahçe"\]'/);
  assert.match(s, /, 1, '2026-10-30'/);
  assert.match(s, /'satır1\\nsatır2 \\\\ ters'/);
  assert.equal((s.match(/^INSERT INTO ilanlar/gm) ?? []).length, 2);
  assert.match(s, /NULL/);
});
