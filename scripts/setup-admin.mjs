#!/usr/bin/env node
/**
 * Yönetici şifresini ve yayın imza anahtarını üretir.
 *
 *   npm run setup-admin -- "YeniŞifre"
 *
 * Üretilenler:
 *  - src/security/credentials.ts : PBKDF2 tuzu + doğrulama özeti + şifreyle kilitli imza anahtarı
 *  - src/security/publicKey.ts   : Yayınların doğrulandığı açık anahtar
 *  - public/data/listings.json   : Mevcut ilanlar yeni anahtarla yeniden imzalanır (yoksa örnek ilanlar)
 *
 * Şifrenin kendisi hiçbir dosyaya yazılmaz.
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ITERATIONS = 600_000;
const te = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString('base64');

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Kullanım: npm run setup-admin -- "<en az 8 karakterli şifre>"');
  process.exit(1);
}

async function deriveMaster(pw, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, base, 256);
  return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

const hkdf = (info) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(info) });

const salt = crypto.getRandomValues(new Uint8Array(16));
const master = await deriveMaster(password, salt);
const authCheck = new Uint8Array(await crypto.subtle.deriveBits(hkdf('akemlak/v1/auth'), master, 256));
const wrapKey = await crypto.subtle.deriveKey(hkdf('akemlak/v1/wrap'), master, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
const wrapIv = crypto.getRandomValues(new Uint8Array(12));
const wrapped = new Uint8Array(
  await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv, additionalData: te.encode('akemlak/v1/signing-key') }, wrapKey, pkcs8),
);

const header = '// Bu dosya `npm run setup-admin` ile otomatik üretilir. Elle düzenlemeyin.\n';
await writeFile(
  resolve(root, 'src/security/credentials.ts'),
  header +
    `export const CREDENTIALS = {\n` +
    `  v: 1,\n` +
    `  iterations: ${ITERATIONS},\n` +
    `  salt: '${b64(salt)}',\n` +
    `  authCheck: '${b64(authCheck)}',\n` +
    `  wrapIv: '${b64(wrapIv)}',\n` +
    `  wrappedSigningKey: '${b64(wrapped)}',\n` +
    `} as const;\n`,
);
const { kty, crv, x, y } = publicJwk;
await writeFile(
  resolve(root, 'src/security/publicKey.ts'),
  header + `export const PUBLISH_PUBLIC_KEY: JsonWebKey = ${JSON.stringify({ kty, crv, x, y, ext: true }, null, 2)};\n`,
);

// Yayındaki veriyi yeni anahtarla imzala
const listingsPath = resolve(root, 'public/data/listings.json');
let payload;
if (existsSync(listingsPath)) {
  try {
    const doc = JSON.parse(await readFile(listingsPath, 'utf8'));
    if (doc && typeof doc.payload === 'string') payload = doc.payload;
  } catch {
    /* örnek veriye düş */
  }
}
if (!payload) {
  const { sampleListings } = await import('./sample-listings.mjs');
  payload = JSON.stringify({ version: 1, publishedAt: new Date().toISOString(), listings: sampleListings() });
}
const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, te.encode(payload)));
await mkdir(dirname(listingsPath), { recursive: true });
await writeFile(
  listingsPath,
  JSON.stringify({ format: 'akemlak-signed-v1', alg: 'ES256', payload, signature: b64(sig) }, null, 2) + '\n',
);

console.log('✓ Yönetici kimlik bilgileri ve imza anahtarı üretildi.');
console.log('✓ public/data/listings.json yeni anahtarla imzalandı.');
console.log('  Siteyi yeniden derleyip (npm run build) yayınlamayı unutmayın.');
