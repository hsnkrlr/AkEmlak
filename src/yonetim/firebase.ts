/**
 * Yönetim uygulamasının Firebase bağlantısı. Ziyaretçi formunun anonim oturumuyla karışmaması için
 * ayrı bir uygulama örneği ("yonetim") kullanılır. Giriş Google'ın açılır penceresiyle yapılır (Firebase'in
 * üçüncü taraf çerez kısıtlamalarına karşı önerdiği yol); pencere açılamazsa yönlendirmeye düşülür.
 * Giriş sayfası Firebase'in kendi adresindedir (akemlak-ilan.firebaseapp.com).
 */
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  browserPopupRedirectResolver, connectAuthEmulator, getRedirectResult, GoogleAuthProvider, indexedDBLocalPersistence,
  initializeAuth, signInWithCredential, signInWithPopup, signInWithRedirect, signOut,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { FIREBASE_CONFIG, RECAPTCHA_ENTERPRISE_SITE_KEY, USE_EMULATOR } from '../firebase/config';
import { girisHataMetni } from './hata';

const config = USE_EMULATOR
  ? { apiKey: 'demo-key', authDomain: '127.0.0.1', projectId: 'demo-akemlak', storageBucket: 'demo-akemlak.appspot.com', appId: 'demo-app', messagingSenderId: '0' }
  : FIREBASE_CONFIG;

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
  (window as Window & { __testGiris?: (email: string, dogrulanmis?: boolean) => Promise<unknown> }).__testGiris = (email: string, dogrulanmis = true) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: `${email}-${dogrulanmis}`, email, email_verified: dogrulanmis })));
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

/** Giriş başlatır; hata (kullanıcı pencereyi kapattıysa null) döner */
export async function girisYap(): Promise<string | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    // Açılır pencere engellendiyse ya da bu ortamda desteklenmiyorsa yönlendirmeyle dene
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    console.warn('Google girişi tamamlanamadı:', code || e);
    return girisHataMetni(code);
  }
}

/** Yönlendirmeyle girişten dönüşte oluşan hatayı (varsa) döner */
export async function girisSonucu(): Promise<string | null> {
  try {
    await getRedirectResult(auth);
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    console.warn('Google girişi tamamlanamadı:', code || e);
    return girisHataMetni(code);
  }
}

export const cikisYap = () => signOut(auth);
