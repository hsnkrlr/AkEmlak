/**
 * İşletme bilgileri. WhatsApp numarası bilerek veri dosyasında değil kodda tutulur:
 * listings.json ele geçirilse bile müşteriler sahte bir numaraya yönlendirilemez.
 */
export const SITE = {
  name: 'Ak Emlak',
  slogan: 'Güvenilir adres, doğru yatırım',
  /** Ülke koduyla, başında + veya 0 olmadan. Örn: 905321234567 */
  whatsappNumber: '905423285554',
  /** Sitede gösterilen biçim */
  phoneDisplay: '0542 328 55 54',
  city: 'Gaziantep',
  workingHours: 'Her gün 09:00 – 20:00',
  /** Boş bırakılırsa tarayıcıdaki alan adı kullanılır */
  siteUrl: '',
} as const;

/**
 * Yayınla düğmesi ilanları bu GitHub reposuna kaydeder; Vercel değişikliği görüp siteyi
 * otomatik günceller. `branch` boşsa reponun varsayılan dalı kullanılır.
 */
export const GITHUB = {
  owner: 'hsnkrlr',
  repo: 'AkEmlak',
  branch: '',
  dataDir: 'public/data',
} as const;

export const LIMITS = {
  maxImagesPerListing: 10,
  maxImageInputBytes: 15 * 1024 * 1024,
  imageMaxSide: 1600,
  thumbMaxSide: 640,
} as const;

export const AUTH_POLICY = {
  sessionMs: 15 * 60 * 1000,
  failWindowMs: 10 * 60 * 1000,
  maxFails: 3,
} as const;

export function isWhatsappConfigured(): boolean {
  return /^[1-9]\d{9,14}$/.test(SITE.whatsappNumber) && !/^90500000000/.test(SITE.whatsappNumber);
}

export function siteOrigin(): string {
  return (SITE.siteUrl || window.location.origin).replace(/\/+$/, '');
}
