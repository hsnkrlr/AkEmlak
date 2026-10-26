/**
 * Firebase web uygulaması ayarları. Bu değerler gizli değildir (tarayıcıya zaten gönderilir);
 * güvenlik Firebase güvenlik kuralları, App Check ve API anahtarı kısıtlamalarıyla sağlanır
 * (anahtar yalnızca ak-emlak.vercel.app ve localhost'tan, yalnızca formun kullandığı servislerle çalışır).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCVTJaSVTAtTuDrskTwCBU_EcGkOAT722I',
  authDomain: 'akemlak-ilan.firebaseapp.com',
  projectId: 'akemlak-ilan',
  storageBucket: 'akemlak-ilan.firebasestorage.app',
  messagingSenderId: '878235371312',
  appId: '1:878235371312:web:a6b48f50bcd128b2532af5',
};

/** App Check için reCAPTCHA Enterprise site anahtarı (bot koruması) */
export const RECAPTCHA_ENTERPRISE_SITE_KEY = '6LfWCQIuAAAAAOYq8PWwVD36Ts6QyStr7aA75DDB';

/** `VITE_FIREBASE_EMULATOR=1` ile yerel Firebase emülatörlerine bağlanılır (yalnızca geliştirme/test). */
export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export function isFirebaseConfigured(): boolean {
  return USE_EMULATOR || FIREBASE_CONFIG.apiKey !== '';
}
