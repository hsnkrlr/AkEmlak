import { useState } from 'react';
import { useYetkili } from '../oturum';
import { goreliZaman, notEkle, notSil, useNotlar } from './veri';

export default function Notlar({ id }: { id: string }) {
  const { email } = useYetkili();
  const notlar = useNotlar(id);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState('');
  const [bekle, setBekle] = useState(false);
  return (
    <section className="y-kart y-bolum" aria-label="Notlar">
      <h2>Notlar</h2>
      {notlar.length === 0 && <p className="y-soluk y-kucuk">Henüz not yok.</p>}
      {notlar.map((n) => (
        <div key={n.id} className="y-not">
          <p>{n.metin}</p>
          <div className="y-not-ust">
            <span>
              {n.yazan.split('@')[0]} · {goreliZaman(n.tarih)}
            </span>
            {n.yazan === email && (
              <button type="button" className="y-link-btn" onClick={() => void notSil(id, n.id)}>
                Sil
              </button>
            )}
          </div>
        </div>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!metin.trim()) return;
          setBekle(true);
          setHata('');
          try {
            await notEkle(id, email, metin);
            setMetin('');
          } catch {
            setHata('Not kaydedilemedi. Tekrar deneyin.');
          } finally {
            setBekle(false);
          }
        }}
      >
        <label className="y-alan" style={{ marginTop: 10 }}>
          <span>Not ekle</span>
          <textarea value={metin} onChange={(e) => setMetin(e.target.value)} maxLength={1000} rows={2} placeholder="Örn. Yarın yerinde bakılacak" />
        </label>
        {hata && <p className="y-hata">{hata}</p>}
        <button type="submit" className="y-btn y-btn-kucuk" disabled={bekle || !metin.trim()}>
          Notu kaydet
        </button>
      </form>
    </section>
  );
}
