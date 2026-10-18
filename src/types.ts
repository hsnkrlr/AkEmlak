export type DealType = 'satilik' | 'kiralik';
export type Category = 'daire' | 'villa' | 'mustakil' | 'arsa' | 'isyeri' | 'tarla';
export type ListingStatus = 'yayinda' | 'taslak' | 'satildi';
export type Currency = 'TRY' | 'USD' | 'EUR';

export interface Listing {
  id: string;
  /** Müşteriye gösterilen ilan numarası, örn. AK-10001 */
  code: string;
  slug: string;
  title: string;
  dealType: DealType;
  category: Category;
  price: number;
  currency: Currency;
  city: string;
  district: string;
  neighborhood: string;
  grossM2: number | null;
  netM2: number | null;
  rooms: string;
  bathrooms: number | null;
  floor: string;
  buildingAge: number | null;
  heating: string;
  features: string[];
  description: string;
  /** Görsel dosya adları: <sha256>.<uzantı> */
  images: string[];
  status: ListingStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedPayload {
  version: 1;
  publishedAt: string;
  listings: Listing[];
}

export interface SignedDocument {
  format: 'akemlak-signed-v1';
  alg: 'ES256';
  payload: string;
  signature: string;
}

export const DEAL_LABEL: Record<DealType, string> = {
  satilik: 'Satılık',
  kiralik: 'Kiralık',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  daire: 'Daire',
  villa: 'Villa',
  mustakil: 'Müstakil Ev',
  arsa: 'Arsa',
  isyeri: 'İş Yeri',
  tarla: 'Tarla / Bahçe',
};

export const STATUS_LABEL: Record<ListingStatus, string> = {
  yayinda: 'Yayında',
  taslak: 'Taslak (gizli)',
  satildi: 'Satıldı / Kiralandı',
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  TRY: '₺ TL',
  USD: '$ USD',
  EUR: '€ EUR',
};
