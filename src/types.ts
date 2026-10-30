export type DealType = 'satilik' | 'kiralik';
export type Category =
  | 'daire' | 'rezidans' | 'villa' | 'mustakil' | 'dubleks' | 'yazlik' | 'ciftlik_evi' | 'prefabrik'
  | 'arsa' | 'tarla' | 'bag_bahce' | 'fistiklik' | 'zeytinlik' | 'ciftlik'
  | 'isyeri' | 'ofis' | 'depo' | 'imalathane' | 'ahir'
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
  /** Arsa / tarla alanları */
  zoning: string;
  deed: string;
  parcel: string;
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
  dubleks: 'Dubleks / Tripleks',
  yazlik: 'Yazlık / Yayla Evi',
  ciftlik_evi: 'Köy / Çiftlik Evi',
  prefabrik: 'Prefabrik / Konteyner Ev',
  arsa: 'Arsa',
  tarla: 'Tarla',
  bag_bahce: 'Bağ / Bahçe',
  fistiklik: 'Fıstık Bahçesi',
  zeytinlik: 'Zeytinlik',
  ciftlik: 'Çiftlik',
  isyeri: 'Dükkan / Mağaza',
  ofis: 'Ofis / Büro',
  depo: 'Depo / Fabrika',
  imalathane: 'İmalathane / Atölye',
  ahir: 'Ahır / Besi Çiftliği',
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
  dubleks: 'konut',
  yazlik: 'konut',
  ciftlik_evi: 'konut',
  prefabrik: 'konut',
  arsa: 'arsa',
  tarla: 'arsa',
  bag_bahce: 'arsa',
  fistiklik: 'arsa',
  zeytinlik: 'arsa',
  ciftlik: 'arsa',
  isyeri: 'isyeri',
  ofis: 'isyeri',
  depo: 'isyeri',
  imalathane: 'isyeri',
  ahir: 'isyeri',
  otomobil: 'vasita',
  arazi_suv: 'vasita',
  motosiklet: 'vasita',
  ticari: 'vasita',
  is_makinesi: 'vasita',
  diger: 'diger',
};

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  konut: 'Konut',
  arsa: 'Arsa / Tarla / Bahçe',
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
