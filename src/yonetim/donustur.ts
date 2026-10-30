/**
 * Başvuru (Firestore `basvurular`) → ilan taslağı (data.json alanları). Yönetici taslağı düzenleyip yayınlar.
 * Saf modül: düğüm testleri için yerel dosyaları yalnızca `import type` ile alır.
 */

/** data.json'daki bir ilanın düzenlenebilir alanları (ilanNo, tarih ve fotograflar hariç) */
export interface IlanTaslak {
  baslik: string;
  kategori?: string;
  kategoriAdi?: string;
  tur?: 'satilik' | 'kiralik';
  fiyat?: number;
  paraBirimi?: 'TRY' | 'USD' | 'EUR';
  il?: string;
  ilce?: string;
  mahalle?: string;
  brutM2?: number;
  netM2?: number;
  odaSayisi?: string;
  banyoSayisi?: number;
  kat?: string;
  binaYasi?: number;
  isitma?: string;
  imarDurumu?: string;
  tapuDurumu?: string;
  adaParsel?: string;
  marka?: string;
  model?: string;
  modelYili?: number;
  km?: number;
  yakit?: string;
  vites?: string;
  renk?: string;
  ozellikler?: string[];
  aciklama?: string;
  durum?: 'yayinda' | 'satildi' | 'gizli';
  firsat?: boolean;
  baglanti?: string;
}

const KATEGORI: Record<string, string> = {
  daire: 'daire', mustakil: 'mustakil', villa: 'villa', arsa: 'arsa', tarla: 'tarla', isyeri: 'isyeri', arac: 'otomobil', diger: 'diger',
};
const TIP_ADI: Record<string, string> = {
  daire: 'Daire', mustakil: 'Müstakil Ev', villa: 'Villa', arsa: 'Arsa', tarla: 'Tarla', isyeri: 'Dükkan', arac: 'Araç', diger: '',
};
const METIN_ESLEME: [string, keyof IlanTaslak][] = [
  ['city', 'il'], ['district', 'ilce'], ['neighborhood', 'mahalle'], ['rooms', 'odaSayisi'], ['floor', 'kat'], ['heating', 'isitma'],
  ['zoning', 'imarDurumu'], ['deed', 'tapuDurumu'], ['parcel', 'adaParsel'], ['brand', 'marka'], ['model', 'model'], ['fuel', 'yakit'], ['gear', 'vites'], ['description', 'aciklama'],
];
const SAYI_ESLEME: [string, keyof IlanTaslak][] = [
  ['grossM2', 'brutM2'], ['netM2', 'netM2'], ['bathrooms', 'banyoSayisi'], ['buildingAge', 'binaYasi'], ['modelYear', 'modelYili'], ['km', 'km'],
];

const metin = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const sayi = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/** "Esenyurt" → "Esenyurt'ta", "Bahçelievler" → "Bahçelievler'de" (bulunma eki, ünlü uyumu ve sert ünsüz) */
function bulunma(ad: string): string {
  const kucuk = ad.toLocaleLowerCase('tr-TR');
  const sesli = [...kucuk].reverse().find((c) => 'aeıioöuü'.includes(c)) ?? 'a';
  const son = kucuk.at(-1) ?? '';
  const d = 'fstkçşhp'.includes(son) ? 't' : 'd';
  return `${ad}'${d}${'aıou'.includes(sesli) ? 'a' : 'e'}`;
}

export function baslikOner(l: Record<string, unknown>): string {
  const tip = metin(l.type);
  const islem = l.deal === 'kiralik' ? 'Kiralık' : l.deal === 'satilik' ? 'Satılık' : '';
  if (tip === 'arac') return [islem, metin(l.brand), metin(l.model)].filter(Boolean).join(' ') || 'Araç';
  const mahalle = metin(l.neighborhood).replace(/\s+(Mahallesi|Mah\.?)$/i, '');
  const yer = [metin(l.district), mahalle].filter(Boolean);
  if (yer.length) yer[yer.length - 1] = bulunma(yer[yer.length - 1]);
  return [...yer, islem, TIP_ADI[tip] ?? ''].filter(Boolean).join(' ') || 'İlan';
}

export function basvurudanIlan(b: { listing: Record<string, unknown> }): IlanTaslak {
  const l = b.listing;
  const i: IlanTaslak = { baslik: baslikOner(l), kategori: KATEGORI[metin(l.type)] ?? 'diger' };
  if (l.deal === 'satilik' || l.deal === 'kiralik') i.tur = l.deal;
  const rec = i as unknown as Record<string, unknown>;
  for (const [k, hedef] of METIN_ESLEME) if (metin(l[k])) rec[hedef] = metin(l[k]);
  i.fiyat = sayi(l.price) ?? 0;
  for (const [k, hedef] of SAYI_ESLEME) if (sayi(l[k]) !== undefined) rec[hedef] = sayi(l[k]);
  const ozellikler = Array.isArray(l.features) ? l.features.map(metin).filter(Boolean) : [];
  if (l.furnished === true) ozellikler.push('Eşyalı');
  if (l.inSite === true) ozellikler.push('Site İçinde');
  if (ozellikler.length) i.ozellikler = ozellikler;
  // Açık adres (address) bilerek aktarılmaz: ilanda yayınlanmamalı
  return i;
}

