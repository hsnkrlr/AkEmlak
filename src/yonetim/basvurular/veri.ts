import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getCountFromServer, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type Timestamp,
} from 'firebase/firestore';
import { getBlob, ref } from 'firebase/storage';
import { db, storage } from '../firebase';

export type BasvuruDurum = 'yeni' | 'inceleniyor' | 'onaylandi' | 'reddedildi' | 'supheli';
export const DURUMLAR: { key: BasvuruDurum; ad: string }[] = [
  { key: 'yeni', ad: 'Yeni' },
  { key: 'inceleniyor', ad: 'İnceleniyor' },
  { key: 'onaylandi', ad: 'Onaylandı' },
  { key: 'reddedildi', ad: 'Reddedildi' },
  { key: 'supheli', ad: 'Şüpheli' },
];
export const DURUM_ADI = Object.fromEntries(DURUMLAR.map((d) => [d.key, d.ad])) as Record<BasvuruDurum, string>;

export interface Basvuru {
  id: string;
  number: string;
  status: BasvuruDurum;
  createdAt: Date | null;
  seller: { name: string; phone: string; email?: string };
  listing: Record<string, unknown> & { type: string };
  photos: string[];
  resubmission?: { isResubmission: boolean; of: string | null; original: string | null; revision: number };
  kontrol?: { uyarilar?: string[] };
  inceleme?: { guncelleyen: string; guncellendi?: Date | null; ilanNo?: string; redSebebi?: string };
}

export interface Not {
  id: string;
  metin: string;
  yazan: string;
  tarih: Date | null;
}

const tarih = (v: unknown) => ((v as Timestamp | undefined)?.toDate ? (v as Timestamp).toDate() : null);

function basvuruOf(id: string, d: Record<string, unknown>): Basvuru {
  const inc = d.inceleme as Record<string, unknown> | undefined;
  return {
    id,
    number: String(d.number ?? ''),
    status: (d.status as BasvuruDurum) ?? 'yeni',
    createdAt: tarih(d.createdAt),
    seller: (d.seller as Basvuru['seller']) ?? { name: '', phone: '' },
    listing: (d.listing as Basvuru['listing']) ?? { type: 'diger' },
    photos: Array.isArray(d.photos) ? d.photos.filter((p): p is string => typeof p === 'string') : [],
    resubmission: d.resubmission as Basvuru['resubmission'],
    kontrol: d.kontrol as Basvuru['kontrol'],
    inceleme: inc ? { ...(inc as Basvuru['inceleme'])!, guncellendi: tarih(inc.guncellendi) } : undefined,
  };
}

/** Seçili durumdaki son 100 başvuru (canlı) ve her durumun sayısı */
export function useBasvurular(durum: BasvuruDurum) {
  const [liste, setListe] = useState<Basvuru[] | null>(null);
  const [hata, setHata] = useState('');
  const [sayilar, setSayilar] = useState<Partial<Record<BasvuruDurum, number>>>({});
  useEffect(() => {
    setListe(null);
    const q = query(collection(db, 'basvurular'), where('status', '==', durum), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(
      q,
      (s) => {
        setHata('');
        setListe(s.docs.map((d) => basvuruOf(d.id, d.data())));
      },
      () => setHata('Başvurular yüklenemedi. İnternet bağlantınızı kontrol edin.'),
    );
  }, [durum]);
  useEffect(() => {
    let iptal = false;
    void Promise.all(
      DURUMLAR.map(async ({ key }) => {
        const c = await getCountFromServer(query(collection(db, 'basvurular'), where('status', '==', key)));
        return [key, c.data().count] as const;
      }),
    )
      .then((r) => !iptal && setSayilar(Object.fromEntries(r)))
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [liste]);
  return { liste, sayilar, hata };
}

/** Tek başvuru (canlı). id verilmezse abone olunmaz. */
export function useBasvuru(id: string | null) {
  const [b, setB] = useState<Basvuru | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'basvurular', id),
      (s) => setB(s.exists() ? basvuruOf(s.id, s.data()) : null),
      () => setB(null),
    );
  }, [id]);
  return b;
}

export function durumYaz(id: string, email: string, status: BasvuruDurum, ek: { redSebebi?: string; ilanNo?: string } = {}) {
  return updateDoc(doc(db, 'basvurular', id), { status, inceleme: { guncelleyen: email, guncellendi: serverTimestamp(), ...ek } });
}

const fotoOnbellek = new Map<string, Promise<string>>();
/** Başvuru fotoğrafı (yalnızca yetkililer okuyabilir) → tarayıcı içi adres */
export function fotografUrl(yol: string): Promise<string> {
  let p = fotoOnbellek.get(yol);
  if (!p) {
    p = getBlob(ref(storage, yol)).then((b) => URL.createObjectURL(b));
    p.catch(() => fotoOnbellek.delete(yol));
    fotoOnbellek.set(yol, p);
  }
  return p;
}

export function useFoto(yol: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!yol) return;
    let iptal = false;
    fotografUrl(yol).then((u) => !iptal && setUrl(u), () => undefined);
    return () => {
      iptal = true;
    };
  }, [yol]);
  return url;
}

export function useNotlar(id: string) {
  const [notlar, setNotlar] = useState<Not[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'basvurular', id, 'notlar'), orderBy('tarih', 'asc')), (s) =>
        setNotlar(s.docs.map((d) => ({ id: d.id, metin: String(d.get('metin') ?? ''), yazan: String(d.get('yazan') ?? ''), tarih: tarih(d.get('tarih')) }))),
      ),
    [id],
  );
  return notlar;
}

export const notEkle = (id: string, email: string, metin: string) =>
  addDoc(collection(db, 'basvurular', id, 'notlar'), { metin: metin.trim().slice(0, 1000), yazan: email, tarih: serverTimestamp() });
export const notSil = (id: string, notId: string) => deleteDoc(doc(db, 'basvurular', id, 'notlar', notId));

/** "5 dk önce", "3 sa önce", "2 gün önce" ya da tarih */
export function goreliZaman(d: Date | null, simdi = Date.now()): string {
  if (!d) return 'şimdi';
  const dk = Math.round((simdi - d.getTime()) / 60000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  const gun = Math.round(sa / 24);
  if (gun < 7) return `${gun} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date(simdi).getFullYear() ? undefined : 'numeric' });
}
