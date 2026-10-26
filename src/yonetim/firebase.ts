/**
 * Yönetim uygulamasının Firebase bağlantısı. Ziyaretçi formunun anonim oturumuyla karışmaması için
 * ayrı bir uygulama örneği ("yonetim") kullanılır. Giriş Google ile ve yönlendirmeyle yapılır:
 * ana ekrana eklenmiş iPhone uygulamasında açılır pencere güvenilir değildir. Oturum sayfası
 * Vercel üzerinden aynı alan adına (/__/auth/) aktarıldığı için üçüncü taraf çerez kısıtlamalarına takılmaz.
 */
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  browserPopupRedirectResolver, connectAuthEmulator, getRedirectResult, GoogleAuthProvider, indexedDBLocalPersistence,
  initializeAuth, signInWithCredential, signInWithRedirect, signOut,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { FIREBASE_CONFIG, RECAPTCHA_ENTERPRISE_SITE_KEY, USE_EMULATOR } from '../firebase/config';

/** Canlı sitede giriş sayfası sitenin kendi alan adından açılır (vercel.json → /__/auth/) */
const SITE_HOST = 'ak-emlak.vercel.app';

const config = USE_EMULATOR
  ? { apiKey: 'demo-key', authDomain: '127.0.0.1', projectId: 'demo-akemlak', storageBucket: 'demo-akemlak.appspot.com', appId: 'demo-app', messagingSenderId: '0' }
  : { ...FIREBASE_CONFIG, authDomain: window.location.host === SITE_HOST ? SITE_HOST : FIREBASE_CONFIG.authDomain };

export const yonetimApp = initializeApp(config, 'yonetim');
if (!USE_EMULATOR && RECAPTCHA_ENTERPRISE_SITE_KEY) {
  initializeAppCheck(yonetimApp, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
export const auth = initializeAuth(yonetimApp, { persistence: indexedDBLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
export const db = getFirestore(yonetimApp);
export const storage = getStorage(yonetimApp);
export const functions = getFunctions(yonetimApp, 'europe-west3');

if (USE_EMULATOR) {
  // Yalnızca emülatör test derlemesi: sandbox'ta Google yönlendirme sayfası açılamadığı için sahte Google kimliğiyle giriş
  (window as Window & { __testGiris?: (email: string) => Promise<unknown> }).__testGiris = (email: string) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export async function girisYap(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(auth, provider);
}

/** Yönlendirmeden dönüşte oluşan giriş hatasını (varsa) döner */
export async function girisSonucu(): Promise<string | null> {
  try {
    await getRedirectResult(auth);
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    console.warn('Google girişi tamamlanamadı:', code || e);
    if (code === 'auth/unauthorized-domain') return 'Bu adres Google girişi için yetkilendirilmemiş.';
    if (code === 'auth/operation-not-allowed') return 'Google ile giriş henüz açılmamış (Firebase konsolu → Authentication).';
    if (code === 'auth/network-request-failed') return 'Bağlantı kurulamadı. İnternetinizi kontrol edin.';
    return 'Giriş yapılamadı. Lütfen tekrar deneyin.';
  }
}

export const cikisYap = () => signOut(auth);
