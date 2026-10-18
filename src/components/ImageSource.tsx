import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { imageUrl } from '../lib/format';

/**
 * İlan görsellerinin nereden okunacağını belirler. Ziyaretçi sitesi yayındaki dosyaları,
 * yönetici önizlemesi ise tarayıcıdaki (IndexedDB) taslak görselleri kullanır.
 */
type Resolver = (name: string, thumb: boolean) => Promise<string | undefined> | string | undefined;

const Ctx = createContext<Resolver>((name, thumb) => imageUrl(name, thumb));

export function ImageSourceProvider({ resolve, children }: { resolve: Resolver; children: ReactNode }) {
  return <Ctx.Provider value={resolve}>{children}</Ctx.Provider>;
}

export function useImageSrc(name: string | undefined, thumb = false): string | undefined {
  const resolve = useContext(Ctx);
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!name) return undefined;
    const r = resolve(name, thumb);
    return typeof r === 'string' ? r : undefined;
  });
  useEffect(() => {
    if (!name) return setSrc(undefined);
    let alive = true;
    Promise.resolve(resolve(name, thumb)).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [name, thumb, resolve]);
  return src;
}
