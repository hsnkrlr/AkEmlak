import sharp from 'sharp';

/** Gerçek dosya imzası (magic bytes): JPEG veya WEBP */
export function isImage(buf: Buffer): boolean {
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const webp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || webp;
}

/** Siteye eklenecek fotoğraf: en fazla 1600 px, webp, EXIF/GPS dahil meta veri olmadan yeniden kodlanır. */
export async function fotografIsle(buf: Buffer): Promise<Buffer> {
  if (!isImage(buf)) throw new Error('Fotoğraf okunamadı');
  try {
    return await sharp(buf, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error('Fotoğraf okunamadı');
  }
}
