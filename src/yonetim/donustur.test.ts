import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baslikOner, basvurudanIlan } from './donustur.ts';

test('baslikOner konum, işlem türü ve tipten başlık önerir', () => {
  assert.equal(baslikOner({ type: 'mustakil', deal: 'kiralik', district: 'Nurdağı', neighborhood: 'Esenyurt' }), "Nurdağı Esenyurt'ta Kiralık Müstakil Ev");
  assert.equal(baslikOner({ type: 'daire', deal: 'satilik', district: 'Şehitkamil', neighborhood: 'Bahçelievler Mahallesi' }), "Şehitkamil Bahçelievler'de Satılık Daire");
  assert.equal(baslikOner({ type: 'arsa' }), 'Arsa');
  assert.equal(baslikOner({ type: 'arac', deal: 'satilik', brand: 'Renault', model: 'Clio' }), 'Satılık Renault Clio');
});

test('basvurudanIlan araç başvurusunu otomobil ilanına çevirir', () => {
  const i = basvurudanIlan({ listing: { type: 'arac', brand: 'Renault', km: 120000, modelYear: 2019, fuel: 'Dizel', gear: 'Manuel' } });
  assert.equal(i.kategori, 'otomobil');
  assert.equal(i.marka, 'Renault');
  assert.equal(i.km, 120000);
  assert.equal(i.modelYili, 2019);
  assert.equal(i.yakit, 'Dizel');
  assert.equal(i.vites, 'Manuel');
});

test('basvurudanIlan alanları eşler, açık adresi ilana koymaz, eşyalı/site bilgisini özelliğe çevirir', () => {
  const i = basvurudanIlan({
    listing: {
      type: 'daire', deal: 'kiralik', city: 'Gaziantep', district: 'Nurdağı', neighborhood: 'Esenyurt', address: 'Cami karşısı No 5',
      price: 8000, grossM2: 120, netM2: 100, rooms: '3+1', bathrooms: 1, floor: '2', buildingAge: 10, heating: 'Doğalgaz Kombi',
      furnished: true, inSite: false, features: ['Balkon'], description: 'Güzel ev',
    },
  });
  assert.deepEqual(i, {
    baslik: "Nurdağı Esenyurt'ta Kiralık Daire", kategori: 'daire', tur: 'kiralik', il: 'Gaziantep', ilce: 'Nurdağı', mahalle: 'Esenyurt',
    fiyat: 8000, brutM2: 120, netM2: 100, odaSayisi: '3+1', banyoSayisi: 1, kat: '2', binaYasi: 10, isitma: 'Doğalgaz Kombi',
    ozellikler: ['Balkon', 'Eşyalı'], aciklama: 'Güzel ev',
  });
  assert.equal('address' in i, false);
});

test('basvurudanIlan bilinmeyen tipi diger yapar, fiyatsız başvuruda fiyat 0 olur', () => {
  const i = basvurudanIlan({ listing: { type: 'tekne' } });
  assert.equal(i.kategori, 'diger');
  assert.equal(i.fiyat, 0);
});

test('basvurudanIlan arsa başvurusunun imar, tapu ve ada/parsel bilgisini aktarır', () => {
  const i = basvurudanIlan({ listing: { type: 'arsa', grossM2: 500, zoning: 'Konut', deed: 'Müstakil Tapu', parcel: '125 / 4' } });
  assert.equal(i.imarDurumu, 'Konut');
  assert.equal(i.tapuDurumu, 'Müstakil Tapu');
  assert.equal(i.adaParsel, '125 / 4');
});
