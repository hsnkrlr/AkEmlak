/**
 * Güvenlik durumunu (cihaz kimliği, hatalı deneme kayıtları) birden fazla yerde saklar:
 * localStorage + çerez + IndexedDB. Okurken en kısıtlayıcı değer esas alınır; böylece
 * yalnızca birini silmek kilidi kaldırmaz.
 */
import { idbGet, idbPut } from '../lib/idb';

function cookieGet(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function cookieSet(name: string, value: string, maxAgeSec: number): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Strict${secure}`;
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* gizli sekme vb. */
  }
}

export async function readRedundant(key: string): Promise<string[]> {
  const values: (string | null | undefined)[] = [lsGet('ak.' + key), cookieGet('ak_' + key)];
  try {
    values.push(await idbGet<string>('guard', key));
  } catch {
    /* IndexedDB kullanılamıyor */
  }
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export async function writeRedundant(key: string, value: string, cookieMaxAgeSec: number): Promise<void> {
  lsSet('ak.' + key, value);
  cookieSet('ak_' + key, value, cookieMaxAgeSec);
  try {
    await idbPut('guard', value, key);
  } catch {
    /* IndexedDB kullanılamıyor */
  }
}
