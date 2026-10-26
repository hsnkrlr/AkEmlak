/**
 * Firebase web uygulaması ayarları. Bu değerler gizli değildir (tarayıcıya zaten gönderilir);
 * güvenlik Firebase güvenlik kuralları, App Check ve API anahtarı kısıtlamalarıyla sağlanır.
 * Proje kurulumunda doldurulur.
 */
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** App Check için reCAPTCHA Enterprise site anahtarı (bot koruması) */
export const RECAPTCHA_ENTERPRISE_SITE_KEY = '';

/** `VITE_FIREBASE_EMULATOR=1` ile yerel Firebase emülatörlerine bağlanılır (yalnızca geliştirme/test). */
export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export function isFirebaseConfigured(): boolean {
  return USE_EMULATOR || FIREBASE_CONFIG.apiKey !== '';
}
