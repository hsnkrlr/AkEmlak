import type { Category, Currency, DealType, Listing, ListingStatus } from '../types';
import { CATEGORY_LABEL, DEAL_LABEL, STATUS_LABEL } from '../types';
import { LIMITS } from '../config';

/** Görsel adları içerik özetidir; yol (../) veya dış adres içeremez. */
export const IMAGE_NAME_RE = /^[a-f0-9]{64}\.(webp|jpg|png)$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
}

function num(v: unknown, max = 1e12): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  return v;
}

function oneOf<T extends string>(v: unknown, allowed: Record<T, string>, fallback: T): T {
  return typeof v === 'string' && v in allowed ? (v as T) : fallback;
}

/**
 * Dışarıdan gelen (yayındaki JSON, içe aktarılan dosya) her ilanı katı biçimde doğrular.
 * Beklenmeyen alanlar atılır, metinler kısaltılır; şüpheli kayıtlar tamamen reddedilir.
 */
export function sanitizeListing(raw: unknown): Listing | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 64);
  const slug = str(r.slug, 90);
  const title = str(r.title, 140);
  const price = num(r.price);
  if (!id || !SLUG_RE.test(slug) || !title || price === null) return null;

  const images = Array.isArray(r.images)
    ? r.images.filter((x): x is string => typeof x === 'string' && IMAGE_NAME_RE.test(x)).slice(0, LIMITS.maxImagesPerListing)
    : [];
  const features = Array.isArray(r.features)
    ? r.features.map((x) => str(x, 60)).filter(Boolean).slice(0, 40)
    : [];

  return {
    id,
    code: str(r.code, 20),
    slug,
    title,
    dealType: oneOf<DealType>(r.dealType, DEAL_LABEL, 'satilik'),
    category: oneOf<Category>(r.category, CATEGORY_LABEL, 'daire'),
    price,
    currency: oneOf<Currency>(r.currency, { TRY: '', USD: '', EUR: '' }, 'TRY'),
    city: str(r.city, 60),
    district: str(r.district, 60),
    neighborhood: str(r.neighborhood, 80),
    grossM2: num(r.grossM2, 1e7),
    netM2: num(r.netM2, 1e7),
    rooms: str(r.rooms, 20),
    bathrooms: num(r.bathrooms, 50),
    floor: str(r.floor, 30),
    buildingAge: num(r.buildingAge, 300),
    heating: str(r.heating, 40),
    brand: str(r.brand, 40),
    model: str(r.model, 80),
    modelYear: num(r.modelYear, 2100),
    km: num(r.km, 1e7),
    fuel: str(r.fuel, 30),
    gear: str(r.gear, 30),
    color: str(r.color, 30),
    categoryOther: str(r.categoryOther, 40),
    features,
    description: str(r.description, 6000),
    images,
    status: oneOf<ListingStatus>(r.status, STATUS_LABEL, 'taslak'),
    featured: r.featured === true,
    createdAt: str(r.createdAt, 40),
    updatedAt: str(r.updatedAt, 40),
  };
}
