import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yetkiliMi } from '../src/yetki.ts';

const token = (over: Record<string, unknown> = {}) => ({
  token: { email: 'a@b.co', email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...over },
});
const kayitli = async (e: string) => e === 'a@b.co';

test('Google ile girmiş, e-postası doğrulanmış ve listede olan kullanıcı yetkilidir', async () => {
  assert.equal(await yetkiliMi(token(), kayitli), 'a@b.co');
});

test('e-postası doğrulanmamış, Google dışı, listede olmayan ya da oturumsuz kullanıcı yetkisizdir', async () => {
  assert.equal(await yetkiliMi(token({ email_verified: false }), kayitli), null);
  assert.equal(await yetkiliMi(token({ firebase: { sign_in_provider: 'anonymous' } }), kayitli), null);
  assert.equal(await yetkiliMi(token({ email: 'baska@b.co' }), kayitli), null);
  assert.equal(await yetkiliMi(token({ email: undefined }), kayitli), null);
  assert.equal(await yetkiliMi(undefined, kayitli), null);
});
