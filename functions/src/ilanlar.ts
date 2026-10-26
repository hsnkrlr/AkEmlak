/**
 * public/data.json üzerindeki saf işlemler (ağ erişimi yok, birim testli).
 * Alan adları ve sınırlar sitedeki src/lib/schema.ts ile aynıdır. Elle eklenmiş, burada bilinmeyen
 * alanlar ve üst düzey anahtarlar her işlemde korunur.
 */

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
  'daire', 'rezidans', 'villa', 'mustakil', 'yazlik', 'arsa', 'tarla', 'isyeri', 'ofis', 'depo',
  'otomobil', 'arazi_suv', 'motosiklet', 'ticari', 'is_makinesi', 'diger',
];

/** Yönetim uygulamasının düzenleyebildiği alanlar ve sınırları */
const METIN: Record<string, number> = {
  baslik: 140, kategoriAdi: 40, il: 60, ilce: 60, mahalle: 80, odaSayisi: 20, kat: 30, isitma: 40,
  marka: 40, model: 80, yakit: 30, vites: 30, renk: 30, aciklama: 5000,
};
const SAYI: Record<string, number> = {
  fiyat: 1e12, brutM2: 1e7, netM2: 1e7, banyoSayisi: 50, binaYasi: 300, modelYili: 2100, km: 1e7,
};
const SECIM: Record<string, string[]> = {
  tur: ['satilik', 'kiralik'],
  paraBirimi: ['TRY', 'USD', 'EUR'],
  durum: ['yayinda', 'satildi', 'gizli'],
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

  const kategori = metin(r.kategori, 40).toLocaleLowerCase('tr-TR');
  if (kategori) ilan.kategori = KATEGORILER.includes(kategori) ? kategori : 'diger';
  for (const [k, values] of Object.entries(SECIM)) {
    const v = metin(r[k], 20);
    if (values.includes(v)) ilan[k] = v;
  }
  for (const [k, max] of Object.entries(METIN)) {
    const v = metin(r[k], max);
    if (v && k !== 'baslik') ilan[k] = v;
  }
  for (const [k, max] of Object.entries(SAYI)) {
    const v = sayi(r[k], max);
    if (v !== null) ilan[k] = v;
  }
  if (Array.isArray(r.ozellikler)) {
    const list = r.ozellikler.map((x) => metin(x, 60)).filter(Boolean).slice(0, 20);
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

export function ekle(veri: DataJson, ilan: IlanJson, ilanNo: string, tarih: string, fotograflar: string[]): DataJson {
  const yeni: IlanJson = { ilanNo, ...ilan, fotograflar: [...fotograflar], durum: ilan.durum ?? 'yayinda', tarih };
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

export function fotografAdi(ilanNo: string, sira: number, rastgele: string): string {
  return `${ilanNo.toLowerCase()}-${sira}-${rastgele}.webp`;
}

export function yaziyaDok(veri: DataJson): string {
  return JSON.stringify(veri, null, 2) + '\n';
}
