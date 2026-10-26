import { useEffect, useState } from 'react';

/**
 * Yönetim uygulamasında adres # ile tutulur (#/basvuru/abc). Ana ekrana eklenen uygulamada ve Vercel
 * yönlendirmesinde tek bir sayfa (/yonetim/) yeterli olur.
 */
export type Rota =
  | { ad: 'basvurular' }
  | { ad: 'basvuru'; id: string }
  | { ad: 'basvuruIlan'; id: string }
  | { ad: 'ilanlar' }
  | { ad: 'ilanYeni' }
  | { ad: 'ilan'; id: string }
  | { ad: 'ayarlar' };

const KIMLIK = /^[A-Za-z0-9-]{1,64}$/;

export function rotaCoz(hash: string): Rota {
  const p = hash.replace(/^#\/?/, '').split('/');
  const id = p[1] ?? '';
  if (p[0] === 'basvuru' && KIMLIK.test(id) && p.length === 2) return { ad: 'basvuru', id };
  if (p[0] === 'basvuru' && KIMLIK.test(id) && p.length === 3 && p[2] === 'ilan') return { ad: 'basvuruIlan', id };
  if (p[0] === 'ilanlar' && p.length === 1) return { ad: 'ilanlar' };
  if (p[0] === 'ilan' && id === 'yeni' && p.length === 2) return { ad: 'ilanYeni' };
  if (p[0] === 'ilan' && KIMLIK.test(id) && p.length === 2) return { ad: 'ilan', id };
  if (p[0] === 'ayarlar' && p.length === 1) return { ad: 'ayarlar' };
  return { ad: 'basvurular' };
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => rotaCoz(window.location.hash));
  useEffect(() => {
    const f = () => {
      setRota(rotaCoz(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return rota;
}

export function git(yol: string): void {
  window.location.hash = yol;
}
