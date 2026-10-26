import { useEffect, useState } from 'react';

/**
 * Çerez / cihaz depolama onayı.
 * - Zorunlu: başvuru formunun çalışması (onay kaydı, başvuru geçmişi, Firebase oturumu). Form bunsuz kullanılamaz.
 * - Analitik: Google Analytics. İsteğe bağlıdır; reddedilse de site ve form çalışır.
 */
export interface Consent {
  v: 1;
  necessary: true;
  analytics: boolean;
  at: string;
}

const KEY = 'ak.consent';
const EVENT = 'ak-consent-change';

declare global {
  interface Window {
    akAnalytics?: { enable: () => void; disable: () => void };
  }
}

export function getConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Consent | null;
    return c && c.v === 1 && c.necessary === true ? c : null;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean): void {
  const c: Consent = { v: 1, necessary: true, analytics, at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* gizli sekme vb. */
  }
  if (analytics) window.akAnalytics?.enable();
  else window.akAnalytics?.disable();
  window.dispatchEvent(new Event(EVENT));
}

/** Tercihleri yeniden sormak için onayı sıfırlar (bant tekrar görünür). */
export function resetConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yok say */
  }
  window.akAnalytics?.disable();
  window.dispatchEvent(new Event(EVENT));
}

export function useConsent(): Consent | null {
  const [c, setC] = useState(getConsent);
  useEffect(() => {
    const on = () => setC(getConsent());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return c;
}
