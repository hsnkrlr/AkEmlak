/**
 * Yönetici kimlik doğrulama ve oturum yönetimi (tamamen tarayıcıda).
 *
 * - Şifre PBKDF2-SHA256 (600.000 tur) + HKDF ile türetilir; düz metin şifre hiçbir yerde tutulmaz.
 * - Her cihazda 10 dakikada en fazla 3 hatalı deneme (bkz. rateLimit.ts).
 * - Doğru şifre, yayın imza anahtarının kilidini de açar: şifreyi bilmeyen biri arayüzü
 *   atlatsa bile geçerli (sitede görünecek) bir yayın üretemez.
 * - Oturum 15 dakika sonra kesin olarak biter, yenilenmez; her girişte şifre yeniden istenir.
 * - Oturum belirteci HMAC ile imzalanır, sekmeye (sessionStorage) ve cihaza bağlıdır.
 *   İmza anahtarı dışa aktarılamaz (non-extractable) CryptoKey olarak IndexedDB'de durur.
 */
import { AUTH_POLICY } from '../config';
import { fromB64, fromB64Url, randomId, te, td, timingSafeEqual, toB64Url } from '../lib/crypto';
import { idbDelete, idbGet, idbPut } from '../lib/idb';
import { CREDENTIALS } from './credentials';
import { getDeviceId } from './device';
import { clearFailures, getLockStatus, registerFailure, type LockStatus } from './rateLimit';

const TOKEN_KEY = 'ak.session';
const SESSION_RECORD = 'current';
const LOG_KEY = 'loginLog';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ak-admin') : null;

interface SessionRecord {
  sid: string;
  deviceId: string;
  iat: number;
  exp: number;
  hmacKey: CryptoKey;
  signingKey: CryptoKey;
  vaultKey: CryptoKey;
}

interface TokenPayload {
  sid: string;
  dev: string;
  iat: number;
  exp: number;
}

export interface AdminSession {
  sid: string;
  exp: number;
  signingKey: CryptoKey;
  /** Şifreden türetilen, cihazdaki gizli ayarları (GitHub anahtarı) şifreleyen anahtar */
  vaultKey: CryptoKey;
}

export interface LoginEvent {
  at: number;
  ok: boolean;
}

export type LoginResult = { ok: true } | { ok: false; reason: 'locked' | 'wrong' | 'error'; lock: LockStatus };

const hkdf = (info: string): HkdfParams => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(info) });

async function deriveMaster(password: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(CREDENTIALS.salt), iterations: CREDENTIALS.iterations },
    base,
    256,
  );
  return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

async function unlockSigningKey(master: CryptoKey): Promise<CryptoKey> {
  const wrapKey = await crypto.subtle.deriveKey(hkdf('akemlak/v1/wrap'), master, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(CREDENTIALS.wrapIv), additionalData: te.encode('akemlak/v1/signing-key') },
    wrapKey,
    fromB64(CREDENTIALS.wrappedSigningKey),
  );
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

function deriveVaultKey(master: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(hkdf('akemlak/v1/vault'), master, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function appendLog(ok: boolean): Promise<void> {
  try {
    const log = (await idbGet<LoginEvent[]>('meta', LOG_KEY)) ?? [];
    log.unshift({ at: Date.now(), ok });
    await idbPut('meta', log.slice(0, 30), LOG_KEY);
  } catch {
    /* kayıt tutulamazsa girişi engelleme */
  }
}

export async function getLoginLog(): Promise<LoginEvent[]> {
  return (await idbGet<LoginEvent[]>('meta', LOG_KEY)) ?? [];
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  // Aynı cihazdaki birden çok sekmenin aynı anda deneme yapıp sınırı aşmasını önler
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  return locks ? (locks.request('ak-login', fn) as Promise<T>) : fn();
}

export function login(password: string): Promise<LoginResult> {
  return withLock(async () => {
    const before = await getLockStatus();
    if (before.locked) return { ok: false, reason: 'locked', lock: before };

    let master: CryptoKey;
    let correct = false;
    try {
      master = await deriveMaster(password);
      const check = new Uint8Array(await crypto.subtle.deriveBits(hkdf('akemlak/v1/auth'), master, 256));
      correct = timingSafeEqual(check, fromB64(CREDENTIALS.authCheck));
    } catch {
      return { ok: false, reason: 'error', lock: before };
    }

    if (!correct) {
      const lock = await registerFailure();
      await appendLog(false);
      return { ok: false, reason: lock.locked ? 'locked' : 'wrong', lock };
    }

    try {
      const signingKey = await unlockSigningKey(master);
      const vaultKey = await deriveVaultKey(master);
      const hmacKey = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      const deviceId = await getDeviceId();
      const iat = Date.now();
      const record: SessionRecord = { sid: randomId(18), deviceId, iat, exp: iat + AUTH_POLICY.sessionMs, hmacKey, signingKey, vaultKey };
      const payload: TokenPayload = { sid: record.sid, dev: deviceId, iat, exp: record.exp };
      const body = toB64Url(te.encode(JSON.stringify(payload)));
      const sig = toB64Url(await crypto.subtle.sign('HMAC', hmacKey, te.encode(body)));

      // Yeni giriş, bu cihazdaki önceki oturumu geçersiz kılar (tek aktif oturum)
      await idbPut('session', record, SESSION_RECORD);
      sessionStorage.setItem(TOKEN_KEY, `${body}.${sig}`);
      await clearFailures();
      await appendLog(true);
      channel?.postMessage('login');
      return { ok: true };
    } catch {
      return { ok: false, reason: 'error', lock: await getLockStatus() };
    }
  });
}

export async function getSession(): Promise<AdminSession | null> {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return invalidate();

  try {
    const record = await idbGet<SessionRecord>('session', SESSION_RECORD);
    if (!record || !record.vaultKey) return invalidate(false);
    const ok = await crypto.subtle.verify('HMAC', record.hmacKey, fromB64Url(sig), te.encode(body));
    if (!ok) return invalidate(false);
    const payload = JSON.parse(td.decode(fromB64Url(body))) as TokenPayload;
    const now = Date.now();
    const deviceId = await getDeviceId();
    const valid =
      payload.sid === record.sid &&
      payload.dev === deviceId &&
      record.deviceId === deviceId &&
      payload.exp === record.exp &&
      payload.iat <= now + 60_000 &&
      record.exp - record.iat <= AUTH_POLICY.sessionMs &&
      now < record.exp;
    if (!valid) return invalidate(now >= record.exp);
    return { sid: record.sid, exp: record.exp, signingKey: record.signingKey, vaultKey: record.vaultKey };
  } catch {
    return invalidate(false);
  }
}

/** Belirteci siler; `wipeRecord` ise cihazdaki oturum kaydını (ve anahtarları) da yok eder. */
async function invalidate(wipeRecord = true): Promise<null> {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* yok say */
  }
  if (wipeRecord) await idbDelete('session', SESSION_RECORD).catch(() => undefined);
  return null;
}

export async function logout(): Promise<void> {
  await invalidate(true);
  channel?.postMessage('logout');
}

/** Diğer sekmelerde çıkış / yeni giriş olduğunda haber verir. */
export function onSessionBroadcast(fn: () => void): () => void {
  if (!channel) return () => undefined;
  const handler = () => fn();
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}
