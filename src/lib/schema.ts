import { SITE } from '../config';
import type { Category, Currency, DealType, Listing, ListingStatus } from '../types';
import { CATEGORY_LABEL } from '../types';
import { slugify } from './format';

/**
 * public/data.json içindeki ilanları okur. Dosya elle düzenlendiği için alan adları Türkçedir;
 * eksik alanlar boş kabul edilir, yalnızca "baslik" zorunludur. Hatalı kayıtlar siteyi bozmaz,
 * atlanır ve tarayıcı konsoluna nedeni yazılır.
 */

const MAX_IMAGES = 10;
/** Fotoğraflar yalnızca public/img klasöründen okunur (dış adres veya ../ yolu kabul edilmez). */
const IMAGE_NAME_RE = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü][A-Za-z0-9ÇĞİÖŞÜçğıöşü ._-]*\.(jpe?g|png|webp|avif)$/i;

const DEALS: Record<string, DealType> = { satilik: 'satilik', 'satılık': 'satilik', kiralik: 'kiralik', 'kiralık': 'kiralik' };
const STATUSES: Record<string, ListingStatus> = {
  yayinda: 'yayinda',
  'yayında': 'yayinda',
  satildi: 'satildi',
  'satıldı': 'satildi',
  kiralandi: 'satildi',
  'kiralandı': 'satildi',
  gizli: 'taslak',
  taslak: 'taslak',
};

function str(v: unknown, max: number): string {
  if (typeof v === 'number') v = String(v);
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
}

/** Sayı ya da "8.000" / "8000" gibi yazılmış metni sayıya çevirir; boşsa null. */
function num(v: unknown, max = 1e12): number | null {
  if (typeof v === 'string') v = v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.'));
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  return v;
}

const key = (v: unknown) => str(v, 40).toLocaleLowerCase('tr-TR');

function date(v: unknown, fallback: string): string {
  const d = new Date(str(v, 40));
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export function parseIlan(raw: unknown, index: number): Listing | null {
  const where = `data.json → ${index + 1}. ilan`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn(`${where}: { ... } biçiminde olmalı, atlandı.`);
    return null;
  }
  const r = raw as Record<string, unknown>;
  const title = str(r.baslik, 140);
  if (!title) {
    console.warn(`${where}: "baslik" yazılmamış, atlandı.`);
    return null;
  }
  const category = key(r.kategori);
  if (category && !(category in CATEGORY_LABEL)) console.warn(`${where}: bilinmeyen kategori "${category}", "diger" sayıldı.`);
  const photos = Array.isArray(r.fotograflar) ? r.fotograflar.map((x) => str(x, 120)) : [];
  const badPhotos = photos.filter((p) => !IMAGE_NAME_RE.test(p));
  if (badPhotos.length) console.warn(`${where}: geçersiz fotoğraf adı atlandı: ${badPhotos.join(', ')}`);
  const created = date(r.tarih, '');
  const code = str(r.ilanNo, 20);
  const slug = slugify(str(r.baglanti, 90) || title);

  return {
    id: code || slug || `ilan-${index + 1}`,
    code,
    slug,
    title,
    dealType: DEALS[key(r.tur)] ?? 'satilik',
    category: (category in CATEGORY_LABEL ? category : category ? 'diger' : 'daire') as Category,
    categoryOther: category === 'diger' || (category && !(category in CATEGORY_LABEL)) ? str(r.kategoriAdi, 40) || str(r.kategori, 40) : '',
    price: num(r.fiyat) ?? 0,
    currency: (['TRY', 'USD', 'EUR'].includes(str(r.paraBirimi, 3).toUpperCase()) ? str(r.paraBirimi, 3).toUpperCase() : 'TRY') as Currency,
    city: str(r.il, 60) || SITE.city,
    district: str(r.ilce, 60),
    neighborhood: str(r.mahalle, 80),
    grossM2: num(r.brutM2, 1e7),
    netM2: num(r.netM2, 1e7),
    rooms: str(r.odaSayisi, 20),
    bathrooms: num(r.banyoSayisi, 50),
    floor: str(r.kat, 30),
    buildingAge: num(r.binaYasi, 300),
    heating: str(r.isitma, 40),
    zoning: str(r.imarDurumu, 40),
    deed: str(r.tapuDurumu, 40),
    parcel: str(r.adaParsel, 40),
    brand: str(r.marka, 40),
    model: str(r.model, 80),
    modelYear: num(r.modelYili, 2100),
    km: num(r.km, 1e7),
    fuel: str(r.yakit, 30),
    gear: str(r.vites, 30),
    color: str(r.renk, 30),
    features: Array.isArray(r.ozellikler) ? r.ozellikler.map((x) => str(x, 60)).filter(Boolean).slice(0, 40) : [],
    description: str(r.aciklama, 6000),
    images: photos.filter((p) => IMAGE_NAME_RE.test(p)).slice(0, MAX_IMAGES),
    status: STATUSES[key(r.durum)] ?? 'yayinda',
    featured: r.firsat === true,
    createdAt: created,
    updatedAt: created,
  };
}

/** Tüm dosyayı okur; aynı adrese (slug) düşen ilanlara -2, -3 eki verir. */
export function parseData(doc: unknown): Listing[] {
  const list = doc && typeof doc === 'object' && Array.isArray((doc as { ilanlar?: unknown }).ilanlar) ? (doc as { ilanlar: unknown[] }).ilanlar : null;
  if (!list) {
    console.warn('data.json: { "ilanlar": [ ... ] } biçiminde olmalı.');
    return [];
  }
  const seen = new Set<string>();
  return list
    .map(parseIlan)
    .filter((l): l is Listing => l !== null)
    .map((l) => {
      let slug = l.slug;
      for (let i = 2; seen.has(slug); i++) slug = `${l.slug}-${i}`;
      seen.add(slug);
      return slug === l.slug ? l : { ...l, slug, id: l.code || slug };
    });
}
