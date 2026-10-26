import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hataMetni } from './hata.ts';

test('sunucunun Türkçe mesajı, SDK nin eklediği [400] olmadan gösterilir', () => {
  assert.equal(hataMetni({ code: 'functions/failed-precondition', message: 'GitHub anahtarının süresi dolmuş veya yetkisi yok. [400]' }), 'GitHub anahtarının süresi dolmuş veya yetkisi yok.');
  assert.equal(hataMetni({ code: 'functions/aborted', message: 'Başka bir değişiklik aynı anda yapıldı. Lütfen tekrar deneyin. [409]' }), 'Başka bir değişiklik aynı anda yapıldı. Lütfen tekrar deneyin.');
});

test('bağlantı sorunları anlaşılır mesaja çevrilir', () => {
  const ag = 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
  assert.equal(hataMetni({ code: 'functions/internal', message: 'internal' }), ag);
  assert.equal(hataMetni({ code: 'functions/unavailable', message: 'Failed to fetch' }), ag);
  assert.equal(hataMetni({ code: 'functions/deadline-exceeded', message: 'deadline-exceeded' }), ag);
  assert.equal(hataMetni(undefined), ag);
});
