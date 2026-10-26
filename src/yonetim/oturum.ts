import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, girisSonucu } from './firebase';

export type OturumDurumu = 'yukleniyor' | 'girissiz' | 'yetkisiz' | 'yetkili';
export interface Oturum {
  durum: OturumDurumu;
  email?: string;
  uid?: string;
  hata?: string | null;
}

/**
 * Oturum ve yetki durumu. Yetkili: Google ile girmiş, e-postası doğrulanmış ve `yetkililer/{eposta}` kaydı olan kişi.
 * (Asıl koruma güvenlik kuralları ve sunucu fonksiyonlarındadır; bu yalnızca doğru ekranı göstermek içindir.)
 */
export function useOturum(): Oturum {
  const [oturum, setOturum] = useState<Oturum>({ durum: 'yukleniyor' });
  useEffect(() => {
    let iptal = false;
    const hataP = girisSonucu();
    const unsub = onAuthStateChanged(auth, async (u) => {
      const hata = await hataP;
      if (iptal) return;
      if (!u) return setOturum({ durum: 'girissiz', hata });
      const google = u.providerData.some((p) => p.providerId === 'google.com');
      let yetkili = false;
      if (google && u.emailVerified && u.email) {
        try {
          yetkili = (await getDoc(doc(db, 'yetkililer', u.email))).exists();
        } catch {
          yetkili = false;
        }
      }
      if (!iptal) setOturum({ durum: yetkili ? 'yetkili' : 'yetkisiz', email: u.email ?? undefined, uid: u.uid, hata });
    });
    return () => {
      iptal = true;
      unsub();
    };
  }, []);
  return oturum;
}

/** Yetkili kabuk içindeki ekranlar için giriş yapan kişinin bilgisi */
export const YetkiliBaglami = createContext<{ email: string; uid: string }>({ email: '', uid: '' });
export const useYetkili = () => useContext(YetkiliBaglami);
