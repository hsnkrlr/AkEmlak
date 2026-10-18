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
import { IMAGE_NAME_RE } from '../lib/schema';
import type { AdminSession } from '../security/auth';
import { verifySignedDocument } from '../security/signing';
import { buildSignedRelease, getMeta, isSampleListing, markPublished } from './draft';

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

async function gh<T>(token: string, path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: init.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
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
  return (init.raw ? res.text() : res.json()) as Promise<T>;
}

async function blobToB64(blob: Blob): Promise<string> {
  return toB64(new Uint8Array(await blob.arrayBuffer()));
}

export type ProgressFn = (msg: string) => void;

/**
 * Yayındaki ilanları GitHub'a gönderir. Başka bir cihazdan daha yeni bir yayın yapılmışsa,
 * o verinin üzerine yazmamak için durur ve önce senkronize edilmesini ister.
 */
export async function publishToGithub(session: AdminSession, progress: ProgressFn = () => undefined): Promise<{ count: number }> {
  const token = await loadToken(session);
  const { owner, repo, dataDir } = GITHUB;
  const base = `/repos/${owner}/${repo}`;

  progress('GitHub’a bağlanılıyor…');
  const branch = GITHUB.branch || (await gh<{ default_branch: string }>(token, base)).default_branch;
  const enc = encodeURIComponent;

  // Veri koruması: yayındaki dosya, bu cihazın en son gördüğü sürümden farklıysa üzerine yazma
  progress('Yayındaki veri kontrol ediliyor…');
  const meta = await getMeta();
  let remoteRaw: string | null = null;
  try {
    remoteRaw = await gh<string>(token, `${base}/contents/${dataDir}/listings.json?ref=${enc(branch)}`, { raw: true });
  } catch (e) {
    if (!(e instanceof GithubError && e.status === 404)) throw e;
  }
  if (remoteRaw) {
    const payload = await verifySignedDocument(JSON.parse(remoteRaw));
    if (payload) {
      const remote = JSON.parse(payload) as { publishedAt?: string; listings?: { id: string }[] };
      const hasRealData = (remote.listings ?? []).some((l) => !isSampleListing(l));
      if (hasRealData && remote.publishedAt !== meta.livePublishedAt) {
        throw new Error(
          'Sitede bu cihazda görmediğiniz daha yeni bir yayın var (başka bir cihazdan yapılmış olabilir). Verilerin kaybolmaması için önce aşağıdan "Yayındaki sürümü yükle" ile güncelleyin, sonra değişikliklerinizi yapıp yayınlayın.',
        );
      }
    }
  }

  progress('İlanlar imzalanıyor…');
  const release = await buildSignedRelease(session);

  // Mevcut fotoğraflar: içerik özetiyle adlandırıldıkları için aynı ada sahip olanlar tekrar yüklenmez
  let existing: string[] = [];
  try {
    existing = (await gh<{ name: string }[]>(token, `${base}/contents/${dataDir}/img?ref=${enc(branch)}`)).map((f) => f.name);
  } catch (e) {
    if (!(e instanceof GithubError && e.status === 404)) throw e;
  }
  const have = new Set(existing);

  const tree: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];
  const toUpload = [...release.images].filter(([name]) => !have.has(name));
  let done = 0;
  for (const [name, blob] of toUpload) {
    progress(`Fotoğraflar yükleniyor… (${++done}/${toUpload.length})`);
    const { sha } = await gh<{ sha: string }>(token, `${base}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: await blobToB64(blob), encoding: 'base64' }),
    });
    tree.push({ path: `${dataDir}/img/${name}`, mode: '100644', type: 'blob', sha });
  }
  // Artık hiçbir ilanda kullanılmayan fotoğrafları repodan kaldır
  for (const name of existing) {
    if (IMAGE_NAME_RE.test(name.replace('.t.', '.')) && !release.images.has(name)) {
      tree.push({ path: `${dataDir}/img/${name}`, mode: '100644', type: 'blob', sha: null });
    }
  }
  const listingsBlob = await gh<{ sha: string }>(token, `${base}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: toB64(te.encode(release.json)), encoding: 'base64' }),
  });
  tree.push({ path: `${dataDir}/listings.json`, mode: '100644', type: 'blob', sha: listingsBlob.sha });

  // Commit'i oluştur; arada başka bir commit gelirse en güncel dalın üzerine yeniden dene
  for (let attempt = 0; attempt < 3; attempt++) {
    progress('Değişiklikler kaydediliyor…');
    const ref = await gh<{ object: { sha: string } }>(token, `${base}/git/ref/heads/${enc(branch)}`);
    const head = await gh<{ tree: { sha: string } }>(token, `${base}/git/commits/${ref.object.sha}`);
    const newTree = await gh<{ sha: string }>(token, `${base}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: head.tree.sha, tree }),
    });
    const commit = await gh<{ sha: string }>(token, `${base}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `İlanlar güncellendi (${release.count} ilan) — yönetim paneli`,
        tree: newTree.sha,
        parents: [ref.object.sha],
      }),
    });
    try {
      await gh(token, `${base}/git/refs/heads/${enc(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
      await markPublished(release.publishedAt);
      return { count: release.count };
    } catch (e) {
      if (!(e instanceof GithubError && e.status === 422) || attempt === 2) throw e;
    }
  }
  throw new Error('Yayın kaydedilemedi, lütfen tekrar deneyin.');
}
