/**
 * Yazarken otomatik büyük harf: başlıkta her kelimenin, açıklamada her cümlenin ilk harfi.
 * Yalnızca tek karakter yazıldığında uygulanır (yapıştırma ve silmeye dokunmaz). Kullanıcı otomatik
 * büyütülen harfi silerse o konum hatırlanır ve tekrar yazdığında küçük bırakılır.
 */
export interface BuyukHarfDurumu {
  /** Kullanıcının otomatik büyük harfi geri aldığı konumlar */
  iptal: Set<number>;
  /** Son otomatik büyütülen konum */
  son?: number;
}

const harf = /\p{Ll}/u;

export function buyukHarfUygula(onceki: string, yeni: string, mod: 'kelime' | 'cumle', d: BuyukHarfDurumu): string {
  // Silme: otomatik büyütülen harf silindiyse bir daha o konumda büyütme
  if (yeni.length === onceki.length - 1 && d.son !== undefined) {
    const i = [...onceki].findIndex((c, k) => c !== yeni[k]);
    const silinen = i === -1 ? onceki.length - 1 : i;
    if (silinen === d.son) d.iptal.add(silinen);
    return yeni;
  }
  if (yeni.length !== onceki.length + 1) return yeni;
  let i = 0;
  while (i < onceki.length && onceki[i] === yeni[i]) i++;
  if (yeni.slice(i + 1) !== onceki.slice(i)) return yeni;
  const c = yeni[i];
  if (!harf.test(c) || d.iptal.has(i)) return yeni;
  const once = yeni.slice(0, i);
  const bas = mod === 'kelime' ? i === 0 || /\s$/.test(once) : i === 0 || /[.!?]\s+$/.test(once) || /\n\s*$/.test(once);
  if (!bas) return yeni;
  d.son = i;
  return once + c.toLocaleUpperCase('tr-TR') + yeni.slice(i + 1);
}
