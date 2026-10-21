import { CATEGORY_GROUP, CATEGORY_LABEL, type CategoryGroup, type Listing } from '../types';

const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
};

export function slugify(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıiöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Fiyatı 0 girilen ilanlarda fiyat gösterilmez, müşteri iletişime yönlendirilir. */
export const PRICE_ON_REQUEST = 'Fiyat için arayın';

export function formatPrice(l: Pick<Listing, 'price' | 'currency' | 'dealType'>): string {
  if (l.price <= 0) return PRICE_ON_REQUEST;
  const s = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: l.currency,
    maximumFractionDigits: 0,
  }).format(l.price);
  return l.dealType === 'kiralik' ? `${s} / ay` : s;
}

export function formatLocation(l: Pick<Listing, 'neighborhood' | 'district' | 'city'>): string {
  const left = [l.neighborhood, l.district].filter(Boolean).join(', ');
  return [left, l.city].filter(Boolean).join(' / ');
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(ts: number | string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function soldLabel(l: Pick<Listing, 'dealType'>): string {
  return l.dealType === 'kiralik' ? 'Kiralandı' : 'Satıldı';
}

export function imageUrl(name: string, thumb = false): string {
  return `/data/img/${thumb ? thumbName(name) : name}`;
}

export function thumbName(name: string): string {
  return name.replace(/\.(\w+)$/, '.t.$1');
}

/** "Diğer" kategorisinde yöneticinin yazdığı adı gösterir. */
export function categoryLabel(l: Pick<Listing, 'category' | 'categoryOther'>): string {
  return l.category === 'diger' && l.categoryOther ? l.categoryOther : CATEGORY_LABEL[l.category];
}

export function groupOf(l: Pick<Listing, 'category'>): CategoryGroup {
  return CATEGORY_GROUP[l.category];
}

export const fmtInt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/** Kart ve WhatsApp mesajında gösterilen kısa özellikler (kategoriye göre). */
export function summaryFacts(l: Listing): string[] {
  const area = l.netM2 ?? l.grossM2;
  switch (groupOf(l)) {
    case 'vasita':
      return [l.modelYear ? String(l.modelYear) : '', l.km !== null ? `${fmtInt(l.km)} km` : '', l.fuel, l.gear].filter(Boolean).slice(0, 3);
    case 'konut':
      return [l.rooms, area ? `${fmtInt(area)} m²` : '', l.floor].filter(Boolean);
    case 'isyeri':
      return [area ? `${fmtInt(area)} m²` : '', l.floor].filter(Boolean);
    case 'arsa':
      return [l.grossM2 ? `${fmtInt(l.grossM2)} m²` : ''].filter(Boolean);
    default:
      return [area ? `${fmtInt(area)} m²` : ''].filter(Boolean);
  }
}

