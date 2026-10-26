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

export interface IlanlarSonucu {
  ilanlar: IlanKaydi[];
  /** ilanNo → sürüm; düzenleme kaydedilirken geri gönderilir (arada başkası değiştirdiyse kayıt reddedilir) */
  surumler: Record<string, string>;
}

let onbellek: Promise<IlanlarSonucu> | null = null;

/** Güncel ilanlar (GitHub'daki data.json). `yenile` ile önbellek atlanır. */
export function ilanlariGetir(yenile = false): Promise<IlanlarSonucu> {
  if (!onbellek || yenile) {
    onbellek = httpsCallable<unknown, IlanlarSonucu>(functions, 'ilanlariGetir')({}).then((r) => r.data);
    onbellek.catch(() => (onbellek = null));
  }
  return onbellek;
}

/** Her kayıt/işlem için bir kez üretilir; bağlantı koptuktan sonra tekrar denemede aynı kimlik gönderilir */
export const istekKimligi = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36);

export async function ilanKaydet(req: { ilan: IlanTaslak; ilanNo?: string; surum?: string; fotograflar: FotoGirdi[]; basvuruId?: string; istekId: string }) {
  const r = await httpsCallable<typeof req, { ilanNo: string; baglanti: string; commit: string }>(functions, 'ilanKaydet', { timeout: 120_000 })(req);
  onbellek = null;
  return r.data;
}

export async function ilanIslem(ilanNo: string, islem: IlanIslem, istekId: string) {
  const r = await httpsCallable<{ ilanNo: string; islem: IlanIslem; istekId: string }, { commit: string }>(functions, 'ilanIslem', { timeout: 120_000 })({ ilanNo, islem, istekId });
  onbellek = null;
  return r.data;
}

/** data.json'da elle yazılmış eşdeğer değerler (sitenin kabul ettiği yazımlar) */
export function durumOf(d: unknown): 'yayinda' | 'satildi' | 'gizli' {
  const v = String(d ?? '').toLocaleLowerCase('tr-TR');
  if (['satildi', 'satıldı', 'kiralandi', 'kiralandı'].includes(v)) return 'satildi';
  if (['gizli', 'taslak'].includes(v)) return 'gizli';
  return 'yayinda';
}
export const turOf = (t: unknown): 'satilik' | 'kiralik' => (['kiralik', 'kiralık'].includes(String(t ?? '').toLocaleLowerCase('tr-TR')) ? 'kiralik' : 'satilik');
