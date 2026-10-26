/**
 * Başvuru gönderimi: anonim oturum → fotoğrafları kendi klasörüne yükle → başvuruyu tek yazımda kaydet.
 * Bu modül yalnızca /ilan-basvurusu sayfasında yüklenir; ana sayfanın boyutunu etkilemez.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, indexedDBLocalPersistence, initializeAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getFirestore, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { FIREBASE_CONFIG, RECAPTCHA_ENTERPRISE_SITE_KEY, USE_EMULATOR } from './config';

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let services: Services | null = null;

function init(): Services {
  if (services) return services;
  const config = USE_EMULATOR
    ? { apiKey: 'demo-key', projectId: 'demo-akemlak', storageBucket: 'demo-akemlak.appspot.com', appId: 'demo-app' }
    : FIREBASE_CONFIG;
  const app = initializeApp(config);
  if (!USE_EMULATOR && RECAPTCHA_ENTERPRISE_SITE_KEY) {
    // Bot koruması: istekler yalnızca bu siteden ve gerçek tarayıcıdan geldiğinde kabul edilir
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
  }
  // Açılır pencere/yönlendirme girişleri kullanılmadığı için sade kurulum (ek iframe yüklenmez)
  const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
  const db = getFirestore(app);
  const storage = getStorage(app);
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  services = { app, auth, db, storage };
  return services;
}

async function currentUid(): Promise<string> {
  const { auth } = init();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  return (await signInAnonymously(auth)).user.uid;
}

export interface UploadablePhoto {
  blob: Blob;
  ext: 'webp' | 'jpg';
}

function randomId(len = 24): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => abc[b % abc.length]).join('');
}

/** Okunması kolay başvuru numarası (karışan harfler yok): B-7K2Q9X */
export function newApplicationNumber(): string {
  const abc = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  return 'B-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => abc[b % abc.length]).join('');
}

export async function uploadPhoto(photo: UploadablePhoto): Promise<string> {
  const uid = await currentUid();
  const path = `basvurular/${uid}/${randomId()}.${photo.ext}`;
  await uploadBytes(ref(init().storage, path), photo.blob, { contentType: photo.ext === 'webp' ? 'image/webp' : 'image/jpeg' });
  return path;
}

export interface ApplicationPayload {
  number: string;
  seller: { name: string; phone: string; email?: string };
  listing: Record<string, unknown>;
  photos: string[];
  resubmission: { isResubmission: boolean; of: string | null; original: string | null; revision: number };
  consent: { kvkk: true; version: string };
}

export class RateLimitError extends Error {}

export async function submitApplication(p: ApplicationPayload): Promise<string> {
  const uid = await currentUid();
  const { db } = init();
  const appRef = doc(collection(db, 'basvurular'));
  const batch = writeBatch(db);
  // Hız sınırı kaydı ve başvuru aynı yazımda: kurallar ikisini birlikte doğrular
  batch.set(doc(db, 'limits', uid), { lastAt: serverTimestamp() });
  batch.set(appRef, { ...p, uid, status: 'yeni', createdAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') throw new RateLimitError();
    throw e;
  }
  return appRef.id;
}
