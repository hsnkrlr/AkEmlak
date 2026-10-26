import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fotografIsle, isImage } from '../src/resim.ts';

test('fotografIsle büyük JPEG i 1600 px webp e çevirir ve meta veriyi siler', async () => {
  const giris = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#7a8a99' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'konum ve kişisel bilgi' } })
    .toBuffer();
  assert.ok((await sharp(giris).metadata()).exif);
  const cikis = await fotografIsle(giris);
  assert.equal(isImage(cikis), true);
  const m = await sharp(cikis).metadata();
  assert.equal(m.format, 'webp');
  assert.equal(m.width, 1600);
  assert.equal(m.exif, undefined);
});

test('resim olmayan dosya reddedilir', async () => {
  await assert.rejects(fotografIsle(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), /Fotoğraf okunamadı/);
});
