import { randomId } from '../lib/crypto';
import { readRedundant, writeRedundant } from './storage';

const ID_RE = /^[A-Za-z0-9_-]{22}$/;
let cached: string | null = null;

/** Bu tarayıcıya özgü rastgele cihaz kimliği. Oturumlar bu kimliğe bağlanır. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const found = (await readRedundant('device')).find((v) => ID_RE.test(v));
  const id = found ?? randomId(16);
  await writeRedundant('device', id, 60 * 60 * 24 * 400);
  cached = id;
  return id;
}
