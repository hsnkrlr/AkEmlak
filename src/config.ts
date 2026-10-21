/**
 * İşletme bilgileri. WhatsApp numarası bilerek ilan dosyasında (public/data.json) değil kodda tutulur;
 * böylece tüm ilanlar her zaman resmi numaraya yönlendirir.
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

export function siteOrigin(): string {
  return (SITE.siteUrl || window.location.origin).replace(/\/+$/, '');
}
