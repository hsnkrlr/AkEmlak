import { AUTH_POLICY } from '../config';
import { readRedundant, writeRedundant } from './storage';

export interface LockStatus {
  locked: boolean;
  /** Kilidin açılacağı zaman (ms) */
  until: number;
  /** Kilitlenmeden önce kalan deneme hakkı */
  attemptsLeft: number;
}

function parse(v: string): number[] | null {
  try {
    const arr: unknown = JSON.parse(v);
    if (!Array.isArray(arr) || !arr.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return arr as number[];
  } catch {
    return null;
  }
}

async function readFails(): Promise<number[]> {
  const now = Date.now();
  const parsed = (await readRedundant('guard')).map(parse);
  // Tüm kaynakların birleşimi: hangi kopya en çok hatayı içeriyorsa o geçerli olur
  const all = parsed.flatMap((p) => p ?? []);
  const tampered = parsed.some((p) => p === null);
  if (tampered) {
    // Oynanmış kayıt: güvenli tarafta kalıp 10 dakikalık tam kilit uygula
    for (let i = 0; i < AUTH_POLICY.maxFails; i++) all.push(now - i);
  }
  // Gelecek tarihli kayıtlar (saat oynaması) da pencere içinde sayılır
  const fails = Array.from(new Set(all))
    .filter((t) => now - t < AUTH_POLICY.failWindowMs)
    .sort((a, b) => a - b);
  if (tampered) await writeFails(fails);
  return fails;
}

async function writeFails(fails: number[]): Promise<void> {
  await writeRedundant('guard', JSON.stringify(fails), Math.ceil(AUTH_POLICY.failWindowMs / 1000));
}

function statusFrom(fails: number[]): LockStatus {
  const { maxFails, failWindowMs } = AUTH_POLICY;
  if (fails.length >= maxFails) {
    const until = fails[fails.length - maxFails] + failWindowMs;
    if (until > Date.now()) return { locked: true, until, attemptsLeft: 0 };
  }
  return { locked: false, until: 0, attemptsLeft: Math.max(0, maxFails - fails.length) };
}

export async function getLockStatus(): Promise<LockStatus> {
  return statusFrom(await readFails());
}

export async function registerFailure(): Promise<LockStatus> {
  const fails = await readFails();
  fails.push(Date.now());
  await writeFails(fails);
  return statusFrom(fails);
}

export async function clearFailures(): Promise<void> {
  await writeFails([]);
}
