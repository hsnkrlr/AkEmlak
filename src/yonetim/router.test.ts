import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotaCoz } from './router.ts';

test('rotaCoz bilinen adresleri çözer', () => {
  assert.deepEqual(rotaCoz(''), { ad: 'basvurular' });
  assert.deepEqual(rotaCoz('#/basvurular'), { ad: 'basvurular' });
  assert.deepEqual(rotaCoz('#/basvuru/abc123'), { ad: 'basvuru', id: 'abc123' });
  assert.deepEqual(rotaCoz('#/basvuru/abc123/ilan'), { ad: 'basvuruIlan', id: 'abc123' });
  assert.deepEqual(rotaCoz('#/ilanlar'), { ad: 'ilanlar' });
  assert.deepEqual(rotaCoz('#/ilan/yeni'), { ad: 'ilanYeni' });
  assert.deepEqual(rotaCoz('#/ilan/AK-10006'), { ad: 'ilan', id: 'AK-10006' });
  assert.deepEqual(rotaCoz('#/ayarlar'), { ad: 'ayarlar' });
});

test('rotaCoz bilinmeyen ya da kötü niyetli adresleri başvurulara yönlendirir', () => {
  assert.deepEqual(rotaCoz('#/bilinmeyen'), { ad: 'basvurular' });
  assert.deepEqual(rotaCoz('#/basvuru/../../x'), { ad: 'basvurular' });
  assert.deepEqual(rotaCoz('#/ilan/<script>'), { ad: 'basvurular' });
});
