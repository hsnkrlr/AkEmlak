export type DealType = 'satilik' | 'kiralik';
export type Category =
  | 'daire' | 'rezidans' | 'villa' | 'mustakil' | 'yazlik'
  | 'arsa' | 'tarla'
  | 'isyeri' | 'ofis' | 'depo'
  | 'otomobil' | 'arazi_suv' | 'motosiklet' | 'ticari' | 'is_makinesi'
  | 'diger';
export type CategoryGroup = 'konut' | 'arsa' | 'isyeri' | 'vasita' | 'diger';
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
  /** Vasıta alanları */
  brand: string;
  model: string;
  modelYear: number | null;
  km: number | null;
  fuel: string;
  gear: string;
  color: string;
  /** Kategori "Diğer" seçildiğinde yöneticinin yazdığı kategori adı (örn. Tekne) */
  categoryOther: string;
  features: string[];
  description: string;
  /** public/img klasöründeki fotoğraf dosya adları */
  images: string[];
  status: ListingStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEAL_LABEL: Record<DealType, string> = {
  satilik: 'Satılık',
  kiralik: 'Kiralık',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  daire: 'Daire',
  rezidans: 'Rezidans',
  villa: 'Villa',
  mustakil: 'Müstakil Ev',
  yazlik: 'Yazlık',
  arsa: 'Arsa',
  tarla: 'Tarla / Bağ / Bahçe',
  isyeri: 'Dükkan / Mağaza',
  ofis: 'Ofis / Büro',
  depo: 'Depo / Fabrika',
  otomobil: 'Otomobil',
  arazi_suv: 'Arazi / SUV / Pick-up',
  motosiklet: 'Motosiklet',
  ticari: 'Ticari Araç',
  is_makinesi: 'Traktör / İş Makinesi',
  diger: 'Diğer',
};

export const CATEGORY_GROUP: Record<Category, CategoryGroup> = {
  daire: 'konut',
  rezidans: 'konut',
  villa: 'konut',
  mustakil: 'konut',
  yazlik: 'konut',
  arsa: 'arsa',
  tarla: 'arsa',
  isyeri: 'isyeri',
  ofis: 'isyeri',
  depo: 'isyeri',
  otomobil: 'vasita',
  arazi_suv: 'vasita',
  motosiklet: 'vasita',
  ticari: 'vasita',
  is_makinesi: 'vasita',
  diger: 'diger',
};

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  konut: 'Konut',
  arsa: 'Arsa / Arazi',
  isyeri: 'İş Yeri',
  vasita: 'Vasıta',
  diger: 'Diğer',
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
