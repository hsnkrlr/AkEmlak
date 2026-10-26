import { useState } from 'react';
import { cikisYap, girisYap } from './firebase';
import { IkonGoogle } from './ikonlar';

export function Giris({ hata }: { hata?: string | null }) {
  const [bekle, setBekle] = useState(false);
  const [yerelHata, setYerelHata] = useState('');
  return (
    <div className="y-giris">
      <img src="/logo.webp" alt="Ak Emlak" width={220} height={58} />
      <h1>Yönetim</h1>
      <p className="y-soluk">Başvuruları ve ilanları yönetmek için yetkili Google hesabınızla giriş yapın.</p>
      <button
        type="button"
        className="y-btn y-btn-google"
        disabled={bekle}
        onClick={async () => {
          setBekle(true);
          setYerelHata('');
          try {
            await girisYap();
          } catch {
            setYerelHata('Giriş başlatılamadı. Lütfen tekrar deneyin.');
            setBekle(false);
          }
        }}
      >
        <IkonGoogle /> {bekle ? 'Google’a yönlendiriliyor…' : 'Google ile giriş yap'}
      </button>
      {(hata || yerelHata) && <p className="y-hata" role="alert">{hata || yerelHata}</p>}
    </div>
  );
}

export function Yetkisiz({ email }: { email?: string }) {
  return (
    <div className="y-giris">
      <img src="/logo.webp" alt="Ak Emlak" width={220} height={58} />
      <h1>Bu hesabın yetkisi yok</h1>
      <p className="y-soluk">
        <b>{email || 'Bu hesap'}</b> yönetim uygulamasını kullanamaz. Yetkili bir Google hesabıyla giriş yapın.
      </p>
      <button type="button" className="y-btn" onClick={() => void cikisYap()}>
        Çıkış yap
      </button>
    </div>
  );
}
