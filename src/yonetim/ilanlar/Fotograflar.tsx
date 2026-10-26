import { useRef, useState } from 'react';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { MAX_PHOTOS, preparePhoto } from '../../lib/apply';
import { storage } from '../firebase';
import type { FotoGirdi } from './api';

/** Düzenleyicideki bir fotoğraf: sitede olan, başvurudan gelen ya da şimdi yüklenen */
export type FotoSecim =
  | { anahtar: string; tur: 'mevcut'; ad: string; onizleme: string }
  | { anahtar: string; tur: 'basvuru'; yol: string; onizleme: string | null }
  | { anahtar: string; tur: 'yukleme'; yol: string | null; onizleme: string; hata?: string };

export const fotoGirdisi = (f: FotoSecim): FotoGirdi | null =>
  f.tur === 'mevcut' ? { mevcut: f.ad } : f.tur === 'basvuru' ? { basvuru: f.yol } : f.yol ? { yukleme: f.yol } : null;

const rastgele = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

export default function Fotograflar({
  uid,
  fotolar,
  degistir,
}: {
  uid: string;
  fotolar: FotoSecim[];
  degistir: (f: (onceki: FotoSecim[]) => FotoSecim[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [hatalar, setHatalar] = useState<string[]>([]);
  const kalan = MAX_PHOTOS - fotolar.length;

  async function ekle(files: FileList | null) {
    if (!files?.length) return;
    const secilen = [...files].slice(0, kalan);
    const yeniHatalar: string[] = files.length > kalan ? [`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir.`] : [];
    await Promise.all(
      secilen.map(async (file) => {
        const anahtar = rastgele();
        // Seçildiği anda listeye girer: hazırlanırken de "yükleniyor" sayılır ve kaydetme kilitli kalır
        degistir((o) => [...o, { anahtar, tur: 'yukleme', yol: null, onizleme: '' }]);
        try {
          const p = await preparePhoto(file);
          degistir((o) => o.map((f) => (f.anahtar === anahtar ? { ...f, onizleme: p.thumb } : f)));
          const yol = `yonetim/${uid}/${rastgele()}.${p.ext}`;
          await uploadBytes(ref(storage, yol), p.blob, { contentType: p.ext === 'webp' ? 'image/webp' : 'image/jpeg' });
          degistir((o) => o.map((f) => (f.anahtar === anahtar ? { ...f, yol } : f)));
        } catch (e) {
          degistir((o) => o.filter((f) => f.anahtar !== anahtar));
          yeniHatalar.push(e instanceof Error && e.message.startsWith('"') ? e.message : `"${file.name}" yüklenemedi.`);
        }
      }),
    );
    setHatalar(yeniHatalar);
    if (input.current) input.current.value = '';
  }

  function kaldir(f: FotoSecim) {
    degistir((o) => o.filter((x) => x.anahtar !== f.anahtar));
    if (f.tur === 'yukleme' && f.yol) void deleteObject(ref(storage, f.yol)).catch(() => undefined);
  }

  function tasi(i: number, yon: -1 | 1) {
    degistir((o) => {
      const j = i + yon;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  return (
    <div>
      {fotolar.length > 0 && (
        <ul className="y-fotolar">
          {fotolar.map((f, i) => (
            <li key={f.anahtar}>
              {f.onizleme ? <img src={f.onizleme} alt={`Fotoğraf ${i + 1}`} /> : null}
              {i === 0 && <span className="y-kapak">Kapak</span>}
              {f.tur === 'yukleme' && !f.yol && <span className="y-kapak" style={{ left: 'auto', right: 4 }}>Yükleniyor</span>}
              <div className="y-foto-arac">
                <button type="button" aria-label="Öne al" onClick={() => tasi(i, -1)} disabled={i === 0}>
                  ‹
                </button>
                <button type="button" aria-label="Fotoğrafı kaldır" onClick={() => kaldir(f)}>
                  ×
                </button>
                <button type="button" aria-label="Sona al" onClick={() => tasi(i, 1)} disabled={i === fotolar.length - 1}>
                  ›
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {hatalar.map((h) => (
        <p key={h} className="y-hata y-kucuk">
          {h}
        </p>
      ))}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void ekle(e.target.files)} />
      <button type="button" className="y-btn y-btn-blok" disabled={kalan <= 0} onClick={() => input.current?.click()}>
        {kalan > 0 ? `Fotoğraf ekle (${fotolar.length}/${MAX_PHOTOS})` : `En fazla ${MAX_PHOTOS} fotoğraf`}
      </button>
      <p className="y-soluk y-kucuk">İlk fotoğraf kapak olur. Sıralamak için ‹ › düğmelerini kullanın.</p>
    </div>
  );
}
