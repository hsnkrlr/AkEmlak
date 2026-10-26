import { useEffect, useState } from 'react';
import { TYPE_LABEL, type ApplyType } from '../../lib/apply';
import { IkonGeri, IkonTelefon, IkonWhatsapp } from '../ikonlar';
import { useYetkili } from '../oturum';
import { git } from '../router';
import { konumOf } from './Liste';
import Notlar from './Notlar';
import { DURUM_ADI, durumYaz, goreliZaman, useBasvuru, useFoto, type Basvuru } from './veri';

const ALANLAR: [string, string][] = [
  ['deal', 'Satılık / Kiralık'], ['price', 'Fiyat'], ['address', 'Adres tarifi'], ['grossM2', 'Brüt m²'], ['netM2', 'Net m²'],
  ['rooms', 'Oda'], ['floor', 'Kat'], ['buildingAge', 'Bina yaşı'], ['bathrooms', 'Banyo'], ['heating', 'Isıtma'],
  ['furnished', 'Eşyalı'], ['inSite', 'Site içinde'], ['zoning', 'İmar'], ['deed', 'Tapu'], ['parcel', 'Ada / Parsel'],
  ['brand', 'Marka'], ['model', 'Model'], ['modelYear', 'Model yılı'], ['km', 'Kilometre'], ['fuel', 'Yakıt'], ['gear', 'Vites'],
  ['features', 'Özellikler'],
];

function deger(k: string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (k === 'deal') return v === 'kiralik' ? 'Kiralık' : 'Satılık';
  if (k === 'price' && typeof v === 'number') return `${new Intl.NumberFormat('tr-TR').format(v)} TL`;
  if (typeof v === 'boolean') return v ? 'Evet' : 'Hayır';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return new Intl.NumberFormat('tr-TR').format(v);
  return String(v);
}

export default function BasvuruDetay({ id }: { id: string }) {
  const b = useBasvuru(id);
  const { email } = useYetkili();
  // Açılan yeni başvuru "inceleniyor" olur
  useEffect(() => {
    if (b && b.status === 'yeni') void durumYaz(b.id, email, 'inceleniyor').catch(() => undefined);
  }, [b?.id, b?.status, email]);

  if (b === undefined) return <p className="y-bos">Yükleniyor…</p>;
  if (b === null) return <p className="y-bos">Başvuru bulunamadı.</p>;
  return <Icerik b={b} email={email} />;
}

function Icerik({ b, email }: { b: Basvuru; email: string }) {
  const [buyuk, setBuyuk] = useState<string | null>(null);
  const [red, setRed] = useState(false);
  const [sebep, setSebep] = useState('');
  const [hata, setHata] = useState('');
  const l = b.listing;
  const tel = b.seller.phone.replace(/\D/g, '');
  const wa = `https://wa.me/${tel}?text=${encodeURIComponent(`Merhaba, ${b.number} numaralı ilan başvurunuzla ilgili yazıyorum.`)}`;
  const satirlar = ALANLAR.map(([k, ad]) => [ad, deger(k, l[k])] as const).filter(([, v]) => v);
  const uyarilar = b.kontrol?.uyarilar ?? [];

  return (
    <article>
      <button type="button" className="y-geri" onClick={() => (history.length > 1 ? history.back() : git('/basvurular'))}>
        <IkonGeri /> Başvurular
      </button>
      <h1 className="y-baslik" style={{ marginBottom: 4 }}>
        {TYPE_LABEL[l.type as ApplyType] ?? 'İlan'} · {b.number}
      </h1>
      <p className="y-satir-alt" style={{ margin: '0 0 12px' }}>
        <span className={`y-etiket ${b.status}`}>{DURUM_ADI[b.status]}</span>
        <span>{goreliZaman(b.createdAt)}</span>
        {(b.resubmission?.revision ?? 0) > 0 && (
          <span className="y-etiket inceleniyor">
            {b.resubmission!.revision + 1}. sürüm (önceki {b.resubmission!.of})
          </span>
        )}
      </p>

      {b.photos.length > 0 && (
        <section className="y-kart y-bolum">
          <h2>Fotoğraflar ({b.photos.length})</h2>
          <div className="y-galeri">
            {b.photos.map((p, i) => (
              <Foto key={p} yol={p} sira={i + 1} ac={setBuyuk} />
            ))}
          </div>
        </section>
      )}

      <section className="y-kart y-bolum">
        <h2>Satıcı</h2>
        <dl className="y-bilgi">
          <dt>Ad soyad</dt>
          <dd>{b.seller.name}</dd>
          <dt>Telefon</dt>
          <dd>{b.seller.phone}</dd>
          {b.seller.email && (
            <>
              <dt>E-posta</dt>
              <dd>{b.seller.email}</dd>
            </>
          )}
        </dl>
        <div className="y-dugmeler" style={{ marginTop: 12 }}>
          <a className="y-btn" href={`tel:+${tel}`}>
            <IkonTelefon /> Ara
          </a>
          <a className="y-btn y-btn-yesil" href={wa} target="_blank" rel="noopener noreferrer">
            <IkonWhatsapp /> WhatsApp
          </a>
        </div>
      </section>

      <section className="y-kart y-bolum">
        <h2>İlan bilgileri</h2>
        <dl className="y-bilgi">
          <dt>Konum</dt>
          <dd>{konumOf(l) || '—'}</dd>
          {satirlar.map(([ad, v]) => (
            <FragmentSatir key={ad} ad={ad} v={v} />
          ))}
        </dl>
        {typeof l.description === 'string' && l.description && <p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{l.description}</p>}
        {uyarilar.length > 0 && <p className="y-hata y-kucuk">Otomatik kontrol uyarıları: {uyarilar.join(', ')}</p>}
      </section>

      <Notlar id={b.id} />

      {b.status === 'onaylandi' && b.inceleme?.ilanNo && (
        <p className="y-basari">
          Bu başvuru <a href={`#/ilan/${b.inceleme.ilanNo}`}>{b.inceleme.ilanNo}</a> numaralı ilana dönüştürüldü.
        </p>
      )}
      {b.status === 'reddedildi' && (
        <p className="y-hata">
          Reddedildi{b.inceleme?.redSebebi ? `: ${b.inceleme.redSebebi}` : ''} ({b.inceleme?.guncelleyen.split('@')[0]})
        </p>
      )}
      {hata && <p className="y-hata">{hata}</p>}

      {b.status !== 'onaylandi' && (
        <div className="y-sabit-alt">
          {!red ? (
            <div className="y-dugmeler">
              <button type="button" className="y-btn y-btn-tehlike" onClick={() => setRed(true)} disabled={b.status === 'reddedildi'}>
                Reddet
              </button>
              <a className="y-btn y-btn-ana" href={`#/basvuru/${b.id}/ilan`}>
                İlana dönüştür
              </a>
            </div>
          ) : (
            <div className="y-kart y-bolum">
              <label className="y-alan">
                <span>Reddetme sebebi (isteğe bağlı)</span>
                <textarea value={sebep} onChange={(e) => setSebep(e.target.value)} maxLength={300} rows={2} />
              </label>
              <div className="y-dugmeler">
                <button type="button" className="y-btn" onClick={() => setRed(false)}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="y-btn y-btn-tehlike"
                  onClick={async () => {
                    setHata('');
                    try {
                      await durumYaz(b.id, email, 'reddedildi', sebep.trim() ? { redSebebi: sebep.trim() } : {});
                      setRed(false);
                    } catch {
                      setHata('Kaydedilemedi. Tekrar deneyin.');
                    }
                  }}
                >
                  Reddet
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {buyuk && (
        <div className="y-buyuk" role="dialog" aria-label="Fotoğraf" onClick={() => setBuyuk(null)}>
          <img src={buyuk} alt="" />
          <button type="button" className="y-btn y-btn-kucuk" onClick={() => setBuyuk(null)}>
            Kapat
          </button>
        </div>
      )}
    </article>
  );
}

function FragmentSatir({ ad, v }: { ad: string; v: string }) {
  return (
    <>
      <dt>{ad}</dt>
      <dd>{v}</dd>
    </>
  );
}

function Foto({ yol, sira, ac }: { yol: string; sira: number; ac: (u: string) => void }) {
  const url = useFoto(yol);
  return (
    <button type="button" onClick={() => url && ac(url)} aria-label={`Fotoğraf ${sira}`}>
      {url ? <img src={url} alt="" /> : null}
    </button>
  );
}
