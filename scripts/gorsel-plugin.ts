/// <reference types="node" />
/**
 * Derlemede ilan fotoğraflarının hafif kopyalarını üretir (görüntü kalitesi korunur):
 *   dist/img/k/<ad>.webp  → 480 px  (ilan kartları, küçük resimler)
 *   dist/img/o/<ad>.webp  → 1200 px (ilan galerisi)
 * Asıl dosya 1600 px'ten büyükse ya da 450 KB'tan ağırsa aynı adla 1600 px'e küçültülür (büyütülmüş görünüm).
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import sharp from 'sharp';
import type { Plugin } from 'vite';

export const gorselAdi = (ad: string) => ad.replace(/\.[a-z0-9]+$/i, '') + '.webp';

export function gorselPlugin(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'akemlak-gorsel',
    apply: 'build',
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
    },
    async closeBundle() {
      const kaynak = resolve(root, 'public/img');
      let adlar: string[] = [];
      try {
        adlar = readdirSync(kaynak).filter((a) => /\.(jpe?g|png|webp|avif)$/i.test(a));
      } catch {
        return;
      }
      mkdirSync(resolve(outDir, 'img/k'), { recursive: true });
      mkdirSync(resolve(outDir, 'img/o'), { recursive: true });
      let toplam = 0;
      let kazanc = 0;
      for (const ad of adlar) {
        const yol = resolve(kaynak, ad);
        try {
          const g = sharp(yol, { failOn: 'none' }).rotate();
          const m = await g.metadata();
          const kucuk = await g.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
          const orta = await g.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          writeFileSync(resolve(outDir, 'img/k', gorselAdi(ad)), kucuk);
          writeFileSync(resolve(outDir, 'img/o', gorselAdi(ad)), orta);
          const boyut = statSync(yol).size;
          if ((m.width ?? 0) > 1600 || boyut > 450_000) {
            const ext = extname(ad).toLowerCase();
            const t = g.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
            const buf = await (ext === '.png' ? t.png({ compressionLevel: 9 }) : ext === '.webp' ? t.webp({ quality: 82 }) : ext === '.avif' ? t.avif({ quality: 60 }) : t.jpeg({ quality: 84, mozjpeg: true })).toBuffer();
            if (buf.length < boyut) {
              writeFileSync(resolve(outDir, 'img', ad), buf);
              kazanc += boyut - buf.length;
            }
          }
          toplam++;
        } catch (e) {
          console.warn(`[görsel] ${ad} işlenemedi: ${(e as Error).message}`);
        }
      }
      console.log(`[görsel] ${toplam} fotoğrafın küçük/orta kopyası üretildi${kazanc ? `, büyük dosyalardan ${Math.round(kazanc / 1024)} KB kazanıldı` : ''}.`);
    },
  };
}
