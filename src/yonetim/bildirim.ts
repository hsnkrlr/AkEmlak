/**
 * Bu cihazda yeni başvuru bildirimi (FCM web push). Token Firestore'da `yetkililer/{eposta}/cihazlar/{id}`
 * altında tutulur; sunucu yeni başvuruda bu cihazlara bildirim gönderir. iPhone'da yalnızca ana ekrana
 * eklenmiş uygulamada (iOS 16.4+) çalışır.
 */
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { USE_EMULATOR } from '../firebase/config';
import { db, yonetimApp } from './firebase';

export type BildirimDurumu = 'desteklenmiyor' | 'engelli' | 'kapali' | 'acik';
const ANAHTAR = 'ak.yonetim.cihaz';

const testToken = () => (USE_EMULATOR ? (window as Window & { __testToken?: string }).__testToken : undefined);

function okuKimlik(): string | null {
  try {
    return localStorage.getItem(ANAHTAR);
  } catch {
    return null;
  }
}

export function iphoneTarayicida(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function cihazAdi(ua = navigator.userAgent): string {
  const sistem = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Cihaz';
  const tarayici = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return `${sistem} ${tarayici}`.trim().slice(0, 80);
}

async function destekli(): Promise<boolean> {
  if (testToken()) return true;
  return 'serviceWorker' in navigator && 'Notification' in window && (await isSupported().catch(() => false));
}

export async function bildirimDurumu(email: string): Promise<BildirimDurumu> {
  if (!(await destekli())) return 'desteklenmiyor';
  if (!testToken() && Notification.permission === 'denied') return 'engelli';
  const id = okuKimlik();
  if (!id || (!testToken() && Notification.permission !== 'granted')) return 'kapali';
  const d = await getDoc(doc(db, 'yetkililer', email, 'cihazlar', id)).catch(() => null);
  return d?.exists() ? 'acik' : 'kapali';
}

async function kimlikOf(token: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

export async function bildirimAc(email: string): Promise<void> {
  let token = testToken();
  if (!token) {
    const izin = await Notification.requestPermission();
    if (izin !== 'granted') throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından bu site için bildirimlere izin verin.');
    const kayit = await navigator.serviceWorker.register('/yonetim/sw.js', { scope: '/yonetim/' });
    await navigator.serviceWorker.ready;
    token = await getToken(getMessaging(yonetimApp), { serviceWorkerRegistration: kayit });
  }
  if (!token) throw new Error('Bildirim kaydı alınamadı. Lütfen tekrar deneyin.');
  const id = await kimlikOf(token);
  await setDoc(doc(db, 'yetkililer', email, 'cihazlar', id), { token, eklendi: serverTimestamp(), cihaz: cihazAdi() });
  try {
    localStorage.setItem(ANAHTAR, id);
  } catch {
    /* depolama kapalı: bir sonraki açılışta "kapalı" görünür */
  }
}

export async function bildirimKapat(email: string): Promise<void> {
  const id = okuKimlik();
  if (!testToken()) await deleteToken(getMessaging(yonetimApp)).catch(() => undefined);
  if (id) await deleteDoc(doc(db, 'yetkililer', email, 'cihazlar', id));
  try {
    localStorage.removeItem(ANAHTAR);
  } catch {
    /* yok say */
  }
}
