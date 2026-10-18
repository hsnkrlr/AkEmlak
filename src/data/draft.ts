/**
 * Yöneticinin çalışma kopyası. Tüm okuma/yazma tarayıcıdaki IndexedDB üzerinde yapılır.
 * "Yayın paketi" ile bu kopya imzalanıp sitenin /data klasörüne konacak dosyalara dönüştürülür.
 */
import { zipSync, type Zippable } from 'fflate';
import { LIMITS } from '../config';
import { te } from '../lib/crypto';
import { thumbName } from '../lib/format';
import type { ProcessedImage } from '../lib/images';
import { IMAGE_NAME_RE, sanitizeListing } from '../lib/schema';
import { idbClear, idbDelete, idbGet, idbGetAll, idbKeys, idbPut } from '../lib/idb';
import { signPayload } from '../security/signing';
import type { AdminSession } from '../security/auth';
import type { Listing, PublishedPayload } from '../types';
import { loadPublished } from './published';

const META_KEY = 'draftMeta';

export interface DraftMeta {
  initialized: boolean;
  dirty: boolean;
  syncedAt?: number;
  exportedAt?: number;
  livePublishedAt?: string;
}

export async function getMeta(): Promise<DraftMeta> {
  return (await idbGet<DraftMeta>('meta', META_KEY)) ?? { initialized: false, dirty: false };
}

async function patchMeta(p: Partial<DraftMeta>): Promise<void> {
  await idbPut('meta', { ...(await getMeta()), ...p }, META_KEY);
}

/** İlk sürümdeki örnek ilanlar; yönetici verisinden otomatik temizlenir. */
export const isSampleListing = (l: Pick<Listing, 'id'>) => /^ornek-\d+$/.test(l.id);

export async function ensureDraft(): Promise<void> {
  if (!(await getMeta()).initialized) await syncFromLive();
  await removeSampleListings();
}

/** Tek seferlik: eski sürümden kalan örnek ilanları siler, yöneticinin kendi ilanlarına dokunmaz. */
async function removeSampleListings(): Promise<void> {
  if (await idbGet<boolean>('meta', 'samplesRemoved')) return;
  const samples = (await idbGetAll<Listing>('listings')).filter(isSampleListing);
  for (const l of samples) await idbDelete('listings', l.id);
  if (samples.length) {
    await gcImages();
    await patchMeta({ dirty: true });
  }
  await idbPut('meta', true, 'samplesRemoved');
}

/** Yerel değişiklikleri atar ve yayındaki (imzası doğrulanmış) sürümü yükler. */
export async function syncFromLive(): Promise<{ missingImages: number }> {
  const state = await loadPublished(true);
  if (state.status === 'invalid') {
    throw new Error('Yayındaki ilan dosyasının imzası doğrulanamadı. Dosya değiştirilmiş olabilir; son yayın paketinizi yeniden yükleyin.');
  }
  if (state.status !== 'ok') throw new Error('Yayındaki ilanlar okunamadı. İnternet bağlantınızı kontrol edin.');

  const { publishedAt } = state.data;
  const listings = state.data.listings.filter((l) => !isSampleListing(l));
  let missingImages = 0;
  const have = new Set((await idbKeys('images')).map(String));
  for (const name of listings.flatMap((l) => l.images)) {
    for (const file of [name, thumbName(name)]) {
      if (have.has(file)) continue;
      try {
        const res = await fetch(`/data/img/${file}`, { cache: 'no-cache', credentials: 'omit' });
        if (!res.ok) throw new Error();
        await idbPut('images', await res.blob(), file);
        have.add(file);
      } catch {
        missingImages++;
      }
    }
  }
  await idbClear('listings');
  for (const l of listings) await idbPut('listings', l);
  await gcImages();
  await idbPut('meta', { initialized: true, dirty: false, syncedAt: Date.now(), livePublishedAt: publishedAt }, META_KEY);
  await idbPut('meta', true, 'samplesRemoved');
  return { missingImages };
}

export async function listDrafts(): Promise<Listing[]> {
  const all = await idbGetAll<Listing>('listings');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDraft(id: string): Promise<Listing | undefined> {
  return idbGet<Listing>('listings', id);
}

export async function saveDraft(input: Listing): Promise<Listing> {
  const clean = sanitizeListing({ ...input, updatedAt: new Date().toISOString() });
  if (!clean) throw new Error('İlan bilgileri geçersiz. Başlık, fiyat ve bağlantı adı zorunludur.');
  if (clean.images.length > LIMITS.maxImagesPerListing) throw new Error(`En fazla ${LIMITS.maxImagesPerListing} fotoğraf eklenebilir.`);
  const others = (await idbGetAll<Listing>('listings')).filter((l) => l.id !== clean.id);
  if (others.some((l) => l.slug === clean.slug)) throw new Error('Bu bağlantı adı başka bir ilanda kullanılıyor. Lütfen farklı bir ad girin.');
  await idbPut('listings', clean);
  await patchMeta({ dirty: true });
  return clean;
}

export async function deleteDraft(id: string): Promise<void> {
  await idbDelete('listings', id);
  await gcImages();
  await patchMeta({ dirty: true });
}

export async function uniqueSlug(base: string, selfId: string): Promise<string> {
  const taken = new Set((await idbGetAll<Listing>('listings')).filter((l) => l.id !== selfId).map((l) => l.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function nextCode(): Promise<string> {
  const nums = (await idbGetAll<Listing>('listings')).map((l) => Number(/^AK-(\d+)$/.exec(l.code)?.[1] ?? 0));
  return `AK-${Math.max(10000, ...nums) + 1}`;
}

export async function storeImage(img: ProcessedImage): Promise<void> {
  await idbPut('images', img.full, img.name);
  await idbPut('images', img.thumb, thumbName(img.name));
}

export async function getImageBlob(name: string, thumb = false): Promise<Blob | undefined> {
  return idbGet<Blob>('images', thumb ? thumbName(name) : name);
}

/** Hiçbir ilanın kullanmadığı görselleri siler. */
export async function gcImages(keep: string[] = []): Promise<void> {
  const used = new Set<string>();
  for (const n of [...(await idbGetAll<Listing>('listings')).flatMap((l) => l.images), ...keep]) {
    used.add(n);
    used.add(thumbName(n));
  }
  for (const key of await idbKeys('images')) if (!used.has(String(key))) await idbDelete('images', key);
}

const README = `AK EMLAK — YAYIN PAKETİ
=======================

Bu paketteki "data" klasörünü sitenizin ana dizinine yükleyin ve
mevcut "data" klasörünün üzerine yazın (eski klasörü tamamen değiştirin).

  data/listings.json  -> İmzalı ilan listesi
  data/img/           -> İlan fotoğrafları

listings.json dosyasını elle DÜZENLEMEYİN. Dosya dijital olarak imzalıdır;
tek bir karakter bile değişirse site ilanları güvenlik nedeniyle göstermez.
`;

export interface SignedRelease {
  /** listings.json dosyasının içeriği */
  json: string;
  publishedAt: string;
  count: number;
  /** Yayına girecek görsel dosyaları (tam boy + küçük), dosya adı → içerik */
  images: Map<string, Blob>;
}

/** Yayındaki (taslak olmayan) ilanları imzalar ve gereken görselleri toplar. */
export async function buildSignedRelease(session: AdminSession): Promise<SignedRelease> {
  const listings = (await listDrafts()).filter((l) => l.status !== 'taslak' && !isSampleListing(l));
  const payload: PublishedPayload = { version: 1, publishedAt: new Date().toISOString(), listings };
  const signed = await signPayload(session.signingKey, JSON.stringify(payload));
  const images = new Map<string, Blob>();
  for (const name of new Set(listings.flatMap((l) => l.images))) {
    if (!IMAGE_NAME_RE.test(name)) continue;
    for (const file of [name, thumbName(name)]) {
      const blob = await idbGet<Blob>('images', file);
      if (!blob) throw new Error(`Bir fotoğraf bulunamadı (${file}). İlgili ilanı açıp fotoğrafları yeniden ekleyin.`);
      images.set(file, blob);
    }
  }
  return { json: JSON.stringify(signed, null, 2) + '\n', publishedAt: payload.publishedAt, count: listings.length, images };
}

/** Yayın başarıyla siteye ulaştığında çağrılır. */
export async function markPublished(publishedAt: string): Promise<void> {
  await patchMeta({ dirty: false, exportedAt: Date.now(), livePublishedAt: publishedAt });
}

/** Elle yükleme için: sitenin /data klasörünü zip paketi olarak üretir. */
export async function buildPublishPackage(session: AdminSession): Promise<{ blob: Blob; count: number }> {
  const release = await buildSignedRelease(session);
  const files: Zippable = {
    'BENIOKU.txt': te.encode(README),
    'data/listings.json': [te.encode(release.json), { level: 6 }],
  };
  for (const [file, blob] of release.images) files[`data/img/${file}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  const zipped = zipSync(files);
  await markPublished(release.publishedAt);
  return { blob: new Blob([zipped], { type: 'application/zip' }), count: release.count };
}
