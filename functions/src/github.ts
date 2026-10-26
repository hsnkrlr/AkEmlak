/**
 * GitHub deposundaki public/data.json ve public/img dosyalarını Git Data API ile tek commit'te günceller.
 * Dal araya giren bir değişiklikle ilerlemişse güncel veri yeniden okunur ve değişiklik ona uygulanır;
 * böylece aynı anda yapılan iki düzenleme birbirini silmez.
 */
import type { DataJson } from './ilanlar';

export interface Hazirlik {
  veri: DataJson;
  ekle: { yol: string; icerik: Buffer }[];
  sil: string[];
}

export interface Depo {
  oku(): Promise<{ veri: DataJson; commit: string }>;
  /** mesaj bir fonksiyonsa hazırlıktan sonra çağrılır (ör. yeni ilan numarası o anda belli olur) */
  yaz(hazirla: (veri: DataJson) => Promise<Hazirlik>, mesaj: string | (() => string)): Promise<{ commit: string; veri: DataJson }>;
}

export class GithubHatasi extends Error {
  kod: 'anahtar' | 'cakisma' | 'diger';
  constructor(kod: 'anahtar' | 'cakisma' | 'diger', mesaj: string) {
    super(mesaj);
    this.kod = kod;
  }
}

const VERI_YOLU = 'public/data.json';
const DENEME = 3;

export function depoOlustur(o: {
  token: string;
  repo: string;
  branch: string;
  api?: string;
  fetch?: typeof fetch;
  yaziyaDok: (v: DataJson) => string;
}): Depo {
  const f = o.fetch ?? fetch;
  const api = (o.api ?? 'https://api.github.com').replace(/\/$/, '');
  const ref = `heads/${o.branch}`;

  async function istek(method: string, yol: string, govde?: unknown, ham = false): Promise<Response> {
    const res = await f(`${api}/repos/${o.repo}${yol}`, {
      method,
      headers: {
        Authorization: `Bearer ${o.token}`,
        Accept: ham ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(govde ? { 'Content-Type': 'application/json' } : {}),
      },
      body: govde ? JSON.stringify(govde) : undefined,
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new GithubHatasi('anahtar', 'GitHub anahtarının süresi dolmuş veya yetkisi yok. Secret Manager\'daki GITHUB_TOKEN değerini yenileyin.');
    }
    return res;
  }

  async function json<T>(method: string, yol: string, govde?: unknown): Promise<T> {
    const res = await istek(method, yol, govde);
    if (!res.ok) throw new GithubHatasi('diger', `GitHub isteği başarısız (${res.status} ${method} ${yol}).`);
    return (await res.json()) as T;
  }

  async function oku(): Promise<{ veri: DataJson; commit: string; tree: string }> {
    const r = await json<{ object: { sha: string } }>('GET', `/git/ref/${ref}`);
    const commit = r.object.sha;
    const c = await json<{ tree: { sha: string } }>('GET', `/git/commits/${commit}`);
    const res = await istek('GET', `/contents/${VERI_YOLU}?ref=${commit}`, undefined, true);
    if (!res.ok) throw new GithubHatasi('diger', `data.json okunamadı (${res.status}).`);
    let veri: DataJson;
    try {
      veri = JSON.parse(await res.text()) as DataJson;
    } catch {
      throw new GithubHatasi('diger', 'data.json geçerli JSON değil. Dosyadaki yazım hatasını düzeltin.');
    }
    if (!veri || !Array.isArray(veri.ilanlar)) throw new GithubHatasi('diger', 'data.json içinde "ilanlar" listesi yok.');
    return { veri, commit, tree: c.tree.sha };
  }

  async function blob(icerik: Buffer): Promise<string> {
    return (await json<{ sha: string }>('POST', '/git/blobs', { content: icerik.toString('base64'), encoding: 'base64' })).sha;
  }

  return {
    oku: async () => {
      const { veri, commit } = await oku();
      return { veri, commit };
    },
    async yaz(hazirla, mesaj) {
      for (let deneme = 1; deneme <= DENEME; deneme++) {
        const mevcut = await oku();
        const h = await hazirla(mevcut.veri);
        const tree: { path: string; mode: string; type: string; sha: string | null }[] = [];
        for (const d of h.ekle) tree.push({ path: d.yol, mode: '100644', type: 'blob', sha: await blob(d.icerik) });
        tree.push({ path: VERI_YOLU, mode: '100644', type: 'blob', sha: await blob(Buffer.from(o.yaziyaDok(h.veri), 'utf8')) });
        for (const yol of h.sil) tree.push({ path: yol, mode: '100644', type: 'blob', sha: null });
        const t = await json<{ sha: string }>('POST', '/git/trees', { base_tree: mevcut.tree, tree });
        const c = await json<{ sha: string }>('POST', '/git/commits', { message: typeof mesaj === 'function' ? mesaj() : mesaj, tree: t.sha, parents: [mevcut.commit] });
        const res = await istek('PATCH', `/git/refs/${ref}`, { sha: c.sha, force: false });
        if (res.ok) return { commit: c.sha, veri: h.veri };
        if (res.status !== 422 && res.status !== 409) throw new GithubHatasi('diger', `GitHub dalı güncellenemedi (${res.status}).`);
      }
      throw new GithubHatasi('cakisma', 'Başka bir değişiklik aynı anda yapıldı. Lütfen tekrar deneyin.');
    },
  };
}
