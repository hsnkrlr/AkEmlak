import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bildirimGonder } from '../src/push.ts';

const basvuru = (status = 'yeni') => ({
  id: 'abc123', number: 'B-7K2Q9X', status, listing: { type: 'mustakil', district: 'Nurdağı', city: 'Gaziantep' },
});
const token = (t: string, silinen: string[]) => ({ token: t, ref: { delete: async () => { silinen.push(t); } } });

test('şüpheli başvuruda bildirim gönderilmez', async () => {
  let cagrildi = false;
  const r = await bildirimGonder({ basvuru: basvuru('supheli'), tokenlar: [token('t1', [])], gonder: async () => { cagrildi = true; return { responses: [] }; } });
  assert.equal(cagrildi, false);
  assert.deepEqual(r, { gonderilen: 0, silinen: 0 });
});

test('mesaj başlığı, gövdesi ve bağlantısı', async () => {
  let mesajlar: Record<string, any>[] = [];
  await bildirimGonder({ basvuru: basvuru(), tokenlar: [token('t1', [])], gonder: async (m) => { mesajlar = m as Record<string, any>[]; return { responses: [{ success: true }] }; } });
  assert.equal(mesajlar.length, 1);
  assert.equal(mesajlar[0].token, 't1');
  assert.equal(mesajlar[0].notification.title, 'Yeni ilan başvurusu B-7K2Q9X');
  assert.equal(mesajlar[0].notification.body, 'Müstakil Ev · Nurdağı');
  assert.equal(mesajlar[0].webpush.fcmOptions.link, 'https://ak-emlak.vercel.app/yonetim/#/basvuru/abc123');
  // Service worker bildirimi kendisi gösterir; bağlantıyı data alanından okur
  assert.deepEqual(mesajlar[0].data, { link: 'https://ak-emlak.vercel.app/yonetim/#/basvuru/abc123', basvuruId: 'abc123' });
});

test('geçersiz token silinir', async () => {
  const silinen: string[] = [];
  const r = await bildirimGonder({
    basvuru: basvuru(),
    tokenlar: [token('t1', silinen), token('t2', silinen)],
    gonder: async () => ({ responses: [{ success: true }, { success: false, error: { code: 'messaging/registration-token-not-registered' } }] }),
  });
  assert.deepEqual(r, { gonderilen: 1, silinen: 1 });
  assert.deepEqual(silinen, ['t2']);
});

test('ilçe yoksa il, tip bilinmiyorsa kendi adı kullanılır; token yoksa gönderilmez', async () => {
  let govde = '';
  await bildirimGonder({ basvuru: { ...basvuru(), listing: { type: 'tekne', city: 'Gaziantep' } }, tokenlar: [token('t1', [])], gonder: async (m) => { govde = (m[0] as any).notification.body; return { responses: [{ success: true }] }; } });
  assert.equal(govde, 'tekne · Gaziantep');
  let cagrildi = false;
  await bildirimGonder({ basvuru: basvuru(), tokenlar: [], gonder: async () => { cagrildi = true; return { responses: [] }; } });
  assert.equal(cagrildi, false);
});

test('yetkili listesinden çıkarılan kişinin cihazına bildirim gitmez ve kaydı silinir', async () => {
  const silinen: string[] = [];
  let gonderilen: string[] = [];
  const r = await bildirimGonder({
    basvuru: basvuru(),
    tokenlar: [{ ...token('t1', silinen), email: 'a@b.co' }, { ...token('t2', silinen), email: 'cikarilan@b.co' }],
    yetkililer: new Set(['a@b.co']),
    gonder: async (m) => { gonderilen = m.map((x) => (x as { token: string }).token); return { responses: m.map(() => ({ success: true })) }; },
  });
  assert.deepEqual(gonderilen, ['t1']);
  assert.deepEqual(silinen, ['t2']);
  assert.equal(r.gonderilen, 1);
});
