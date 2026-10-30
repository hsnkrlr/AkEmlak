/**
 * public/data.json üzerindeki saf işlemler (ağ erişimi yok, birim testli).
 * Alan adları ve sınırlar sitedeki src/lib/schema.ts ile aynıdır. Elle eklenmiş, burada bilinmeyen
 * alanlar ve üst düzey anahtarlar her işlemde korunur.
 */
import { createHash } from 'node:crypto';

export type IlanJson = {
  ilanNo?: string;
  baslik: string;
  durum?: string;
  firsat?: boolean;
  fotograflar?: string[];
  baglanti?: string;
  [k: string]: unknown;
};
export type DataJson = { ilanlar: IlanJson[]; [k: string]: unknown };
export type IlanIslem = 'yayinda' | 'satildi' | 'gizli' | 'firsat' | 'firsatKaldir' | 'sil';

const KATEGORILER = [
  'daire', 'rezidans', 'villa', 'mustakil', 'dubleks', 'yazlik', 'ciftlik_evi', 'prefabrik',
  'arsa', 'tarla', 'bag_bahce', 'fistiklik', 'zeytinlik', 'ciftlik', 'isyeri', 'ofis', 'depo', 'imalathane', 'ahir',
  'otomobil', 'arazi_suv', 'motosiklet', 'ticari', 'is_makinesi', 'diger',
];

/** Yönetim uygulamasının düzenleyebildiği alanlar ve sınırları */
const METIN: Record<string, number> = {
  baslik: 140, kategoriAdi: 40, il: 60, ilce: 60, mahalle: 80, odaSayisi: 20, kat: 30, isitma: 40,
  marka: 40, model: 80, yakit: 30, vites: 30, renk: 30, aciklama: 6000,
  imarDurumu: 40, tapuDurumu: 40, adaParsel: 40,
};
const SAYI: Record<string, number> = {
  fiyat: 1e12, brutM2: 1e7, netM2: 1e7, banyoSayisi: 50, binaYasi: 300, modelYili: 2100, km: 1e7,
};
/** Sitenin (schema.ts) kabul ettiği yazımlar → data.json'a yazılan değer */
const SECIM: Record<string, Record<string, string>> = {
  tur: { satilik: 'satilik', 'satılık': 'satilik', kiralik: 'kiralik', 'kiralık': 'kiralik' },
  paraBirimi: { try: 'TRY', usd: 'USD', eur: 'EUR' },
  durum: {
    yayinda: 'yayinda', 'yayında': 'yayinda', satildi: 'satildi', 'satıldı': 'satildi', kiralandi: 'satildi', 'kiralandı': 'satildi',
    gizli: 'gizli', taslak: 'gizli',
  },
};
const DUZENLENEBILIR = [...Object.keys(METIN), ...Object.keys(SAYI), ...Object.keys(SECIM), 'kategori', 'ozellikler', 'firsat', 'baglanti'];

function metin(v: unknown, max: number): string {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
}

function sayi(v: unknown, max: number): number | null {
  if (typeof v === 'string') v = v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.'));
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
}

export function dogrula(girdi: unknown): { ok: true; ilan: IlanJson } | { ok: false; hata: string } {
  const r = girdi && typeof girdi === 'object' && !Array.isArray(girdi) ? (girdi as Record<string, unknown>) : {};
  const baslik = metin(r.baslik, METIN.baslik);
  if (!baslik) return { ok: false, hata: 'Başlık zorunlu.' };
  const ilan: IlanJson = { baslik };

  for (const [k, max] of Object.entries(METIN)) {
    const v = metin(r[k], max);
    if (v && k !== 'baslik') ilan[k] = v;
  }
  const kategoriHam = metin(r.kategori, 40);
  const kategori = kategoriHam.toLocaleLowerCase('tr-TR');
  if (kategori) ilan.kategori = KATEGORILER.includes(kategori) ? kategori : 'diger';
  // Bilinmeyen kategori adı kaybolmasın: sitede "Diğer" yerine bu ad gösterilir
  if (kategori && !KATEGORILER.includes(kategori) && !ilan.kategoriAdi) ilan.kategoriAdi = kategoriHam;
  for (const [k, harita] of Object.entries(SECIM)) {
    const v = harita[metin(r[k], 20).toLocaleLowerCase('tr-TR')];
    if (v) ilan[k] = v;
  }
  for (const [k, max] of Object.entries(SAYI)) {
    const v = sayi(r[k], max);
    if (v !== null) ilan[k] = v;
  }
  if (Array.isArray(r.ozellikler)) {
    const list = r.ozellikler.map((x) => metin(x, 60)).filter(Boolean).slice(0, 40);
    if (list.length) ilan.ozellikler = list;
  }
  if (r.firsat === true) ilan.firsat = true;
  const baglanti = metin(r.baglanti, 90);
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(baglanti)) ilan.baglanti = baglanti;
  return { ok: true, ilan };
}

export function sonrakiIlanNo(ilanlar: IlanJson[]): string {
  let max = 10000;
  for (const i of ilanlar) {
    const m = /^AK-(\d+)$/.exec(typeof i.ilanNo === 'string' ? i.ilanNo : '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `AK-${max + 1}`;
}

export function ilanBul(veri: DataJson, ilanNo: string): IlanJson | undefined {
  return veri.ilanlar.find((i) => i.ilanNo === ilanNo);
}

function sira(veri: DataJson, ilanNo: string): number {
  const i = veri.ilanlar.findIndex((x) => x.ilanNo === ilanNo);
  if (i < 0) throw new Error(`İlan bulunamadı: ${ilanNo}`);
  return i;
}

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
/** Sitedeki src/lib/format.ts slugify ile aynı */
export function slugify(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/['’`]/g, '')
    .replace(/[çğıiöşüâîû]/g, (c) => TR[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** İlanın sitedeki adresi (baglanti yoksa başlıktan) */
export const ilanAdresi = (i: IlanJson) => (typeof i.baglanti === 'string' && i.baglanti) || slugify(i.baslik);

/** Düzenleme sırasında başka biri değiştirdi mi? Yüklendiği andaki sürümle karşılaştırılır. */
export function ilanSurumu(i: IlanJson): string {
  return createHash('sha256').update(JSON.stringify(i)).digest('hex').slice(0, 16);
}

export function ekle(veri: DataJson, ilan: IlanJson, ilanNo: string, tarih: string, fotograflar: string[]): DataJson {
  const yeni: IlanJson = { ilanNo, ...ilan, fotograflar: [...fotograflar], durum: ilan.durum ?? 'yayinda', tarih };
  // Aynı adres başka ilanda varsa yeni ilana -2, -3… eki ver (mevcut ilanın adresi değişmesin)
  const kullanilan = new Set(veri.ilanlar.map(ilanAdresi));
  const adres = ilanAdresi(yeni);
  if (kullanilan.has(adres)) {
    let n = 2;
    while (kullanilan.has(`${adres}-${n}`)) n++;
    yeni.baglanti = `${adres}-${n}`;
  }
  return { ...veri, ilanlar: [yeni, ...veri.ilanlar] };
}

export function guncelle(veri: DataJson, ilanNo: string, ilan: IlanJson, fotograflar: string[]): DataJson {
  const n = sira(veri, ilanNo);
  const eski = veri.ilanlar[n];
  const yeni: IlanJson = { ...eski };
  for (const k of DUZENLENEBILIR) delete yeni[k];
  Object.assign(yeni, ilan, { ilanNo: eski.ilanNo, fotograflar: [...fotograflar] });
  if ('tarih' in eski) yeni.tarih = eski.tarih;
  const ilanlar = [...veri.ilanlar];
  ilanlar[n] = yeni;
  return { ...veri, ilanlar };
}

export function islemUygula(veri: DataJson, ilanNo: string, islem: IlanIslem): DataJson {
  const n = sira(veri, ilanNo);
  const ilanlar = [...veri.ilanlar];
  if (islem === 'sil') ilanlar.splice(n, 1);
  else if (islem === 'firsat' || islem === 'firsatKaldir') ilanlar[n] = { ...ilanlar[n], firsat: islem === 'firsat' };
  else ilanlar[n] = { ...ilanlar[n], durum: islem };
  return { ...veri, ilanlar };
}

const tumFotograflar = (veri: DataJson) => new Set(veri.ilanlar.flatMap((i) => (Array.isArray(i.fotograflar) ? i.fotograflar : [])));

export function kullanilmayanFotograflar(eski: DataJson, yeni: DataJson): string[] {
  const kalan = tumFotograflar(yeni);
  return [...tumFotograflar(eski)].filter((f) => !kalan.has(f));
}

/** Başvuru fotoğrafı yalnızca başvuruyu gönderenin klasöründen alınabilir */
export function basvuruFotografiMi(yol: string, uid: string): boolean {
  const m = /^basvurular\/([A-Za-z0-9]{10,128})\/[A-Za-z0-9_-]{16,40}\.(webp|jpg)$/.exec(yol);
  return !!m && m[1] === uid;
}

export function fotografAdi(ilanNo: string, sira: number, rastgele: string): string {
  return `${ilanNo.toLowerCase()}-${sira}-${rastgele}.webp`;
}

export function yaziyaDok(veri: DataJson): string {
  return JSON.stringify(veri, null, 2) + '\n';
}
