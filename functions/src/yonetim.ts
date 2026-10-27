/**
 * Yönetim uygulamasının çağırdığı fonksiyonlar. Siteyi değiştiren her işlem buradan geçer:
 * yetki denetlenir, girdi yeniden doğrulanır, fotoğraflar yeniden kodlanır ve değişiklik
 * GitHub'daki public/data.json + public/img dosyalarına tek commit olarak yazılır (Vercel yeniden yayınlar).
 *
 *  ilanlariGetir : güncel data.json (GitHub'dan)
 *  ilanKaydet    : yeni ilan / düzenleme / başvurudan ilan
 *  ilanIslem     : yayına al, satıldı, gizle, fırsat, sil
 */
import { randomBytes } from 'node:crypto';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { depoOlustur, GithubHatasi, type Depo } from './github';
import {
  basvuruFotografiMi, dogrula, ekle, fotografAdi, guncelle, ilanAdresi, ilanBul, ilanSurumu, islemUygula, kullanilmayanFotograflar,
  sonrakiIlanNo, yaziyaDok, type DataJson, type IlanIslem, type IlanJson,
} from './ilanlar';
import { fotografIsle } from './resim';
import { yetkiliMi } from './yetki';

const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');
const GITHUB_BRANCH = defineString('GITHUB_BRANCH', { default: 'ccr-02329762-r3ekpj' });
const GITHUB_API = defineString('GITHUB_API', { default: 'https://api.github.com' });
const GITHUB_REPO = 'hsnkrlr/AkEmlak';
const SITE = 'https://ak-emlak.vercel.app';

const SECENEK = {
  // index.ts'teki setGlobalOptions bu modül yüklendikten sonra çalışır; bölge burada açıkça verilir.
  region: 'europe-west3',
  // Emülatörde App Check belirteci üretilemez; canlıda her zaman zorunludur.
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  consumeAppCheckToken: false,
  secrets: [GITHUB_TOKEN],
  memory: '1GiB' as const,
  timeoutSeconds: 120,
  // Maliyet sınırı (index.ts'teki genel ayar bu modüle uygulanmaz)
  maxInstances: 3,
};

const ISLEMLER: IlanIslem[] = ['yayinda', 'satildi', 'gizli', 'firsat', 'firsatKaldir', 'sil'];
const ISLEM_METNI: Record<IlanIslem, string> = {
  yayinda: 'yayına alındı', satildi: 'satıldı', gizli: 'gizlendi', firsat: 'fırsat', firsatKaldir: 'fırsat kaldırıldı', sil: 'silindi',
};
/** data.json'da izin verilen fotoğraf adı (sitedeki schema.ts ile aynı); silinecek yol yalnızca bu desene uyarsa kullanılır */
const FOTO_ADI = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü][A-Za-z0-9ÇĞİÖŞÜçğıöşü ._-]*\.(jpe?g|png|webp|avif)$/i;
const ILAN_NO = /^[A-Za-z0-9-]{1,20}$/;

type FotoGirdi = { mevcut: string } | { yukleme: string } | { basvuru: string };

async function yetkiliGerekir(req: CallableRequest): Promise<string> {
  const email = await yetkiliMi(req.auth, async (e) => (await getFirestore().doc(`yetkililer/${e}`).get()).exists);
  if (!email) throw new HttpsError('permission-denied', 'Bu hesabın yetkisi yok.');
  return email;
}

function depo(): Depo {
  return depoOlustur({ token: GITHUB_TOKEN.value().trim(), repo: GITHUB_REPO, branch: GITHUB_BRANCH.value(), api: GITHUB_API.value(), yaziyaDok });
}

/** İç hataları kullanıcıya gösterilecek Türkçe HttpsError'a çevirir. */
function hataCevir(e: unknown): HttpsError {
  if (e instanceof HttpsError) return e;
  if (e instanceof GithubHatasi) {
    logger.error('GitHub hatası', { kod: e.kod, durum: e.durum, github: e.github, mesaj: e.message });
    return new HttpsError(e.kod === 'anahtar' ? 'failed-precondition' : e.kod === 'cakisma' ? 'aborted' : 'unavailable', e.message);
  }
  const mesaj = e instanceof Error ? e.message : String(e);
  if (/^İlan bulunamadı/.test(mesaj)) return new HttpsError('not-found', mesaj);
  if (/^Fotoğraf okunamadı/.test(mesaj)) return new HttpsError('invalid-argument', mesaj);
  logger.error('Yönetim işlemi başarısız', { mesaj });
  return new HttpsError('internal', 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
}

const bugun = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());

const baglanti = (i: IlanJson) => `${SITE}/detay/${ilanAdresi(i)}`;
const ISTEK_ID = /^[A-Za-z0-9]{16,40}$/;
const imgYolu = (ad: string) => `public/img/${ad}`;

async function islemKaydet(kim: string, ne: string, ilanNo: string, commit: string, ek: { istekId?: string; baglanti?: string } = {}) {
  await getFirestore().collection('islemler').add({ kim, ne, ilanNo, commit, ...ek, tarih: FieldValue.serverTimestamp() });
}

/**
 * Aynı istek (bağlantı koptuğu için "Tekrar dene"ye basılması) ikinci kez işlenmez: önceki sonuç döner.
 * İstemci her form/işlem için rastgele bir istekId üretir.
 */
async function oncekiSonuc(istekId: string) {
  const q = await getFirestore().collection('islemler').where('istekId', '==', istekId).limit(1).get();
  const d = q.docs[0]?.data();
  return d ? { ilanNo: String(d.ilanNo), baglanti: String(d.baglanti ?? ''), commit: String(d.commit) } : null;
}

/** Storage'da bulunamayan dosya (ör. gece temizliğinde silinmiş) için anlaşılır hata */
async function indir(yol: string): Promise<Buffer> {
  try {
    const [buf] = await getStorage().bucket().file(yol).download();
    return buf;
  } catch (e) {
    if ((e as { code?: number }).code === 404) throw new HttpsError('not-found', 'Bir fotoğraf bulunamadı (silinmiş olabilir). Fotoğrafı kaldırıp tekrar ekleyin.');
    throw e;
  }
}

export const ilanlariGetir = onCall(SECENEK, async (req) => {
  await yetkiliGerekir(req);
  try {
    const { veri, commit } = await depo().oku();
    // Düzenleme ekranı kaydederken bu sürümü geri gönderir; arada değişmişse kayıt reddedilir
    const surumler = Object.fromEntries(veri.ilanlar.filter((i) => i.ilanNo).map((i) => [i.ilanNo, ilanSurumu(i)]));
    return { ilanlar: veri.ilanlar, commit, surumler };
  } catch (e) {
    throw hataCevir(e);
  }
});

export const ilanKaydet = onCall(SECENEK, async (req) => {
  const email = await yetkiliGerekir(req);
  const uid = req.auth!.uid;
  const data = (req.data ?? {}) as { ilan?: unknown; ilanNo?: unknown; fotograflar?: unknown; basvuruId?: unknown; surum?: unknown; istekId?: unknown };
  const istekId = typeof data.istekId === 'string' ? data.istekId : '';
  if (!ISTEK_ID.test(istekId)) throw new HttpsError('invalid-argument', 'Geçersiz istek.');
  const onceki = await oncekiSonuc(istekId);
  if (onceki) return onceki;

  const d = dogrula(data.ilan);
  if (!d.ok) throw new HttpsError('invalid-argument', d.hata);
  const duzenlenen = typeof data.ilanNo === 'string' && data.ilanNo ? data.ilanNo : null;
  if (duzenlenen !== null && !ILAN_NO.test(duzenlenen)) throw new HttpsError('invalid-argument', 'Geçersiz ilan numarası.');
  const surum = typeof data.surum === 'string' ? data.surum : '';
  if (duzenlenen !== null && !surum) throw new HttpsError('invalid-argument', 'İlan sürümü eksik. Sayfayı yenileyip tekrar deneyin.');
  const basvuruId = typeof data.basvuruId === 'string' && data.basvuruId ? data.basvuruId : null;
  if (basvuruId !== null && !/^[A-Za-z0-9]{1,64}$/.test(basvuruId)) throw new HttpsError('invalid-argument', 'Geçersiz başvuru.');
  const fotolar = Array.isArray(data.fotograflar) ? (data.fotograflar as FotoGirdi[]) : [];
  if (fotolar.length > 10) throw new HttpsError('invalid-argument', 'En fazla 10 fotoğraf eklenebilir.');

  const db = getFirestore();
  let basvuruFotolari: string[] = [];
  if (basvuruId) {
    const b = await db.doc(`basvurular/${basvuruId}`).get();
    if (!b.exists) throw new HttpsError('not-found', 'Başvuru bulunamadı.');
    const onayliNo = b.get('status') === 'onaylandi' ? (b.get('inceleme.ilanNo') as string | undefined) : undefined;
    if (onayliNo) throw new HttpsError('already-exists', `Bu başvuru zaten ${onayliNo} numaralı ilana dönüştürüldü.`);
    // Ziyaretçinin yazdığı yol listesine güvenilmez: yalnızca başvuru sahibinin klasöründekiler
    const sahip = String(b.get('uid') ?? '');
    basvuruFotolari = ((b.get('photos') as unknown[]) ?? []).filter((p): p is string => typeof p === 'string' && basvuruFotografiMi(p, sahip));
  }
  const yuklemeRe = new RegExp(`^yonetim/${uid}/[A-Za-z0-9_-]{16,40}\\.(webp|jpg)$`);

  try {
    // Yeni fotoğraflar commit denemelerinden önce bir kez indirilip yeniden kodlanır
    const bucket = getStorage().bucket();
    const plan: ({ tur: 'mevcut'; ad: string } | { tur: 'yeni'; icerik: Buffer; kaynak: string })[] = [];
    for (const f of fotolar) {
      if (f && typeof f === 'object' && 'mevcut' in f && typeof f.mevcut === 'string') {
        plan.push({ tur: 'mevcut', ad: f.mevcut });
      } else if (f && typeof f === 'object' && 'yukleme' in f && typeof f.yukleme === 'string' && yuklemeRe.test(f.yukleme)) {
        plan.push({ tur: 'yeni', icerik: await fotografIsle(await indir(f.yukleme)), kaynak: f.yukleme });
      } else if (f && typeof f === 'object' && 'basvuru' in f && typeof f.basvuru === 'string' && basvuruFotolari.includes(f.basvuru)) {
        plan.push({ tur: 'yeni', icerik: await fotografIsle(await indir(f.basvuru)), kaynak: f.basvuru });
      } else {
        throw new HttpsError('invalid-argument', 'Geçersiz fotoğraf seçimi.');
      }
    }

    let ilanNo = '';
    let sonIlan: IlanJson = d.ilan;
    const sonuc = await depo().yaz(async (veri: DataJson) => {
      ilanNo = duzenlenen ?? sonrakiIlanNo(veri.ilanlar);
      const mevcutlar = new Set(duzenlenen ? (ilanBul(veri, duzenlenen)?.fotograflar ?? []) : []);
      if (duzenlenen && !ilanBul(veri, duzenlenen)) throw new Error(`İlan bulunamadı: ${duzenlenen}`);
      if (duzenlenen && ilanSurumu(ilanBul(veri, duzenlenen)!) !== surum) {
        throw new HttpsError('aborted', 'Bu ilan siz düzenlerken değişti (başka bir yetkili ya da data.json). İlanı yeniden açıp tekrar deneyin.');
      }
      const kullanilan = new Set(veri.ilanlar.flatMap((i) => i.fotograflar ?? []));
      const adlar: string[] = [];
      const ekleList: { yol: string; icerik: Buffer }[] = [];
      plan.forEach((p, n) => {
        if (p.tur === 'mevcut') {
          if (!mevcutlar.has(p.ad)) throw new HttpsError('invalid-argument', 'Geçersiz fotoğraf seçimi.');
          adlar.push(p.ad);
          return;
        }
        let ad = '';
        do ad = fotografAdi(ilanNo, n + 1, randomBytes(3).toString('hex').slice(0, 4));
        while (kullanilan.has(ad) || adlar.includes(ad));
        adlar.push(ad);
        ekleList.push({ yol: imgYolu(ad), icerik: p.icerik });
      });
      const yeni = duzenlenen ? guncelle(veri, ilanNo, d.ilan, adlar) : ekle(veri, d.ilan, ilanNo, bugun(), adlar);
      sonIlan = ilanBul(yeni, ilanNo)!;
      const sil = kullanilmayanFotograflar(veri, yeni).filter((f) => FOTO_ADI.test(f)).map(imgYolu);
      return { veri: yeni, ekle: ekleList, sil };
    }, () => `Yönetim: ${ilanNo} ${duzenlenen ? 'güncellendi' : 'eklendi'} (${email})`);

    if (basvuruId) {
      await db.doc(`basvurular/${basvuruId}`).update({
        status: 'onaylandi',
        inceleme: { guncelleyen: email, guncellendi: FieldValue.serverTimestamp(), ilanNo },
      });
    }
    const sonucBaglanti = baglanti(sonIlan);
    await islemKaydet(email, duzenlenen ? 'duzenle' : 'ekle', ilanNo, sonuc.commit, { istekId, baglanti: sonucBaglanti });
    // Yönetimden yüklenen geçici dosyalar artık depoda; Storage'dan kaldır
    await Promise.all(plan.filter((p) => p.tur === 'yeni' && p.kaynak.startsWith('yonetim/')).map((p) => bucket.file((p as { kaynak: string }).kaynak).delete().catch(() => undefined)));
    return { ilanNo, baglanti: sonucBaglanti, commit: sonuc.commit };
  } catch (e) {
    throw hataCevir(e);
  }
});

export const ilanIslem = onCall(SECENEK, async (req) => {
  const email = await yetkiliGerekir(req);
  const data = (req.data ?? {}) as { ilanNo?: unknown; islem?: unknown; istekId?: unknown };
  const istekId = typeof data.istekId === 'string' && ISTEK_ID.test(data.istekId) ? data.istekId : '';
  if (istekId) {
    const onceki = await oncekiSonuc(istekId);
    if (onceki) return { commit: onceki.commit };
  }
  const ilanNo = typeof data.ilanNo === 'string' ? data.ilanNo : '';
  const islem = data.islem as IlanIslem;
  if (!ILAN_NO.test(ilanNo) || !ISLEMLER.includes(islem)) throw new HttpsError('invalid-argument', 'Geçersiz işlem.');
  try {
    const sonuc = await depo().yaz(async (veri) => {
      const yeni = islemUygula(veri, ilanNo, islem);
      const sil = islem === 'sil' ? kullanilmayanFotograflar(veri, yeni).filter((f) => FOTO_ADI.test(f)).map(imgYolu) : [];
      return { veri: yeni, ekle: [], sil };
    }, `Yönetim: ${ilanNo} ${ISLEM_METNI[islem]} (${email})`);
    await islemKaydet(email, islem === 'sil' ? 'sil' : 'durum', ilanNo, sonuc.commit, istekId ? { istekId } : {});
    return { commit: sonuc.commit };
  } catch (e) {
    throw hataCevir(e);
  }
});
