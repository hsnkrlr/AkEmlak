import { useEffect, useState } from 'react';
import { bildirimAc, bildirimDurumu, bildirimKapat, iphoneTarayicida, type BildirimDurumu } from './bildirim';
import { cikisYap } from './firebase';
import { useYetkili } from './oturum';

const DURUM_METNI: Record<BildirimDurumu, string> = {
  acik: 'Açık — yeni başvuru gelince bu cihaza bildirim gelir.',
  kapali: 'Kapalı',
  engelli: 'Bu tarayıcıda bildirimler engellenmiş. Tarayıcı ayarlarından bu siteye izin verin.',
  desteklenmiyor: 'Bu tarayıcı bildirimleri desteklemiyor.',
};

export default function Ayarlar() {
  const { email } = useYetkili();
  const [durum, setDurum] = useState<BildirimDurumu | null>(null);
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState('');
  const iphone = iphoneTarayicida();

  useEffect(() => {
    void bildirimDurumu(email).then(setDurum);
  }, [email]);

  async function degistir() {
    setBekle(true);
    setHata('');
    try {
      if (durum === 'acik') await bildirimKapat(email);
      else await bildirimAc(email);
      setDurum(await bildirimDurumu(email));
    } catch (e) {
      setHata(e instanceof Error && e.message ? e.message : 'İşlem tamamlanamadı. Tekrar deneyin.');
    } finally {
      setBekle(false);
    }
  }

  return (
    <section>
      <h1 className="y-baslik">Ayarlar</h1>

      <div className="y-kart y-bolum">
        <h2>Bildirimler</h2>
        {iphone ? (
          <p className="y-soluk">iPhone'da bildirim almak için önce uygulamayı ana ekrana ekleyin (aşağıda anlatılıyor), sonra ana ekrandaki simgeden açıp buradan bildirimleri açın.</p>
        ) : (
          <>
            <p className="y-soluk" aria-live="polite">
              {durum ? DURUM_METNI[durum] : 'Kontrol ediliyor…'}
            </p>
            {(durum === 'acik' || durum === 'kapali') && (
              <button type="button" className={`y-btn y-btn-blok ${durum === 'acik' ? '' : 'y-btn-ana'}`} disabled={bekle} onClick={() => void degistir()}>
                {bekle ? 'Bekleyin…' : durum === 'acik' ? 'Bu cihazda bildirimleri kapat' : 'Bu cihazda bildirimleri aç'}
              </button>
            )}
          </>
        )}
        {hata && <p className="y-hata">{hata}</p>}
      </div>

      <div className="y-kart y-bolum">
        <h2>Ana ekrana ekleme</h2>
        <p style={{ margin: '0 0 6px' }}>
          <b>iPhone (Safari):</b> alttaki Paylaş düğmesine dokunun → “Ana Ekrana Ekle” → Ekle.
        </p>
        <p style={{ margin: 0 }}>
          <b>Android (Chrome):</b> sağ üstteki ⋮ menüsü → “Ana ekrana ekle” ya da “Uygulamayı yükle”.
        </p>
      </div>

      <div className="y-kart y-bolum">
        <h2>Hesap</h2>
        <p style={{ margin: '0 0 12px' }}>
          Giriş yapan: <b>{email}</b>
        </p>
        <div className="y-menu">
          <a className="y-btn" href="/" target="_blank" rel="noopener noreferrer">
            Siteyi aç
          </a>
          <button type="button" className="y-btn y-btn-tehlike" onClick={() => void cikisYap()}>
            Çıkış yap
          </button>
        </div>
      </div>
    </section>
  );
}
