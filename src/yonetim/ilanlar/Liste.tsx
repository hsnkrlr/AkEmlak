import { useEffect, useState } from 'react';
import { CATEGORY_LABEL, type Category } from '../../types';
import { SITE } from '../../config';
import { slugify } from '../../lib/format';
import { Share } from '../../components/Share';
import { sqlUret } from '../../../functions/src/sql';
import { durumOf as durumNorm, hataMetni, ilanIslem, ilanlariGetir, istekKimligi, turOf, type IlanIslem, type IlanKaydi } from './api';

const fiyatOf = (i: IlanKaydi) => {
  const para = String(i.paraBirimi ?? '').toUpperCase();
  return !i.fiyat ? 'Fiyat için arayın' : `${new Intl.NumberFormat('tr-TR').format(Number(i.fiyat))} ${para === 'USD' ? '$' : para === 'EUR' ? '€' : 'TL'}${turOf(i.tur) === 'kiralik' ? ' / ay' : ''}`;
};
const durumOf = (i: IlanKaydi) => durumNorm(i.durum);
const DURUM_ADI = (i: IlanKaydi) => ({ yayinda: 'Yayında', satildi: turOf(i.tur) === 'kiralik' ? 'Kiralandı' : 'Satıldı', gizli: 'Gizli' })[durumOf(i)];

export default function IlanListesi() {
  const [ilanlar, setIlanlar] = useState<IlanKaydi[] | null>(null);
  const [hata, setHata] = useState('');
  const [acik, setAcik] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState('');

  const yukle = (yenile = false) => {
    setHata('');
    ilanlariGetir(yenile).then((r) => setIlanlar(r.ilanlar), (e) => setHata(hataMetni(e)));
  };
  useEffect(() => yukle(), []);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h1 className="y-baslik">İlanlar</h1>
        {ilanlar && ilanlar.length > 0 && (
          <button
            type="button"
            className="y-btn y-btn-kucuk"
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([sqlUret(ilanlar)], { type: 'application/sql' }));
              a.download = `ak-emlak-ilanlar-${new Date().toISOString().slice(0, 10)}.sql`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            SQL olarak indir
          </button>
        )}
      </div>
      {mesaj && <p className="y-basari">{mesaj}</p>}
      {hata && (
        <div className="y-hata">
          {hata}{' '}
          <button type="button" className="y-btn y-btn-kucuk" onClick={() => yukle(true)}>
            Tekrar dene
          </button>
        </div>
      )}
      {!ilanlar && !hata && <p className="y-bos">Yükleniyor…</p>}
      {ilanlar?.length === 0 && <p className="y-bos">Henüz ilan yok. Sağ üstten “Yeni ilan” ekleyin.</p>}
      {ilanlar && ilanlar.length > 0 && (
        <ul className="y-liste">
          {ilanlar.map((i, n) => {
            const anahtar = i.ilanNo ?? `#${n}`;
            return (
              <li key={anahtar} className="y-kart">
                <button type="button" className="y-satir" style={{ width: '100%', background: 'none', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setAcik(acik === anahtar ? null : anahtar)} aria-expanded={acik === anahtar}>
                  <Kapak ad={i.fotograflar?.[0]} />
                  <span className="y-satir-govde">
                    <b>{i.baslik}</b>
                    <span className="y-soluk y-kucuk">{fiyatOf(i)}</span>
                    <span className="y-satir-alt">
                      <span className={`y-etiket ${durumOf(i)}`}>{DURUM_ADI(i)}</span>
                      {i.firsat && <span className="y-etiket onaylandi">Fırsat</span>}
                      <span>{i.ilanNo ?? 'numarasız'}</span>
                      {i.kategori && <span>· {CATEGORY_LABEL[i.kategori as Category] ?? i.kategori}</span>}
                    </span>
                  </span>
                </button>
                {acik === anahtar && i.ilanNo && (
                  <Islemler
                    ilan={i}
                    bitti={(m) => {
                      setMesaj(m);
                      setAcik(null);
                      window.scrollTo(0, 0);
                      yukle(true);
                    }}
                  />
                )}
                {acik === anahtar && !i.ilanNo && (
                  <p className="y-soluk y-kucuk" style={{ padding: '0 12px 12px' }}>
                    Bu ilanın numarası (ilanNo) yok; uygulamadan düzenlemek için data.json'da numara verin.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Kapak({ ad }: { ad?: string }) {
  const [hata, setHata] = useState(false);
  if (!ad || hata) return <span className="y-satir-foto y-kucuk">{ad ? 'Hazırlanıyor' : 'Foto yok'}</span>;
  return <img className="y-satir-foto" src={`/img/${encodeURIComponent(ad)}`} alt="" loading="lazy" onError={() => setHata(true)} />;
}

function Islemler({ ilan, bitti }: { ilan: IlanKaydi; bitti: (mesaj: string) => void }) {
  const [bekle, setBekle] = useState<IlanIslem | null>(null);
  const [hata, setHata] = useState('');
  const no = ilan.ilanNo!;
  const d = durumOf(ilan);
  const satildiAdi = turOf(ilan.tur) === 'kiralik' ? 'Kiralandı' : 'Satıldı';
  // Bağlantı koptuktan sonra aynı düğmeye tekrar basılırsa aynı istek gider (işlem iki kez yapılmaz)
  const [istekler] = useState(() => new Map<IlanIslem, string>());

  async function yap(islem: IlanIslem, metin: string) {
    if (islem === 'sil' && !window.confirm(`${no} kalıcı olarak silinsin mi? Fotoğrafları da siteden kaldırılır.`)) return;
    setBekle(islem);
    setHata('');
    try {
      if (!istekler.has(islem)) istekler.set(islem, istekKimligi());
      await ilanIslem(no, islem, istekler.get(islem)!);
      bitti(`${no} ${metin}. Site 1–2 dakika içinde güncellenir.`);
    } catch (e) {
      setHata(hataMetni(e));
      setBekle(null);
    }
  }

  const dugme = (islem: IlanIslem, ad: string, metin: string, sinif = '') => (
    <button type="button" className={`y-btn ${sinif}`} disabled={bekle !== null} onClick={() => void yap(islem, metin)}>
      {bekle === islem ? 'İşleniyor…' : ad}
    </button>
  );

  return (
    <div style={{ padding: '0 12px 12px' }}>
      {hata && <p className="y-hata">{hata}</p>}
      <Share
        url={`${SITE.siteUrl}/detay/${ilan.baglanti || slugify(ilan.baslik)}`}
        title={ilan.baslik}
        ozet={[`${turOf(ilan.tur) === 'kiralik' ? 'Kiralık' : 'Satılık'} ${CATEGORY_LABEL[ilan.kategori as Category] ?? ''}`.trim(), String(ilan.ilce ?? ilan.il ?? ''), fiyatOf(ilan)].filter(Boolean).join(' · ')}
      />
      <div className="y-menu">
        <a className="y-btn y-btn-ana" href={`#/ilan/${encodeURIComponent(no)}`}>
          Düzenle
        </a>
        <div className="y-dugmeler">
          {d === 'satildi' ? dugme('yayinda', 'Tekrar yayına al', 'yeniden yayında') : dugme('satildi', `${satildiAdi} işaretle`, `${satildiAdi.toLocaleLowerCase('tr-TR')} olarak işaretlendi`)}
          {d === 'gizli' ? dugme('yayinda', 'Yayına al', 'yayına alındı') : dugme('gizli', 'Gizle', 'gizlendi')}
        </div>
        <div className="y-dugmeler">
          {ilan.firsat ? dugme('firsatKaldir', 'Fırsatı kaldır', 'fırsat etiketinden çıkarıldı') : dugme('firsat', 'Fırsat yap', 'fırsat olarak işaretlendi')}
          {dugme('sil', 'Sil', 'silindi', 'y-btn-tehlike')}
        </div>
      </div>
    </div>
  );
}
