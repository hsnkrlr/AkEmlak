/**
 * Ak Emlak — ilan başvurusu arka plan işleri
 *
 *  basvuruKontrolVeBildirim : yeni başvuruda fotoğrafları doğrular, şüpheli gönderimi işaretler,
 *                             alıcı listesine e-posta (fotoğraflar ekli) gönderir.
 *  gunlukTemizlik           : 2 yıldan eski başvuruları ve başvuruya bağlanmamış fotoğrafları her gece siler.
 *  ilanlariGetir, ilanKaydet, ilanIslem : yönetim uygulaması (bkz. yonetim.ts)
 *
 * Ayarlar Firestore'da `ayarlar/bildirim` belgesindedir (yalnızca konsoldan düzenlenir):
 *   { alicilar: ["a@gmail.com", "b@gmail.com"], gonderen: "gonderen@gmail.com" }
 * Gmail uygulama şifresi Secret Manager'da `GMAIL_APP_PASSWORD` adıyla durur; kodda veya repoda yoktur.
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import nodemailer from 'nodemailer';
import { isImage } from './resim';

export * from './yonetim';

setGlobalOptions({ region: 'europe-west3', maxInstances: 3 });
initializeApp();

const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const SITE_NAME = 'Ak Emlak';

const TYPE_LABEL: Record<string, string> = {
  daire: 'Daire',
  mustakil: 'Müstakil Ev',
  villa: 'Villa',
  arsa: 'Arsa',
  tarla: 'Tarla / Bahçe',
  isyeri: 'Dükkan / İş Yeri',
  arac: 'Araç',
  diger: 'Diğer',
};

interface Application {
  number: string;
  uid: string;
  createdAt?: Timestamp;
  seller: { name: string; phone: string; email?: string };
  listing: Record<string, unknown> & { type: string };
  photos: unknown[];
  resubmission: { isResubmission: boolean; of: string | null; original: string | null; revision: number };
}

const PHOTO_RE = /^basvurular\/([A-Za-z0-9]{10,128})\/[A-Za-z0-9_-]{16,40}\.(webp|jpg)$/;
const MAX_ATTACH_BYTES = 18 * 1024 * 1024;

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Ayrıntı alanlarının tür/uzunluk kontrolü (Firestore kurallarındaki ifade sınırı nedeniyle burada yapılır).
 * Hatalı alanlar e-postaya konmaz ve uyarı olarak işaretlenir.
 */
const NUM_FIELDS: Record<string, number> = { grossM2: 1e7, netM2: 1e7, buildingAge: 300, bathrooms: 50, modelYear: 2100, km: 1e7 };
const STR_FIELDS: Record<string, number> = { rooms: 20, floor: 30, heating: 40, zoning: 40, deed: 40, parcel: 60, brand: 40, model: 80, fuel: 30, gear: 30 };
const BOOL_FIELDS = ['furnished', 'inSite'];

function checkListing(l: Record<string, unknown>): { clean: Record<string, unknown>; invalid: string[] } {
  const clean: Record<string, unknown> = { ...l };
  const invalid: string[] = [];
  for (const [k, max] of Object.entries(NUM_FIELDS)) {
    if (k in l && !(typeof l[k] === 'number' && Number.isFinite(l[k]) && (l[k] as number) >= 0 && (l[k] as number) <= max)) invalid.push(k);
  }
  for (const [k, max] of Object.entries(STR_FIELDS)) {
    if (k in l && !(typeof l[k] === 'string' && (l[k] as string).length <= max)) invalid.push(k);
  }
  for (const k of BOOL_FIELDS) if (k in l && typeof l[k] !== 'boolean') invalid.push(k);
  if (Array.isArray(l.features) && l.features.some((f) => typeof f !== 'string' || f.length > 60)) invalid.push('features');
  for (const k of invalid) delete clean[k];
  return { clean, invalid };
}

/** Tekrar gönderimde önceki başvurunun fotoğrafları da kabul edilir (cihaz verisi silinip yeni oturum açılmış olabilir). */
async function allowedPreviousPhotos(app: Application): Promise<Set<string>> {
  const allowed = new Set<string>();
  const prevNumber = app.resubmission?.of;
  if (!prevNumber) return allowed;
  const prev = await getFirestore().collection('basvurular').where('number', '==', prevNumber).limit(5).get();
  for (const doc of prev.docs) for (const p of (doc.get('photos') as unknown[]) ?? []) if (typeof p === 'string') allowed.add(p);
  return allowed;
}

export const basvuruKontrolVeBildirim = onDocumentCreated(
  { document: 'basvurular/{id}', secrets: [GMAIL_APP_PASSWORD], memory: '512MiB', timeoutSeconds: 120, retry: false },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const app = snap.data() as Application;
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const flags: string[] = [];

    // 1) Fotoğrafları sunucuda doğrula
    const previous = await allowedPreviousPhotos(app);
    const photos: { path: string; buf: Buffer; contentType: string }[] = [];
    for (const raw of app.photos ?? []) {
      const path = typeof raw === 'string' ? raw : '';
      const m = PHOTO_RE.exec(path);
      if (!m || (m[1] !== app.uid && !previous.has(path))) {
        flags.push('yabanci-foto-yolu');
        continue;
      }
      try {
        const [buf] = await bucket.file(path).download();
        if (!isImage(buf)) {
          flags.push('resim-olmayan-dosya');
          await bucket.file(path).delete().catch(() => undefined);
          continue;
        }
        photos.push({ path, buf, contentType: path.endsWith('.webp') ? 'image/webp' : 'image/jpeg' });
      } catch {
        flags.push('eksik-foto');
      }
    }

    // 2) Ayrıntı alanlarını doğrula
    const { clean: listing, invalid } = checkListing(app.listing);
    if (invalid.length) flags.push(`gecersiz-alan:${invalid.join(',')}`);

    // 3) Aynı oturumdan kısa sürede çok başvuru → şüpheli (e-posta gönderilmez)
    // (Bu kontrol başarısız olsa da bildirim gönderilir; başvuru hiçbir durumda sessizce kaybolmaz.)
    let spam = false;
    try {
      const since = Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
      const recent = await db.collection('basvurular').where('uid', '==', app.uid).where('createdAt', '>', since).count().get();
      spam = recent.data().count > 4;
      if (spam) flags.push('cok-sik-gonderim');
    } catch (e) {
      flags.push('hiz-kontrolu-yapilamadi');
      logger.error('Hız kontrolü yapılamadı', e);
    }

    await snap.ref.update({
      status: spam ? 'supheli' : 'yeni',
      kontrol: { at: FieldValue.serverTimestamp(), dogrulananFoto: photos.length, uyarilar: flags },
    });
    if (spam) {
      logger.warn('Şüpheli başvuru, e-posta gönderilmedi', { id: snap.id, uid: app.uid });
      return;
    }

    // 4) E-posta bildirimi
    const settings = (await db.doc('ayarlar/bildirim').get()).data() ?? {};
    const to = (Array.isArray(settings.alicilar) ? settings.alicilar : []).filter((e: unknown) => typeof e === 'string' && e.includes('@'));
    const from = typeof settings.gonderen === 'string' ? settings.gonderen : '';
    if (!to.length || !from) {
      logger.error('ayarlar/bildirim belgesinde "alicilar" veya "gonderen" eksik; e-posta gönderilmedi.');
      return;
    }

    let attachBytes = 0;
    const attachments = photos
      .filter((p) => (attachBytes += p.buf.length) <= MAX_ATTACH_BYTES)
      .map((p, i) => ({ filename: `${app.number}-${i + 1}.${p.path.endsWith('.webp') ? 'webp' : 'jpg'}`, content: p.buf, contentType: p.contentType }));

    const l = listing;
    const type = TYPE_LABEL[String(l.type)] ?? String(l.type);
    const place = [l.neighborhood, l.district, l.city].filter(Boolean).join(', ');
    const resub = app.resubmission?.isResubmission;
    const subject = `${resub ? `Güncellenen başvuru (${app.resubmission.revision + 1}. sürüm)` : 'Yeni ilan başvurusu'} ${app.number} – ${type}${place ? `, ${place}` : ''}`;

    const rows: [string, unknown][] = [
      ['Başvuru No', app.number],
      ['Tekrar gönderim', resub ? `Evet — önceki: ${app.resubmission.of}, ilk başvuru: ${app.resubmission.original ?? app.resubmission.of}` : 'Hayır'],
      ['Ad Soyad', app.seller.name],
      ['Telefon', app.seller.phone],
      ['E-posta', app.seller.email],
      ['İlan tipi', type],
      ['Satılık / Kiralık', l.deal === 'kiralik' ? 'Kiralık' : l.deal === 'satilik' ? 'Satılık' : ''],
      ['Konum', place],
      ['Adres tarifi', l.address],
      ['Fiyat', typeof l.price === 'number' ? `${new Intl.NumberFormat('tr-TR').format(l.price)} TL` : ''],
      ['Brüt / Net m²', [l.grossM2, l.netM2].filter((v) => v !== undefined).join(' / ')],
      ['Oda', l.rooms],
      ['Kat', l.floor],
      ['Bina yaşı', l.buildingAge],
      ['Banyo', l.bathrooms],
      ['Isıtma', l.heating],
      ['Eşyalı', l.furnished === true ? 'Evet' : l.furnished === false ? 'Hayır' : ''],
      ['Site içinde', l.inSite === true ? 'Evet' : l.inSite === false ? 'Hayır' : ''],
      ['İmar durumu', l.zoning],
      ['Tapu durumu', l.deed],
      ['Ada / Parsel', l.parcel],
      ['Marka / Model', [l.brand, l.model].filter(Boolean).join(' ')],
      ['Model yılı', l.modelYear],
      ['Kilometre', l.km],
      ['Yakıt / Vites', [l.fuel, l.gear].filter(Boolean).join(' / ')],
      ['Özellikler', Array.isArray(l.features) ? l.features.join(', ') : ''],
      ['Fotoğraf', `${photos.length} adet (ekte)`],
      ['Uyarılar', flags.join(', ')],
    ];
    const phoneDigits = app.seller.phone.replace(/\D/g, '');
    const consoleUrl = `https://console.firebase.google.com/project/${process.env.GCLOUD_PROJECT}/firestore/databases/-default-/data/~2Fbasvurular~2F${snap.id}`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b2a33">
      <h2 style="margin:0 0 12px">${esc(subject)}</h2>
      <p><a href="tel:${esc(app.seller.phone)}">Ara</a> · <a href="https://wa.me/${esc(phoneDigits)}">WhatsApp'tan yaz</a> · <a href="${esc(consoleUrl)}">Firebase'de aç</a></p>
      <table cellpadding="6" style="border-collapse:collapse">${rows
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `<tr><td style="color:#5d6a72;border-bottom:1px solid #eee">${esc(k)}</td><td style="border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`)
        .join('')}</table>
      ${l.description ? `<h3>Açıklama</h3><p style="white-space:pre-line">${esc(l.description)}</p>` : ''}
    </div>`;

    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: from, pass: GMAIL_APP_PASSWORD.value().replace(/\s+/g, '') } });
    await transport.sendMail({
      from: `"${SITE_NAME} Başvuru" <${from}>`,
      to,
      subject,
      html,
      text: rows.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join('\n') + (l.description ? `\n\n${l.description}` : ''),
      attachments,
    });
    await snap.ref.update({ bildirim: { gonderildi: true, at: FieldValue.serverTimestamp(), alicilar: to.length } });
    logger.info('Başvuru bildirimi gönderildi', { id: snap.id, number: app.number, photos: photos.length });
  },
);

/**
 * Her gece:
 *  - 2 yıldan eski başvuruları fotoğraflarıyla birlikte siler (KVKK aydınlatma metnindeki saklama süresi),
 *  - yüklenip başvuruya bağlanmamış (24 saatten eski) fotoğrafları ve yönetimden yüklenip yayınlanmamış fotoğrafları siler.
 */
export const gunlukTemizlik = onSchedule({ schedule: '0 4 * * *', timeZone: 'Europe/Istanbul', timeoutSeconds: 300 }, async () => {
  const db = getFirestore();
  const bucket = getStorage().bucket();

  const expiry = Timestamp.fromMillis(Date.now() - 730 * 24 * 60 * 60 * 1000);
  const old = await db.collection('basvurular').where('createdAt', '<', expiry).get();
  for (const doc of old.docs) {
    for (const p of (doc.get('photos') as unknown[]) ?? []) if (typeof p === 'string') await bucket.file(p).delete().catch(() => undefined);
    await doc.ref.delete();
  }

  const referenced = new Set<string>();
  const apps = await db.collection('basvurular').select('photos').get();
  for (const doc of apps.docs) for (const p of (doc.get('photos') as unknown[]) ?? []) if (typeof p === 'string') referenced.add(p);

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [files] = await bucket.getFiles({ prefix: 'basvurular/' });
  let orphans = 0;
  for (const f of files) {
    const created = Date.parse(String(f.metadata.timeCreated ?? ''));
    if (!referenced.has(f.name) && created && created < cutoff) {
      await f.delete().catch(() => undefined);
      orphans++;
    }
  }
  // Yönetim uygulamasından yüklenip ilana dönüşmemiş (yarıda kalmış) fotoğraflar
  const [uploads] = await bucket.getFiles({ prefix: 'yonetim/' });
  for (const f of uploads) {
    const created = Date.parse(String(f.metadata.timeCreated ?? ''));
    if (created && created < cutoff) {
      await f.delete().catch(() => undefined);
      orphans++;
    }
  }
  logger.info('Günlük temizlik', { suresiDolanBasvuru: old.size, yetimFoto: orphans });
});
