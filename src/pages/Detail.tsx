import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SITE } from '../config';
import { publicListings, useListings } from '../data/listings';
import { categoryLabel, fmtInt, formatDate, formatLocation, formatPrice, groupOf, soldLabel } from '../lib/format';
import { usePageMeta } from '../lib/usePageMeta';
import { listingDescription, listingTitle } from '../lib/seo';
import { listingUrl, listingWhatsappLink } from '../lib/whatsapp';
import { Gallery } from '../components/Gallery';
import { IconBack, IconLink, IconPin, IconWhatsapp } from '../components/Icons';
import { PublicLayout, TrustNotice } from '../components/Layout';
import { ListingCard } from '../components/ListingCard';
import { Share } from '../components/Share';
import { DEAL_LABEL, type Listing } from '../types';

export default function Detail() {
  const { slug } = useParams();
  const state = useListings();
  const all = publicListings(state);
  const listing = all.find((l) => l.slug === slug);

  usePageMeta(listing ? listingTitle(listing) : SITE.name, listing ? listingDescription(listing) : undefined);

  if (state.status === 'loading') {
    return (
      <PublicLayout>
        <div className="container section">
          <div className="detail-skeleton skeleton" />
        </div>
      </PublicLayout>
    );
  }

  if (!listing) {
    return (
      <PublicLayout>
        <div className="container section">
          <div className="empty">
            <h3>İlan bulunamadı</h3>
            <p>Bu ilan yayından kaldırılmış ya da bağlantı hatalı olabilir.</p>
            <Link className="btn btn-primary" to="/">
              Tüm ilanlara dön
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const similar = all
    .filter((l) => l.id !== listing.id && l.status === 'yayinda' && groupOf(l) === groupOf(listing))
    .slice(0, 3);

  return (
    <PublicLayout>
      <DetailView listing={listing} />
      {similar.length > 0 && (
        <section className="container section">
          <h2>Benzer İlanlar</h2>
          <div className="grid">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </PublicLayout>
  );
}

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function DetailView({ listing: l, backTo = '/', backLabel = 'Tüm ilanlar' }: { listing: Listing; backTo?: string; backLabel?: string }) {
  const sold = l.status === 'satildi';
  const group = groupOf(l);
  const [copied, setCopied] = useState(false);
  const wa = listingWhatsappLink(l);
  // Paylaşım için kısa bilgi: "Kiralık Müstakil Ev · Nurdağı · ₺8.000 / ay"
  const ozet = [`${DEAL_LABEL[l.dealType]} ${categoryLabel(l)}`, l.district || l.city, formatPrice(l)].filter(Boolean).join(' · ');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl(l));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano izni yok */
    }
  };

  return (
    <article className="container section detail">
      <Link to={backTo} className="back-link">
        <IconBack width={18} height={18} /> {backLabel}
      </Link>

      <div className="detail-grid">
        <div className="detail-main">
          <Gallery listing={l} />

          {l.description && (
            <section className="panel">
              <h2>Açıklama</h2>
              <div className="description">
                {l.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2>İlan Bilgileri</h2>
              <span className="panel-meta">
                {l.code && <>İlan No: <b>{l.code}</b></>}
                {l.createdAt && <> · {formatDate(l.createdAt)}</>}
              </span>
            </div>
            <dl className="facts">
              <Fact label="İlan Türü" value={DEAL_LABEL[l.dealType]} />
              <Fact label="Kategori" value={categoryLabel(l)} />
              {group === 'vasita' ? (
                <>
                  <Fact label="Marka" value={l.brand} />
                  <Fact label="Model" value={l.model} />
                  <Fact label="Model Yılı" value={l.modelYear} />
                  <Fact label="Kilometre" value={l.km === null ? null : `${fmtInt(l.km)} km`} />
                  <Fact label="Yakıt" value={l.fuel} />
                  <Fact label="Vites" value={l.gear} />
                  <Fact label="Renk" value={l.color} />
                </>
              ) : (
                <>
                  <Fact label={group === 'arsa' ? 'Alan (m²)' : 'Brüt m²'} value={l.grossM2 === null ? null : fmtInt(l.grossM2)} />
                  <Fact label="Net m²" value={l.netM2 === null ? null : fmtInt(l.netM2)} />
                  <Fact label="Oda Sayısı" value={l.rooms} />
                  <Fact label="Banyo" value={l.bathrooms} />
                  <Fact label="Bulunduğu Kat" value={l.floor} />
                  <Fact label="Bina Yaşı" value={l.buildingAge === null ? null : l.buildingAge === 0 ? 'Sıfır bina' : `${l.buildingAge} yıl`} />
                  <Fact label="Isıtma" value={l.heating} />
                  <Fact label="İmar Durumu" value={l.zoning} />
                  <Fact label="Tapu Durumu" value={l.deed} />
                  <Fact label="Ada / Parsel" value={l.parcel} />
                </>
              )}
            </dl>
          </section>

          {l.features.length > 0 && (
            <section className="panel">
              <h2>Özellikler</h2>
              <ul className="chips">
                {l.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="detail-side">
          {/* Bilgi kutusu ve güvenlik uyarısı birlikte sabitlenir; kaydırınca üst üste binmez */}
          <div className="sticky side-stack">
          <div className="panel">
            <div className="side-badges">
              <span className={`badge badge-${l.dealType}`}>{DEAL_LABEL[l.dealType]}</span>
              <span className="badge badge-soft">{categoryLabel(l)}</span>
              {sold && <span className="badge badge-sold">{soldLabel(l)}</span>}
            </div>
            <h1 className="detail-title">{l.title}</h1>
            <p className="detail-loc">
              <IconPin width={18} height={18} /> {formatLocation(l)}
            </p>
            <div className="detail-price">{formatPrice(l)}</div>

            <a className="btn btn-wa btn-lg btn-block" href={wa} target="_blank" rel="noopener noreferrer">
              <IconWhatsapp width={24} height={24} /> {sold ? 'Benzer ilanları sorun' : 'WhatsApp ile Bilgi Al'}
            </a>
            <p className="small muted center">İlan numarası ve bağlantısı mesaja otomatik eklenir.</p>

            <button type="button" className="btn btn-ghost btn-block" onClick={copy}>
              <IconLink width={18} height={18} /> {copied ? 'Bağlantı kopyalandı ✓' : 'İlan bağlantısını kopyala'}
            </button>
            <Share url={listingUrl(l)} title={l.title} ozet={ozet} />
          </div>
          <TrustNotice compact />
          </div>
        </aside>
      </div>

      <div className="mobile-only">
        <Share url={listingUrl(l)} title={l.title} ozet={ozet} yuzen />
      </div>

      <div className="mobile-cta">
        <div>
          <span className="small muted">{l.code}</span>
          <strong>{formatPrice(l)}</strong>
        </div>
        <a className="btn btn-wa" href={wa} target="_blank" rel="noopener noreferrer">
          <IconWhatsapp /> WhatsApp
        </a>
      </div>
    </article>
  );
}
