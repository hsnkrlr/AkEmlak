import { useState } from 'react';
import { TYPE_LABEL, type ApplyType } from '../../lib/apply';
import { DURUMLAR, goreliZaman, useBasvurular, useFoto, type Basvuru, type BasvuruDurum } from './veri';

let sonFiltre: BasvuruDurum = 'yeni';

export default function BasvuruListesi() {
  const [durum, setDurum] = useState<BasvuruDurum>(sonFiltre);
  const { liste, sayilar, hata } = useBasvurular(durum);
  return (
    <section>
      <h1 className="y-baslik">Başvurular</h1>
      <div className="y-cipler" role="tablist" aria-label="Duruma göre">
        {DURUMLAR.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={durum === d.key}
            className={`y-cip ${durum === d.key ? 'on' : ''}`}
            onClick={() => setDurum((sonFiltre = d.key))}
          >
            {d.ad}
            {sayilar[d.key] !== undefined && <span className="y-sayi">{sayilar[d.key]}</span>}
          </button>
        ))}
      </div>
      {hata && <p className="y-hata">{hata}</p>}
      {liste === null && !hata && <p className="y-bos">Yükleniyor…</p>}
      {liste?.length === 0 && <p className="y-bos">Bu durumda başvuru yok.</p>}
      {liste && liste.length > 0 && (
        <ul className="y-liste">
          {liste.map((b) => (
            <li key={b.id}>
              <BasvuruKarti b={b} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const konumOf = (l: Record<string, unknown>) =>
  [l.neighborhood, l.district, l.city].filter((v) => typeof v === 'string' && v.trim()).join(', ');

function BasvuruKarti({ b }: { b: Basvuru }) {
  const kapak = useFoto(b.photos[0]);
  const rev = b.resubmission?.revision ?? 0;
  return (
    <a href={`#/basvuru/${b.id}`} className="y-kart y-satir">
      {kapak ? <img className="y-satir-foto" src={kapak} alt="" /> : <span className="y-satir-foto">{b.photos.length ? '…' : 'Foto yok'}</span>}
      <span className="y-satir-govde">
        <b>
          {TYPE_LABEL[b.listing.type as ApplyType] ?? 'İlan'}
          {b.listing.deal === 'kiralik' ? ' · Kiralık' : b.listing.deal === 'satilik' ? ' · Satılık' : ''}
        </b>
        <span className="y-soluk y-kucuk">{konumOf(b.listing) || 'Konum belirtilmemiş'}</span>
        <span className="y-satir-alt">
          <span>{b.seller.name}</span>·<span>{goreliZaman(b.createdAt)}</span>
          {rev > 0 && <span className="y-etiket inceleniyor">{rev + 1}. sürüm</span>}
          {b.status === 'supheli' && <span className="y-etiket supheli">Şüpheli</span>}
        </span>
      </span>
    </a>
  );
}
