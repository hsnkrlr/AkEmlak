import type { Listing } from '../types';

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

export function formatPrice(l: Pick<Listing, 'price' | 'currency' | 'dealType'>): string {
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
