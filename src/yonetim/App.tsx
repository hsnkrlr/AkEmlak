import { useState, type ReactNode } from 'react';
import Ayarlar from './Ayarlar';
import BasvuruDetay from './basvurular/Detay';
import BasvuruListesi from './basvurular/Liste';
import Duzenleyici from './ilanlar/Duzenleyici';
import IlanListesi from './ilanlar/Liste';
import { Giris, Yetkisiz } from './Giris';
import { IkonArti, IkonAyar, IkonEv, IkonGelen } from './ikonlar';
import { useOturum, YetkiliBaglami } from './oturum';
import { git, useRota, type Rota } from './router';

export default function App() {
  const oturum = useOturum();
  if (oturum.durum === 'yukleniyor') return <div className="y-yukleniyor" aria-busy="true">Yükleniyor…</div>;
  if (oturum.durum === 'girissiz') return <Giris hata={oturum.hata} />;
  if (oturum.durum === 'yetkisiz') return <Yetkisiz email={oturum.email} />;
  return (
    <YetkiliBaglami.Provider value={{ email: oturum.email!, uid: oturum.uid! }}>
      <Kabuk />
    </YetkiliBaglami.Provider>
  );
}

type Sekme = 'basvurular' | 'ilanlar' | 'ayarlar';
const sekmeOf = (r: Rota): Sekme => (r.ad === 'ayarlar' ? 'ayarlar' : r.ad === 'ilanlar' || r.ad === 'ilan' || r.ad === 'ilanYeni' ? 'ilanlar' : 'basvurular');

function Kabuk() {
  const rota = useRota();
  const sekme = sekmeOf(rota);
  // "Yeni ilan" her basışta boş formla açılır (adres zaten #/ilan/yeni olsa bile)
  const [yeniSayac, setYeniSayac] = useState(0);
  const duzenleyicide = rota.ad === 'ilanYeni' || rota.ad === 'ilan' || rota.ad === 'basvuruIlan';
  return (
    <div className="y-kabuk">
      <header className="y-ust">
        <a href="#/basvurular" className="y-logo" aria-label="Başvurular">
          <img src="/logo.webp" alt="Ak Emlak" width={132} height={35} />
        </a>
        {!duzenleyicide && (
          <button
            type="button"
            className="y-btn y-btn-ana y-btn-kucuk"
            onClick={() => {
              setYeniSayac((n) => n + 1);
              git('/ilan/yeni');
            }}
          >
            <IkonArti size={18} /> Yeni ilan
          </button>
        )}
      </header>
      <main className="y-icerik">
        <Ekran rota={rota} yeniSayac={yeniSayac} />
      </main>
      <nav className="y-sekmeler" aria-label="Bölümler">
        <SekmeLink to="/basvurular" on={sekme === 'basvurular'} ikon={<IkonGelen />} ad="Başvurular" />
        <SekmeLink to="/ilanlar" on={sekme === 'ilanlar'} ikon={<IkonEv />} ad="İlanlar" />
        <SekmeLink to="/ayarlar" on={sekme === 'ayarlar'} ikon={<IkonAyar />} ad="Ayarlar" />
      </nav>
    </div>
  );
}

function SekmeLink({ to, on, ikon, ad }: { to: string; on: boolean; ikon: ReactNode; ad: string }) {
  return (
    <a href={`#${to}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
      {ikon}
      <span>{ad}</span>
    </a>
  );
}

function Ekran({ rota, yeniSayac }: { rota: Rota; yeniSayac: number }) {
  switch (rota.ad) {
    case 'ilanlar':
      return <IlanListesi />;
    case 'ilan':
      return <Duzenleyici key={rota.id} mod="duzenle" ilanNo={rota.id} />;
    case 'ilanYeni':
      return <Duzenleyici key={`yeni-${yeniSayac}`} mod="yeni" />;
    case 'basvuruIlan':
      return <Duzenleyici key={rota.id} mod="basvuru" basvuruId={rota.id} />;
    case 'ayarlar':
      return <Ayarlar />;
    case 'basvuru':
      return <BasvuruDetay key={rota.id} id={rota.id} />;
    default:
      return <BasvuruListesi />;
  }
}
