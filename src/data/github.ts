/**
 * Yayınla: imzalı ilan dosyasını ve fotoğrafları doğrudan GitHub reposuna tek commit olarak yazar.
 * Vercel bu commit'i görüp siteyi otomatik günceller. Sunucu yoktur; istekler tarayıcıdan
 * GitHub API'sine gider.
 *
 * GitHub erişim anahtarı (token) yönetici şifresinden türetilen anahtarla AES-GCM ile şifrelenip
 * yalnızca bu cihazın tarayıcısında saklanır; şifre bilinmeden çözülemez.
 */
import { GITHUB } from '../config';
import { fromB64, randomBytes, td, te, toB64 } from '../lib/crypto';
import { idbDelete, idbGet, idbPut } from '../lib/idb';
import { thumbName } from '../lib/format';
import { IMAGE_NAME_RE, sanitizeListing } from '../lib/schema';
import type { AdminSession } from '../security/auth';
import { verifySignedDocument } from '../security/signing';
import type { Listing } from '../types';
import { buildSignedRelease, ensureDraft, getMeta, hasImage, isSampleListing, listDrafts, markPublished, putImageBlob, replaceDrafts } from './draft';

const TOKEN_KEY = 'githubToken';
const AAD = te.encode('akemlak/v1/github-token');
const API = 'https://api.github.com';
const TOKEN_RE = /^(github_pat_[A-Za-z0-9_]{20,255}|ghp_[A-Za-z0-9]{30,255})$/;

interface StoredToken {
  iv: string;
  ct: string;
  savedAt: number;
}

export async function hasGithubToken(): Promise<boolean> {
  return !!(await idbGet<StoredToken>('meta', TOKEN_KEY));
}

export async function forgetGithubToken(): Promise<void> {
  await idbDelete('meta', TOKEN_KEY);
}

export async function saveGithubToken(session: AdminSession, token: string): Promise<void> {
  const t = token.trim();
  if (!TOKEN_RE.test(t)) throw new Error('Bu bir GitHub erişim anahtarına benzemiyor. "github_pat_" ile başlayan anahtarı yapıştırın.');
  const repo = await gh<{ permissions?: { push?: boolean } }>(t, `/repos/${GITHUB.owner}/${GITHUB.repo}`);
  if (repo.permissions && !repo.permissions.push) throw new Error('Bu anahtarın repoya yazma izni yok. "Contents: Read and write" iznini verin.');
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, session.vaultKey, te.encode(t));
  await idbPut('meta', { iv: toB64(iv), ct: toB64(ct), savedAt: Date.now() } satisfies StoredToken, TOKEN_KEY);
}

async function loadToken(session: AdminSession): Promise<string> {
  const stored = await idbGet<StoredToken>('meta', TOKEN_KEY);
  if (!stored) throw new Error('GitHub bağlantısı kurulmamış.');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(stored.iv), additionalData: AAD }, session.vaultKey, fromB64(stored.ct));
    return td.decode(pt);
  } catch {
    throw new Error('Kayıtlı GitHub anahtarı çözülemedi (şifre değişmiş olabilir). Anahtarı yeniden girin.');
  }
}

class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function gh<T>(token: string, path: string, init: RequestInit & { raw?: boolean; binary?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: init.raw || init.binary ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GithubError('GitHub’a bağlanılamadı. İnternet bağlantınızı kontrol edin.', 0);
  }
  if (!res.ok) {
    const msg =
      res.status === 401
        ? 'GitHub anahtarı geçersiz veya süresi dolmuş. Yeni bir anahtar oluşturup girin.'
        : res.status === 403
          ? 'GitHub bu işleme izin vermedi. Anahtarın bu repoda "Contents: Read and write" izni olduğundan emin olun.'
          : res.status === 404
            ? 'Repo bulunamadı ya da anahtarın bu repoya erişimi yok.'
            : `GitHub hatası (${res.status}).`;
    throw new GithubError(msg, res.status);
  }
  return (init.binary ? res.blob() : init.raw ? res.text() : res.json()) as Promise<T>;
}

async function blobToB64(blob: Blob): Promise<string> {
  return toB64(new Uint8Array(await blob.arrayBuffer()));
}

export type ProgressFn = (msg: string) => void;

export interface SyncResult {
  /** Siteye yeni bir commit gönderildi mi */
  published: boolean;
  /** Başka cihazlardan gelen değişiklik (ekleme/güncelleme/silme) sayısı */
  pulled: number;
  count: number;
}

const byId = (list: Listing[]) => new Map(list.map((l) => [l.id, l]));

/**
 * Üç yönlü birleştirme: bu cihaz (local), sitedeki veri (remote) ve son eşitlemedeki durum (base).
 * - İki tarafta da varsa: en son güncellenen kazanır.
 * - Yalnızca bu cihazda varsa: yeni eklenmiştir (tutulur) ya da başka cihazda silinmiştir (base'de vardır → atılır).
 * - Yalnızca sitede varsa: başka cihazda eklenmiştir (tutulur) ya da bu cihazda silinmiştir (base'de vardır → atılır).
 * Base bilinmiyorsa hiçbir şey silinmez; veri kaybı yerine fazlalık tercih edilir.
 */
export function mergeListings(local: Listing[], remote: Listing[], base: Record<string, string> = {}): Listing[] {
  const L = byId(local);
  const R = byId(remote);
  const out: Listing[] = [];
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) out.push(l.updatedAt >= r.updatedAt ? l : r);
    else if (l && !(id in base)) out.push(l);
    else if (r && !(id in base)) out.push(r);
  }
  // Farklı cihazlarda aynı anda oluşturulan ilanların bağlantı adı / ilan no çakışmasını gider
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const slugs = new Set<string>();
  const codes = new Set<string>();
  let maxCode = Math.max(10000, ...out.map((l) => Number(/^AK-(\d+)$/.exec(l.code)?.[1] ?? 0)));
  return out.map((l) => {
    let next = l;
    if (slugs.has(next.slug)) {
      let i = 2;
      while (slugs.has(`${l.slug}-${i}`)) i++;
      next = { ...next, slug: `${l.slug}-${i}` };
    }
    if (codes.has(next.code)) next = { ...next, code: `AK-${++maxCode}` };
    slugs.add(next.slug);
    codes.add(next.code);
    return next;
  });
}

const canonical = (list: Listing[]) =>
  JSON.stringify(
    list
      .map(sanitizeListing)
      .filter((l): l is Listing => !!l)
      .sort((a, b) => a.id.localeCompare(b.id)),
  );

/**
 * Bu cihazı siteyle eşitler ve gerekiyorsa yayınlar:
 * sitedeki veriyi çeker, cihazdaki veriyle birleştirir, eksik fotoğrafları indirir,
 * sonuç sitedekinden farklıysa imzalayıp GitHub'a tek commit olarak yazar (Vercel siteyi günceller).
 */
export async function syncWithGithub(session: AdminSession, progress: ProgressFn = () => undefined): Promise<SyncResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await syncOnce(session, progress);
    } catch (e) {
      // Arada başka bir cihaz commit attıysa baştan (yeniden birleştirerek) dene
      if (!(e instanceof GithubError && e.status === 422) || attempt >= 2) throw e;
    }
  }
}

async function syncOnce(session: AdminSession, progress: ProgressFn): Promise<SyncResult> {
  const token = await loadToken(session);
  const { owner, repo, dataDir } = GITHUB;
  const base = `/repos/${owner}/${repo}`;
  const enc = encodeURIComponent;

  progress('Siteye bağlanılıyor…');
  const branch = GITHUB.branch || (await gh<{ default_branch: string }>(token, base)).default_branch;
  // Dalın şu anki ucu: okuma bu commit'ten yapılır ve yeni commit bunun üzerine kurulur.
  // Arada başka bir cihaz yayın yaparsa güncelleme reddedilir (422) ve baştan birleştirilir.
  const ref = await gh<{ object: { sha: string } }>(token, `${base}/git/ref/heads/${enc(branch)}`);
  const at = ref.object.sha;
  const head = await gh<{ tree: { sha: string } }>(token, `${base}/git/commits/${at}`);
  const files = await gh<{ tree: { path: string; type: string }[] }>(token, `${base}/git/trees/${head.tree.sha}?recursive=1`);
  const imgPrefix = `${dataDir}/img/`;
  const remoteFiles = files.tree.filter((e) => e.type === 'blob' && e.path.startsWith(imgPrefix)).map((e) => e.path.slice(imgPrefix.length));
  const remoteImages = new Set(remoteFiles);
  const hasListingsFile = files.tree.some((e) => e.path === `${dataDir}/listings.json`);

  // 1) Sitedeki (repodaki) güncel veri
  let remote: Listing[] = [];
  let remoteTrusted = false;
  if (hasListingsFile) {
    const raw = await gh<string>(token, `${base}/contents/${dataDir}/listings.json?ref=${at}`, { raw: true });
    let doc: unknown = null;
    try {
      doc = JSON.parse(raw);
    } catch {
      /* bozuk dosya: güvenilmez */
    }
    const payload = await verifySignedDocument(doc);
    // İmzası geçersizse (dosya kurcalanmışsa) içeriğine güvenilmez; bu cihazdaki doğru veriyle değiştirilir
    if (payload) {
      const parsed = JSON.parse(payload) as { listings?: unknown[] };
      remote = (parsed.listings ?? []).map(sanitizeListing).filter((l): l is Listing => !!l && !isSampleListing(l));
      remoteTrusted = true;
    }
  }

  // 2) Birleştir
  progress('Değişiklikler birleştiriliyor…');
  await ensureDraft();
  const local = await listDrafts();
  const meta = await getMeta();
  // Sitedeki veriye güvenilemiyorsa (dosya yok/kurcalanmış) hiçbir yerel ilan "silinmiş" sayılmaz
  const merged = mergeListings(local, remote, remoteTrusted ? meta.base : {});
  const localById = byId(local);
  const mergedIds = new Set(merged.map((m) => m.id));
  const pulled =
    merged.filter((m) => {
      const l = localById.get(m.id);
      return !l || l.updatedAt !== m.updatedAt || l.slug !== m.slug || l.code !== m.code;
    }).length + local.filter((l) => !mergedIds.has(l.id)).length;

  // 3) Başka cihazdan gelen ilanların fotoğraflarını bu cihaza indir
  const needed = merged.flatMap((l) => l.images.flatMap((n) => [n, thumbName(n)]));
  for (const file of needed) {
    if (!IMAGE_NAME_RE.test(file.replace('.t.', '.')) || !remoteImages.has(file) || (await hasImage(file))) continue;
    progress('Fotoğraflar eşitleniyor…');
    try {
      await putImageBlob(file, await gh<Blob>(token, `${base}/contents/${dataDir}/img/${file}?ref=${at}`, { binary: true }));
    } catch {
      /* fotoğraf sitede zaten var; bu cihazda olmasa da yayın bozulmaz */
    }
  }
  await replaceDrafts(merged);

  // 4) Yayınlanacak sürüm sitedekiyle aynıysa commit gerekmez
  const release = await buildSignedRelease(session, remoteImages);
  const missingRemote = [...release.images.keys()].some((f) => !remoteImages.has(f));
  if (canonical(release.listings) === canonical(remote) && !missingRemote) {
    await markPublished(release.publishedAt, release.listings);
    return { published: false, pulled, count: release.count };
  }

  // 5) Yeni fotoğrafları yükle, kullanılmayanları kaldır, imzalı listeyi yaz
  const tree: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];
  const toUpload = [...release.images].filter((e): e is [string, Blob] => !remoteImages.has(e[0]) && !!e[1]);
  let done = 0;
  for (const [name, blob] of toUpload) {
    progress(`Fotoğraflar siteye yükleniyor… (${++done}/${toUpload.length})`);
    const { sha } = await gh<{ sha: string }>(token, `${base}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: await blobToB64(blob), encoding: 'base64' }),
    });
    tree.push({ path: `${dataDir}/img/${name}`, mode: '100644', type: 'blob', sha });
  }
  for (const name of remoteFiles) {
    if (IMAGE_NAME_RE.test(name.replace('.t.', '.')) && !release.images.has(name)) {
      tree.push({ path: `${dataDir}/img/${name}`, mode: '100644', type: 'blob', sha: null });
    }
  }
  const listingsBlob = await gh<{ sha: string }>(token, `${base}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: toB64(te.encode(release.json)), encoding: 'base64' }),
  });
  tree.push({ path: `${dataDir}/listings.json`, mode: '100644', type: 'blob', sha: listingsBlob.sha });

  progress('Siteye kaydediliyor…');
  const newTree = await gh<{ sha: string }>(token, `${base}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });
  const commit = await gh<{ sha: string }>(token, `${base}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: `İlanlar güncellendi (${release.count} ilan) — yönetim paneli`, tree: newTree.sha, parents: [at] }),
  });
  await gh(token, `${base}/git/refs/heads/${enc(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  await markPublished(release.publishedAt, release.listings);
  return { published: true, pulled, count: release.count };
}
