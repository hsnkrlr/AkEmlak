import { LIMITS } from '../config';
import { sha256Hex } from './crypto';

export interface ProcessedImage {
  name: string;
  full: Blob;
  thumb: Blob;
}

type Kind = 'jpeg' | 'png' | 'webp';

/** Dosya uzantısına/MIME bilgisine değil, gerçek dosya imzasına (magic bytes) bakar. */
function sniff(b: Uint8Array): Kind | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return 'webp';
  }
  return null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tarayıcı görsel işlemeyi desteklemiyor.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', quality);
  if (!jpeg) throw new Error('Görsel kaydedilemedi.');
  return jpeg;
}

/**
 * Görseli doğrular ve tuvale çizip yeniden kodlar. Bu işlem EXIF/GPS konum bilgisini ve
 * dosyaya gizlenmiş olası zararlı içeriği temizler, boyutu da küçültür.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size > LIMITS.maxImageInputBytes) throw new Error(`"${file.name}" 15 MB sınırını aşıyor.`);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!sniff(head)) throw new Error(`"${file.name}" desteklenen bir görsel değil (JPG, PNG veya WEBP olmalı).`);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${file.name}" açılamadı, dosya bozuk olabilir.`);
  }
  try {
    if (bitmap.width < 200 || bitmap.height < 150) throw new Error(`"${file.name}" çok küçük (en az 200×150 piksel).`);
    const full = await encode(bitmap, LIMITS.imageMaxSide, 0.82);
    const thumb = await encode(bitmap, LIMITS.thumbMaxSide, 0.74);
    const ext = full.type === 'image/webp' ? 'webp' : 'jpg';
    const hash = await sha256Hex(await full.arrayBuffer());
    return { name: `${hash}.${ext}`, full, thumb };
  } finally {
    bitmap.close();
  }
}
