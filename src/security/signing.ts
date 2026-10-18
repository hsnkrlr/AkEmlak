/**
 * Yayın imzası (ECDSA P-256). listings.json yalnızca yönetici şifresiyle açılabilen
 * özel anahtarla imzalanır; site, veriyi göstermeden önce imzayı açık anahtarla doğrular.
 * Böylece barındırma tarafında dosyaya sahte ilan / sahte numara eklenirse site bunu reddeder.
 */
import { fromB64, te, toB64 } from '../lib/crypto';
import type { SignedDocument } from '../types';
import { PUBLISH_PUBLIC_KEY } from './publicKey';

const ALG = { name: 'ECDSA', hash: 'SHA-256' } as const;
let publicKey: Promise<CryptoKey> | null = null;

function getPublicKey(): Promise<CryptoKey> {
  publicKey ??= crypto.subtle.importKey('jwk', PUBLISH_PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return publicKey;
}

export async function verifySignedDocument(doc: unknown): Promise<string | null> {
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as Partial<SignedDocument>;
  if (d.format !== 'akemlak-signed-v1' || d.alg !== 'ES256' || typeof d.payload !== 'string' || typeof d.signature !== 'string') {
    return null;
  }
  try {
    const ok = await crypto.subtle.verify(ALG, await getPublicKey(), fromB64(d.signature), te.encode(d.payload));
    return ok ? d.payload : null;
  } catch {
    return null;
  }
}

export async function signPayload(privateKey: CryptoKey, payload: string): Promise<SignedDocument> {
  const sig = await crypto.subtle.sign(ALG, privateKey, te.encode(payload));
  return { format: 'akemlak-signed-v1', alg: 'ES256', payload, signature: toB64(sig) };
}
