import { httpsCallable } from 'firebase/functions';
import type { IlanTaslak } from '../donustur';
import { functions } from '../firebase';

export { hataMetni } from '../hata';

/** data.json'daki bir ilan (elle eklenmiş bilinmeyen alanlar da gelebilir) */
export interface IlanKaydi extends IlanTaslak {
  ilanNo?: string;
  fotograflar?: string[];
  tarih?: string;
  [k: string]: unknown;
}
export type IlanIslem = 'yayinda' | 'satildi' | 'gizli' | 'firsat' | 'firsatKaldir' | 'sil';
export type FotoGirdi = { mevcut: string } | { yukleme: string } | { basvuru: string };

let onbellek: Promise<IlanKaydi[]> | null = null;

/** Güncel ilanlar (GitHub'daki data.json). `yenile` ile önbellek atlanır. */
export function ilanlariGetir(yenile = false): Promise<IlanKaydi[]> {
  if (!onbellek || yenile) {
    onbellek = httpsCallable<unknown, { ilanlar: IlanKaydi[] }>(functions, 'ilanlariGetir')({}).then((r) => r.data.ilanlar);
    onbellek.catch(() => (onbellek = null));
  }
  return onbellek;
}

export async function ilanKaydet(req: { ilan: IlanTaslak; ilanNo?: string; fotograflar: FotoGirdi[]; basvuruId?: string }) {
  const r = await httpsCallable<typeof req, { ilanNo: string; baglanti: string; commit: string }>(functions, 'ilanKaydet', { timeout: 120_000 })(req);
  onbellek = null;
  return r.data;
}

export async function ilanIslem(ilanNo: string, islem: IlanIslem) {
  const r = await httpsCallable<{ ilanNo: string; islem: IlanIslem }, { commit: string }>(functions, 'ilanIslem', { timeout: 120_000 })({ ilanNo, islem });
  onbellek = null;
  return r.data;
}
