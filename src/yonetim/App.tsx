import type { ReactNode } from 'react';
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
  return (
    <div className="y-kabuk">
      <header className="y-ust">
        <a href="#/basvurular" className="y-logo" aria-label="Başvurular">
          <img src="/logo.webp" alt="Ak Emlak" width={132} height={35} />
        </a>
        <button type="button" className="y-btn y-btn-ana y-btn-kucuk" onClick={() => git('/ilan/yeni')}>
          <IkonArti size={18} /> Yeni ilan
        </button>
      </header>
      <main className="y-icerik">
        <Ekran rota={rota} />
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

function Ekran({ rota }: { rota: Rota }) {
  switch (rota.ad) {
    case 'ilanlar':
      return <Hazirlaniyor baslik="İlanlar" />;
    case 'ilan':
    case 'ilanYeni':
    case 'basvuruIlan':
      return <Hazirlaniyor baslik="İlan" />;
    case 'ayarlar':
      return <Hazirlaniyor baslik="Ayarlar" />;
    case 'basvuru':
      return <Hazirlaniyor baslik="Başvuru" />;
    default:
      return <Hazirlaniyor baslik="Başvurular" />;
  }
}

function Hazirlaniyor({ baslik }: { baslik: string }) {
  return (
    <section>
      <h1 className="y-baslik">{baslik}</h1>
    </section>
  );
}
