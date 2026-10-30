// Firebase güvenlik kuralı testleri — emülatör çalışırken: npm run test:rules
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const ts = () => firebase.firestore.FieldValue.serverTimestamp();
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-akemlak',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('firebase/storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
});

const UID = 'kullanici1234567890';
const valid = (uid = UID, over = {}) => ({
  number: 'B-7K2Q9X',
  uid,
  createdAt: ts(),
  status: 'yeni',
  seller: { name: 'Ali Veli', phone: '+905321234567' },
  listing: { type: 'mustakil', deal: 'kiralik', city: 'Gaziantep', district: 'Nurdağı', price: 8000, features: ['Bahçe'] },
  photos: [`basvurular/${uid}/abcdefghijklmnop1234.webp`],
  resubmission: { isResubmission: false, of: null, original: null, revision: 0 },
  consent: { kvkk: true, version: '2026-10' },
  ...over,
});

/** Uygulamanın yaptığı gibi: hız sınırı kaydı + başvuru tek yazımda */
function submit(ctx, data, { withLimit = true } = {}) {
  const db = ctx.firestore();
  const batch = db.batch();
  if (withLimit) batch.set(db.doc(`limits/${ctx.uid ?? 'x'}`), { lastAt: ts() });
  batch.set(db.collection('basvurular').doc(), data);
  return batch.commit();
}
const user = (uid = UID) => Object.assign(env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }), { uid });

describe('Firestore: başvuru oluşturma', () => {
  test('geçerli başvuru kabul edilir', async () => {
    await assertSucceeds(submit(user(), valid()));
  });
  test('tekrar gönderim (önceki numarayla) kabul edilir', async () => {
    await assertSucceeds(submit(user(), valid(UID, { resubmission: { isResubmission: true, of: 'B-7K2Q9X', original: 'B-7K2Q9X', revision: 1 } })));
  });
  // Tüm alanları dolu en büyük geçerli başvurular kural ifade sınırını (1000) aşmamalı
  const full = {
    deal: 'satilik', city: 'Gaziantep', district: 'Nurdağı', neighborhood: 'Bahçelievler Mahallesi', address: 'Camiye 100 m',
    price: 2500000, description: 'Açıklama '.repeat(300), features: Array.from({ length: 20 }, (_, i) => `Özellik ${i}`),
  };
  const maxCases = {
    daire: { ...full, type: 'daire', grossM2: 150, netM2: 130, rooms: '3+1', floor: '4', buildingAge: 5, bathrooms: 2, heating: 'Doğalgaz Kombi', furnished: false, inSite: true },
    arsa: { ...full, type: 'arsa', grossM2: 620, zoning: 'Konut', deed: 'Müstakil Tapu', parcel: '125 / 4' },
    arac: { ...full, type: 'arac', brand: 'Renault', model: 'Clio 1.0 TCe Joy', modelYear: 2019, km: 84500, fuel: 'Benzin', gear: 'Manuel' },
    'tüm alanlar birden': {
      ...full, type: 'villa', grossM2: 380, netM2: 320, rooms: '5+1', floor: 'Zemin', buildingAge: 2, bathrooms: 4, heating: 'Yerden Isıtma',
      furnished: true, inSite: true, zoning: 'Konut', deed: 'Müstakil Tapu', parcel: '1/2', brand: 'x', model: 'y', modelYear: 2020, km: 1, fuel: 'Dizel', gear: 'Otomatik',
    },
  };
  for (const [name, listing] of Object.entries(maxCases)) {
    test(`tüm alanları dolu başvuru kabul edilir: ${name}`, async () => {
      await assertSucceeds(
        submit(user(), valid(UID, {
          seller: { name: 'Ayşe Nur Yılmaz', phone: '+905321234567', email: 'ayse@example.com' },
          listing,
          photos: Array.from({ length: 10 }, (_, i) => `basvurular/${UID}/abcdefghijklmnop12${i}.webp`),
          resubmission: { isResubmission: true, of: 'B-7K2Q9X', original: 'B-AAAAAA', revision: 3 },
        })),
      );
    });
  }
  test('oturumsuz yazma reddedilir', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.collection('basvurular').add(valid()));
  });
  test('hız sınırı kaydı olmadan reddedilir', async () => {
    await assertFails(submit(user(), valid(), { withLimit: false }));
  });
  test('1 dakika içinde ikinci başvuru reddedilir', async () => {
    await assertSucceeds(submit(user(), valid()));
    await assertFails(submit(user(), valid()));
  });
  const bad = {
    'hatalı telefon (sabit hat)': { seller: { name: 'Ali Veli', phone: '+903421234567' } },
    'hatalı telefon (kısa)': { seller: { name: 'Ali Veli', phone: '+90532123' } },
    'eksik ad': { seller: { phone: '+905321234567' } },
    'satıcıda fazladan alan': { seller: { name: 'Ali Veli', phone: '+905321234567', admin: true } },
    'geçersiz e-posta': { seller: { name: 'Ali Veli', phone: '+905321234567', email: 'yok' } },
    'başkası adına (uid)': { uid: 'baskasi' },
    'durum "onaylandi"': { status: 'onaylandi' },
    'istemci saati': { createdAt: new Date() },
    'bilinmeyen ilan tipi': { listing: { type: 'uzaygemisi' } },
    'ilanda fazladan alan': { listing: { type: 'daire', html: '<script>' } },
    'çok uzun açıklama': { listing: { type: 'daire', description: 'x'.repeat(3001) } },
    'negatif fiyat': { listing: { type: 'daire', price: -5 } },
    '11 fotoğraf': { photos: Array.from({ length: 11 }, (_, i) => `basvurular/${UID}/abcdefghijklmnop12${i}.webp`) },
    'KVKK onayı yok': { consent: { kvkk: false, version: '2026-10' } },
    'tutarsız tekrar gönderim': { resubmission: { isResubmission: true, of: null, original: null, revision: 0 } },
    'hatalı başvuru no': { number: 'X-123' },
    'belgede fazladan alan': { notlar: 'ben yöneticiyim' },
  };
  for (const [name, over] of Object.entries(bad)) {
    test(`reddedilir: ${name}`, async () => {
      await assertFails(submit(user(), valid(UID, over)));
    });
  }
});

describe('Firestore: okuma / değiştirme / silme kapalı', () => {
  test('kendi başvurusunu bile okuyamaz, değiştiremez, silemez', async () => {
    let id;
    await env.withSecurityRulesDisabled(async (ctx) => {
      id = (await ctx.firestore().collection('basvurular').add({ ...valid(), createdAt: new Date() })).id;
    });
    const db = user().firestore();
    await assertFails(db.doc(`basvurular/${id}`).get());
    await assertFails(db.collection('basvurular').get());
    await assertFails(db.doc(`basvurular/${id}`).update({ status: 'onaylandi' }));
    await assertFails(db.doc(`basvurular/${id}`).delete());
  });
  test('ayarlar ve hız sınırı kayıtları okunamaz / yazılamaz', async () => {
    const db = user().firestore();
    await assertFails(db.doc('ayarlar/bildirim').get());
    await assertFails(db.doc('ayarlar/bildirim').set({ alicilar: ['saldirgan@example.com'] }));
    await assertFails(db.doc(`limits/${UID}`).get());
    await assertFails(db.doc(`limits/${UID}`).delete());
    await assertFails(db.doc('limits/baskasi').set({ lastAt: ts() }));
  });
});

describe('Storage: fotoğraf yükleme', () => {
  const webp = (n) => {
    const b = new Uint8Array(n);
    b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    return b;
  };
  const put = (ctx, path, bytes, contentType = 'image/webp') => ctx.storage().ref(path).put(bytes, { contentType });

  test('kendi klasörüne geçerli fotoğraf yüklenir', async () => {
    await assertSucceeds(put(user(), `basvurular/${UID}/abcdefghijklmnop1234.webp`, webp(2048)));
  });
  test('başkasının klasörüne yüklenemez', async () => {
    await assertFails(put(user(), `basvurular/baskasi/abcdefghijklmnop1234.webp`, webp(2048)));
  });
  test('oturumsuz yüklenemez', async () => {
    await assertFails(put(env.unauthenticatedContext(), `basvurular/${UID}/abcdefghijklmnop1234.webp`, webp(2048)));
  });
  test('3 MB üstü yüklenemez', async () => {
    await assertFails(put(user(), `basvurular/${UID}/abcdefghijklmnop9999.webp`, webp(3 * 1024 * 1024 + 1)));
  });
  test('resim olmayan içerik türü yüklenemez', async () => {
    await assertFails(put(user(), `basvurular/${UID}/abcdefghijklmnop1234.jpg`, webp(100), 'text/html'));
  });
  test('uygunsuz dosya adı yüklenemez', async () => {
    await assertFails(put(user(), `basvurular/${UID}/../../index.html`, webp(100)));
    await assertFails(put(user(), `basvurular/${UID}/kisa.webp`, webp(100)));
  });
  test('başka klasörlere yüklenemez', async () => {
    await assertFails(put(user(), `img/abcdefghijklmnop1234.webp`, webp(100)));
  });
  test('yüklenen fotoğraf okunamaz / silinemez', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(`basvurular/${UID}/abcdefghijklmnop5678.webp`).put(webp(100), { contentType: 'image/webp' });
    });
    const ref = user().storage().ref(`basvurular/${UID}/abcdefghijklmnop5678.webp`);
    await assertFails(ref.getDownloadURL());
    await assertFails(ref.delete());
  });
});

describe('yönetim', () => {
  const YETKILI = 'hasankurulurofficial@gmail.com';
  const DIGER_YETKILI = 'akdemirh540@gmail.com';
  const google = (uid, email, over = {}) =>
    Object.assign(env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...over }), { uid });
  const yetkili = () => google('yetkiliuid1234567890', YETKILI);
  const digerYetkili = () => google('digeruid12345678901', DIGER_YETKILI);
  const kayitsiz = () => google('kayitsizuid123456789', 'kayitsiz@ornek.com');
  const dogrulanmamis = () => google('dogrulanmamisuid1234', YETKILI, { email_verified: false });
  const anonim = () => user();
  let id;

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`yetkililer/${YETKILI}`).set({ ad: 'Hasan' });
      await db.doc(`yetkililer/${DIGER_YETKILI}`).set({ ad: 'Akdemir' });
      id = (await db.collection('basvurular').add({ ...valid(), createdAt: new Date() })).id;
      await db.doc(`basvurular/${id}/notlar/n1`).set({ metin: 'Diğerinin notu', yazan: DIGER_YETKILI, tarih: new Date() });
      await db.doc('islemler/i1').set({ kim: YETKILI, ne: 'ekle', ilanNo: 'AK-10008', commit: 'abc', tarih: new Date() });
    });
  });

  test('yalnızca yetkili başvuruları okur', async () => {
    await assertSucceeds(yetkili().firestore().doc(`basvurular/${id}`).get());
    await assertSucceeds(yetkili().firestore().collection('basvurular').where('status', '==', 'yeni').orderBy('createdAt', 'desc').get());
    for (const ctx of [kayitsiz(), dogrulanmamis(), anonim()]) await assertFails(ctx.firestore().doc(`basvurular/${id}`).get());
  });

  test('yetkili yalnızca durum ve inceleme alanlarını kendi adıyla günceller', async () => {
    const ref = (ctx) => ctx.firestore().doc(`basvurular/${id}`);
    await assertSucceeds(ref(yetkili()).update({ status: 'inceleniyor', inceleme: { guncelleyen: YETKILI, guncellendi: ts() } }));
    await assertSucceeds(ref(yetkili()).update({ status: 'reddedildi', inceleme: { guncelleyen: YETKILI, guncellendi: ts(), redSebebi: 'Bölge dışı' } }));
    await assertFails(ref(yetkili()).update({ 'seller.phone': '+905000000000' }));
    await assertFails(ref(yetkili()).update({ status: 'inceleniyor', inceleme: { guncelleyen: DIGER_YETKILI, guncellendi: ts() } }));
    await assertFails(ref(yetkili()).update({ status: 'inceleniyor', inceleme: { guncelleyen: YETKILI, guncellendi: new Date() } }));
    await assertFails(ref(yetkili()).update({ status: 'yayinda', inceleme: { guncelleyen: YETKILI, guncellendi: ts() } }));
    await assertFails(ref(yetkili()).update({ status: 'inceleniyor', inceleme: { guncelleyen: YETKILI, guncellendi: ts(), html: '<b>' } }));
    await assertFails(ref(yetkili()).update({ status: 'reddedildi', inceleme: { guncelleyen: YETKILI, guncellendi: ts(), redSebebi: 'x'.repeat(301) } }));
    await assertFails(ref(kayitsiz()).update({ status: 'inceleniyor', inceleme: { guncelleyen: 'kayitsiz@ornek.com', guncellendi: ts() } }));
    await assertFails(ref(yetkili()).delete());
  });

  test('notlar: yetkili ekler ve okur, yalnızca kendi notunu siler, not değiştirilemez', async () => {
    const notlar = (ctx) => ctx.firestore().collection(`basvurular/${id}/notlar`);
    await assertSucceeds(notlar(yetkili()).doc('n2').set({ metin: 'Yarın yerinde bakılacak', yazan: YETKILI, tarih: ts() }));
    await assertSucceeds(notlar(yetkili()).get());
    await assertFails(notlar(yetkili()).doc('n3').set({ metin: 'Başkası adına', yazan: DIGER_YETKILI, tarih: ts() }));
    await assertFails(notlar(yetkili()).doc('n4').set({ metin: '', yazan: YETKILI, tarih: ts() }));
    await assertFails(notlar(yetkili()).doc('n1').delete());
    await assertFails(notlar(yetkili()).doc('n2').update({ metin: 'değişti' }));
    await assertSucceeds(notlar(yetkili()).doc('n2').delete());
    await assertFails(notlar(kayitsiz()).get());
    await assertFails(notlar(kayitsiz()).doc('n5').set({ metin: 'x', yazan: 'kayitsiz@ornek.com', tarih: ts() }));
  });

  test('cihazlar: yetkili yalnızca kendi altına yazar ve siler', async () => {
    const cihaz = { token: 'fcm-token', eklendi: ts(), cihaz: 'Chrome Android' };
    await assertSucceeds(yetkili().firestore().doc(`yetkililer/${YETKILI}/cihazlar/c1`).set(cihaz));
    await assertSucceeds(yetkili().firestore().doc(`yetkililer/${YETKILI}/cihazlar/c1`).delete());
    await assertFails(yetkili().firestore().doc(`yetkililer/${DIGER_YETKILI}/cihazlar/c1`).set(cihaz));
    await assertFails(yetkili().firestore().doc(`yetkililer/${YETKILI}/cihazlar/c2`).set({ ...cihaz, fazla: 1 }));
    await assertFails(kayitsiz().firestore().doc(`yetkililer/kayitsiz@ornek.com/cihazlar/c1`).set(cihaz));
  });

  test('yetkililer: kişi yalnızca kendi kaydını okur, kimse yazamaz', async () => {
    await assertSucceeds(yetkili().firestore().doc(`yetkililer/${YETKILI}`).get());
    await assertFails(yetkili().firestore().doc(`yetkililer/${DIGER_YETKILI}`).get());
    await assertFails(yetkili().firestore().doc(`yetkililer/${YETKILI}`).set({ ad: 'x' }));
    await assertFails(kayitsiz().firestore().doc('yetkililer/kayitsiz@ornek.com').set({ ad: 'x' }));
  });

  test('işlem kaydı: yetkili okur, kimse yazamaz', async () => {
    await assertSucceeds(yetkili().firestore().collection('islemler').get());
    await assertFails(yetkili().firestore().collection('islemler').add({ kim: YETKILI }));
    await assertFails(kayitsiz().firestore().collection('islemler').get());
  });

  const webp = (n) => {
    const b = new Uint8Array(n);
    b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    return b;
  };
  const put = (ctx, path) => ctx.storage().ref(path).put(webp(1024), { contentType: 'image/webp' });

  test('Storage: yetkili kendi yönetim klasörüne yükler, yetkisiz yükleyemez', async () => {
    await assertSucceeds(put(yetkili(), 'yonetim/yetkiliuid1234567890/abcdefghijklmnop1234.webp'));
    await assertFails(put(yetkili(), 'yonetim/baskauid/abcdefghijklmnop1234.webp'));
    await assertFails(put(kayitsiz(), 'yonetim/kayitsizuid123456789/abcdefghijklmnop1234.webp'));
    await assertFails(put(dogrulanmamis(), 'yonetim/dogrulanmamisuid1234/abcdefghijklmnop1234.webp'));
  });

  test('Storage: yetkili başvuru fotoğraflarını okur, anonim okuyamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(`basvurular/${UID}/abcdefghijklmnop5678.webp`).put(webp(100), { contentType: 'image/webp' });
    });
    await assertSucceeds(yetkili().storage().ref(`basvurular/${UID}/abcdefghijklmnop5678.webp`).getMetadata());
    await assertFails(anonim().storage().ref(`basvurular/${UID}/abcdefghijklmnop5678.webp`).getMetadata());
    await assertFails(kayitsiz().storage().ref(`basvurular/${UID}/abcdefghijklmnop5678.webp`).getMetadata());
  });

  test('ilan sahibi bilgisi: yalnızca yetkili kendi adıyla yazar ve okur', async () => {
    const ref = (ctx) => ctx.firestore().doc('ilanSahipleri/AK-10008');
    const veri = { ad: 'Mehmet Köse', telefon: '+905321234567', not: 'Anahtar komşuda', guncelleyen: YETKILI, guncellendi: ts() };
    await assertSucceeds(ref(yetkili()).set(veri));
    await assertSucceeds(ref(yetkili()).get());
    await assertSucceeds(ref(digerYetkili()).get());
    await assertFails(ref(yetkili()).set({ ...veri, guncelleyen: DIGER_YETKILI }));
    await assertFails(ref(yetkili()).set({ ...veri, fazla: 1 }));
    await assertFails(ref(yetkili()).set({ ...veri, not: 'x'.repeat(1001) }));
    for (const ctx of [kayitsiz(), anonim(), dogrulanmamis()]) {
      await assertFails(ref(ctx).get());
      await assertFails(ref(ctx).set(veri));
    }
  });
});

