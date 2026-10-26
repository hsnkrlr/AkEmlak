/**
 * İlan başvuru formu: alanlar, bağlantı parametreleriyle doldurma, doğrulama, cihazdaki geçmiş ve fotoğraf işleme.
 */
import type { ApplicationPayload } from '../firebase/client';

export type ApplyType = 'daire' | 'mustakil' | 'villa' | 'arsa' | 'tarla' | 'isyeri' | 'arac' | 'diger';
export type FieldKey =
  | 'rooms' | 'grossM2' | 'netM2' | 'floor' | 'buildingAge' | 'bathrooms' | 'heating' | 'furnished' | 'inSite'
  | 'zoning' | 'deed' | 'parcel' | 'brand' | 'model' | 'modelYear' | 'km' | 'fuel' | 'gear';

export const KVKK_VERSION = '2026-10';
export const MAX_PHOTOS = 10;

export const TYPES: { key: ApplyType; label: string }[] = [
  { key: 'daire', label: 'Daire' },
  { key: 'mustakil', label: 'Müstakil Ev' },
  { key: 'villa', label: 'Villa' },
  { key: 'arsa', label: 'Arsa' },
  { key: 'tarla', label: 'Tarla / Bahçe' },
  { key: 'isyeri', label: 'Dükkan / İş Yeri' },
  { key: 'arac', label: 'Araç' },
  { key: 'diger', label: 'Diğer' },
];

export const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.key, t.label])) as Record<ApplyType, string>;

/** Her ilan tipinde sorulan (hepsi isteğe bağlı) alanlar */
export const FIELDS_BY_TYPE: Record<ApplyType, FieldKey[]> = {
  daire: ['rooms', 'grossM2', 'netM2', 'floor', 'buildingAge', 'bathrooms', 'heating', 'furnished', 'inSite'],
  mustakil: ['rooms', 'grossM2', 'netM2', 'buildingAge', 'bathrooms', 'heating', 'furnished'],
  villa: ['rooms', 'grossM2', 'netM2', 'buildingAge', 'bathrooms', 'heating', 'furnished', 'inSite'],
  arsa: ['grossM2', 'zoning', 'deed', 'parcel'],
  tarla: ['grossM2', 'deed', 'parcel'],
  isyeri: ['grossM2', 'netM2', 'floor', 'buildingAge', 'heating'],
  arac: ['brand', 'model', 'modelYear', 'km', 'fuel', 'gear'],
  diger: [],
};

export const FEATURE_SUGGESTIONS: Record<ApplyType, string[]> = {
  daire: ['Asansör', 'Otopark', 'Balkon', 'Doğalgaz', 'Ankastre Mutfak', 'Krediye Uygun'],
  mustakil: ['Bahçe', 'Otopark', 'Doğalgaz', 'Kuyu', 'Camiye Yakın', 'Krediye Uygun'],
  villa: ['Havuz', 'Bahçe', 'Kapalı Otopark', 'Güvenlik', 'Krediye Uygun'],
  arsa: ['Yola Cephe', 'Elektrik', 'Su', 'Köşe Parsel'],
  tarla: ['Fıstık Ağaçları', 'Zeytin Ağaçları', 'Su / Kuyu', 'Elektrik', 'Yola Cephe'],
  isyeri: ['Cadde Üzeri', 'Vitrinli', 'Depolu', 'Kiracılı'],
  arac: ['Hasar Kayıtsız', 'Boyasız', 'Servis Bakımlı', 'Takasa Uygun'],
  diger: [],
};

export const OPTIONS = {
  rooms: ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1', '6+'],
  floor: ['Bodrum', 'Zemin', 'Bahçe Katı', '1', '2', '3', '4', '5', '6+', 'Çatı'],
  heating: ['Doğalgaz Kombi', 'Merkezi', 'Yerden Isıtma', 'Klima', 'Soba', 'Yok'],
  zoning: ['Konut', 'Ticari', 'Tarla', 'Bilmiyorum'],
  deed: ['Müstakil Tapu', 'Hisseli Tapu', 'Kat Mülkiyeti', 'Kat İrtifakı'],
  fuel: ['Benzin', 'Dizel', 'LPG & Benzin', 'Hibrit', 'Elektrik'],
  gear: ['Manuel', 'Otomatik'],
} as const;

export interface ApplyForm {
  type: ApplyType | '';
  deal: '' | 'satilik' | 'kiralik';
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  price: string;
  grossM2: string;
  netM2: string;
  rooms: string;
  floor: string;
  buildingAge: string;
  bathrooms: string;
  heating: string;
  furnished: '' | 'evet' | 'hayir';
  inSite: '' | 'evet' | 'hayir';
  zoning: string;
  deed: string;
  parcel: string;
  brand: string;
  model: string;
  modelYear: string;
  km: string;
  fuel: string;
  gear: string;
  features: string[];
  description: string;
  name: string;
  /** Yalnızca 10 hane: 5XXXXXXXXX */
  phone: string;
  email: string;
}

export const EMPTY_FORM: ApplyForm = {
  type: '', deal: '', city: 'Gaziantep', district: '', neighborhood: '', address: '', price: '',
  grossM2: '', netM2: '', rooms: '', floor: '', buildingAge: '', bathrooms: '', heating: '', furnished: '', inSite: '',
  zoning: '', deed: '', parcel: '', brand: '', model: '', modelYear: '', km: '', fuel: '', gear: '',
  features: [], description: '', name: '', phone: '', email: '',
};

/* ------------------------------------------------------------------ */
/* Telefon                                                             */
/* ------------------------------------------------------------------ */

/** "0532 123 45 67", "+90 532...", "532..." → "5321234567" (en fazla 10 hane) */
export function phoneDigits(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

/** "5321234567" → "532 123 45 67" */
export function formatPhone(d: string): string {
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return p.join(' ');
}

export const isValidPhone = (d: string) => /^5\d{9}$/.test(d);

/* ------------------------------------------------------------------ */
/* Bağlantı parametreleriyle doldurma: /ilan-basvurusu?tip=daire&city=gaziantep&ilce=nurdagi */
/* ------------------------------------------------------------------ */

const PARAM_ALIASES: Record<string, keyof ApplyForm> = {
  tip: 'type', type: 'type', kategori: 'type', category: 'type',
  tur: 'deal', deal: 'deal', islem: 'deal',
  il: 'city', city: 'city', sehir: 'city',
  ilce: 'district', district: 'district',
  mahalle: 'neighborhood', neighborhood: 'neighborhood',
  adres: 'address', address: 'address',
  fiyat: 'price', price: 'price',
  oda: 'rooms', rooms: 'rooms',
  m2: 'grossM2', brut: 'grossM2', alan: 'grossM2', net: 'netM2',
  kat: 'floor', floor: 'floor',
  ad: 'name', name: 'name', adsoyad: 'name',
  telefon: 'phone', tel: 'phone', phone: 'phone',
  eposta: 'email', email: 'email',
  aciklama: 'description', description: 'description',
  yas: 'buildingAge', binayasi: 'buildingAge', banyo: 'bathrooms', isitma: 'heating',
  esyali: 'furnished', site: 'inSite', imar: 'zoning', tapu: 'deed', parsel: 'parcel', adaparsel: 'parcel',
  marka: 'brand', model: 'model', yil: 'modelYear', km: 'km', yakit: 'fuel', vites: 'gear',
  ozellik: 'features', ozellikler: 'features',
};

/** Form değiştikçe adres çubuğuna yazılan parametre adları (okurken yukarıdaki eş anlamlılar da kabul edilir) */
const PARAM_NAMES: Partial<Record<keyof ApplyForm, string>> = {
  type: 'tip', deal: 'tur', city: 'il', district: 'ilce', neighborhood: 'mahalle', address: 'adres', price: 'fiyat',
  rooms: 'oda', grossM2: 'm2', netM2: 'net', floor: 'kat', buildingAge: 'yas', bathrooms: 'banyo', heating: 'isitma',
  furnished: 'esyali', inSite: 'site', zoning: 'imar', deed: 'tapu', parcel: 'parsel',
  brand: 'marka', model: 'model', modelYear: 'yil', km: 'km', fuel: 'yakit', gear: 'vites',
  features: 'ozellik', description: 'aciklama',
};
const COMMON_PARAM_FIELDS: (keyof ApplyForm)[] = ['type', 'deal', 'city', 'district', 'neighborhood', 'address', 'price', 'features', 'description'];

/**
 * Formun güncel hâlini bağlantı parametresine çevirir: "?tip=mustakil&tur=kiralik&ilce=Nurdağı".
 * Kişisel iletişim bilgileri (ad, telefon, e-posta) adrese yazılmaz: bağlantı paylaşıldığında
 * ya da tarayıcı geçmişinde/Analytics'te görünmesinler. Yalnızca seçili tipe ait, doldurulmuş alanlar yazılır.
 */
export function formToParams(form: ApplyForm): string {
  const params = new URLSearchParams();
  const fields = [...COMMON_PARAM_FIELDS, ...(form.type ? FIELDS_BY_TYPE[form.type] : [])];
  for (const key of fields) {
    const name = PARAM_NAMES[key];
    const value = key === 'features' ? form.features.join(',') : String(form[key]).trim();
    if (name && value && value !== EMPTY_FORM[key]) params.set(name, value);
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

const TYPE_ALIASES: Record<string, ApplyType> = {
  daire: 'daire', apartman: 'daire', mustakil: 'mustakil', 'müstakil': 'mustakil', ev: 'mustakil', villa: 'villa',
  arsa: 'arsa', tarla: 'tarla', bahce: 'tarla', 'bahçe': 'tarla', bag: 'tarla', isyeri: 'isyeri', 'işyeri': 'isyeri',
  dukkan: 'isyeri', 'dükkan': 'isyeri', ofis: 'isyeri', arac: 'arac', 'araç': 'arac', otomobil: 'arac', diger: 'diger', 'diğer': 'diger',
};

const titleCase = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ');

/** Bilinmeyen parametreler yok sayılır; değerler kısaltılır, sayılar temizlenir. */
export function formFromParams(search: string, base: ApplyForm = EMPTY_FORM): ApplyForm {
  const params = new URLSearchParams(search);
  const form: ApplyForm = { ...base, features: [...base.features] };
  params.forEach((raw, k) => {
    const key = PARAM_ALIASES[k.toLocaleLowerCase('tr-TR')];
    const value = raw.trim().slice(0, key === 'description' ? 3000 : 300);
    if (!key || !value) return;
    switch (key) {
      case 'type': {
        const t = TYPE_ALIASES[value.toLocaleLowerCase('tr-TR').replace(/[\s_-]/g, '')];
        if (t) form.type = t;
        break;
      }
      case 'deal': {
        const v = value.toLocaleLowerCase('tr-TR');
        if (v.startsWith('sat')) form.deal = 'satilik';
        if (v.startsWith('kira')) form.deal = 'kiralik';
        break;
      }
      case 'city':
      case 'district':
      case 'neighborhood':
        form[key] = titleCase(value).slice(0, 80);
        break;
      case 'price':
      case 'grossM2':
      case 'netM2':
        form[key] = value.replace(/\D/g, '').slice(0, 12);
        break;
      case 'buildingAge':
      case 'bathrooms':
      case 'modelYear':
      case 'km':
        form[key] = value.replace(/\D/g, '').slice(0, 9);
        break;
      case 'furnished':
      case 'inSite': {
        const v = value.toLocaleLowerCase('tr-TR');
        if (v.startsWith('e') || v === '1' || v === 'var') form[key] = 'evet';
        if (v.startsWith('h') || v === '0' || v === 'yok') form[key] = 'hayir';
        break;
      }
      case 'phone':
        form.phone = phoneDigits(value);
        break;
      case 'features':
        form.features = [...new Set(value.split(',').map((f) => f.trim().slice(0, 60)).filter(Boolean))].slice(0, 20);
        break;
      default:
        (form[key] as string) = value.slice(0, key === 'description' ? 3000 : 120);
    }
  });
  return form;
}

/* ------------------------------------------------------------------ */
/* Doğrulama ve gönderilecek veri                                      */
/* ------------------------------------------------------------------ */

export type Errors = Partial<Record<'type' | 'name' | 'phone' | 'email' | 'kvkk', string>>;

export function validate(form: ApplyForm, kvkk: boolean): Errors {
  const e: Errors = {};
  if (!form.type) e.type = 'Lütfen ilan tipini seçin.';
  if (form.name.trim().split(/\s+/).filter(Boolean).length < 2 || form.name.trim().length < 3) e.name = 'Lütfen adınızı ve soyadınızı yazın.';
  if (!isValidPhone(form.phone)) e.phone = 'Lütfen 5 ile başlayan 10 haneli cep numaranızı yazın.';
  if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'E-posta adresi geçersiz görünüyor.';
  if (!kvkk) e.kvkk = 'Devam etmek için aydınlatma metnini onaylayın.';
  return e;
}

const num = (s: string): number | undefined => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const text = (s: string, max: number) => s.trim().slice(0, max) || undefined;
const yesNo = (v: '' | 'evet' | 'hayir') => (v === '' ? undefined : v === 'evet');

/** Yalnızca doldurulmuş ve seçilen tipe ait alanlar gönderilir. */
export function buildListing(form: ApplyForm): Record<string, unknown> {
  const type = form.type as ApplyType;
  const allowed = new Set<string>(FIELDS_BY_TYPE[type]);
  const all: Record<string, unknown> = {
    type,
    deal: form.deal || undefined,
    city: text(form.city, 60),
    district: text(form.district, 60),
    neighborhood: text(form.neighborhood, 80),
    address: text(form.address, 300),
    price: num(form.price),
    description: text(form.description, 3000),
    features: form.features.length ? form.features.slice(0, 20).map((f) => f.slice(0, 60)) : undefined,
  };
  const specific: Record<FieldKey, unknown> = {
    rooms: text(form.rooms, 20),
    grossM2: num(form.grossM2),
    netM2: num(form.netM2),
    floor: text(form.floor, 30),
    buildingAge: num(form.buildingAge),
    bathrooms: num(form.bathrooms),
    heating: text(form.heating, 40),
    furnished: yesNo(form.furnished),
    inSite: yesNo(form.inSite),
    zoning: text(form.zoning, 40),
    deed: text(form.deed, 40),
    parcel: text(form.parcel, 60),
    brand: text(form.brand, 40),
    model: text(form.model, 80),
    modelYear: num(form.modelYear),
    km: num(form.km),
    fuel: text(form.fuel, 30),
    gear: text(form.gear, 30),
  };
  for (const [k, v] of Object.entries(specific)) if (allowed.has(k)) all[k] = v;
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined));
}

export function buildSeller(form: ApplyForm): ApplicationPayload['seller'] {
  const email = form.email.trim();
  return { name: form.name.trim().replace(/\s+/g, ' ').slice(0, 80), phone: `+90${form.phone}`, ...(email ? { email } : {}) };
}

/* ------------------------------------------------------------------ */
/* Cihazdaki başvuru geçmişi                                           */
/* ------------------------------------------------------------------ */

export interface StoredPhoto {
  path: string;
  thumb: string;
}

export interface StoredApplication {
  id: string;
  number: string;
  submittedAt: string;
  form: ApplyForm;
  photos: StoredPhoto[];
  resubmission: ApplicationPayload['resubmission'];
}

const HISTORY_KEY = 'ak.basvurular';

export function loadHistory(): StoredApplication[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(list) ? (list as StoredApplication[]) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(app: StoredApplication): void {
  const list = [app, ...loadHistory()].slice(0, 30);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Depolama doluysa küçük resimler olmadan kaydet
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.map((a) => ({ ...a, photos: a.photos.map((p) => ({ ...p, thumb: '' })) }))));
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* yok say */
  }
}

/* ------------------------------------------------------------------ */
/* Fotoğraf: doğrula, küçült (konum/EXIF bilgisi silinir), önizleme üret */
/* ------------------------------------------------------------------ */

export interface PreparedPhoto {
  blob: Blob;
  ext: 'webp' | 'jpg';
  thumb: string;
}

function sniff(b: Uint8Array): boolean {
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
  const heic = String.fromCharCode(...b.slice(4, 12)).startsWith('ftyp');
  return jpeg || png || webp || heic;
}

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * s));
  c.height = Math.max(1, Math.round(bitmap.height * s));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > 25 * 1024 * 1024) throw new Error(`"${file.name}" çok büyük (en fazla 25 MB).`);
  if (!sniff(new Uint8Array(await file.slice(0, 16).arrayBuffer()))) throw new Error(`"${file.name}" bir fotoğraf dosyası değil.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${file.name}" açılamadı. Fotoğrafı JPG olarak tekrar deneyin.`);
  }
  try {
    const big = draw(bitmap, 1600);
    let blob = await toBlob(big, 'image/webp', 0.82);
    let ext: 'webp' | 'jpg' = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(big, 'image/jpeg', 0.84);
      ext = 'jpg';
    }
    if (!blob) throw new Error(`"${file.name}" işlenemedi.`);
    const thumb = draw(bitmap, 240).toDataURL('image/jpeg', 0.6);
    return { blob, ext, thumb };
  } finally {
    bitmap.close();
  }
}
