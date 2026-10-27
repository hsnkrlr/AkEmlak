import { Link, Navigate, useParams } from 'react-router-dom';
import { SITE } from '../config';
import { publicListings, useListings } from '../data/listings';
import { aramaSayfalari, aramaSayfasi } from '../lib/landing';
import { usePageMeta } from '../lib/usePageMeta';
import { generalWhatsappLink } from '../lib/whatsapp';
import { IconWhatsapp } from '../components/Icons';
import { ListingCard } from '../components/ListingCard';
import { PublicLayout, TrustNotice } from '../components/Layout';

/** Nurdağı arama sayfası: /emlak/nurdagi-kiralik-ev, /emlak/nurdagi-esenyurt-mahallesi-emlak … */
export default function Landing() {
  const { slug = '' } = useParams();
  const state = useListings();
  const all = publicListings(state);
  const sayfa = aramaSayfasi(all, slug);
  usePageMeta(sayfa?.title ?? SITE.name, sayfa?.description ?? '');
  if (state.status === 'loading') return <PublicLayout><div className="container section" aria-busy="true" /></PublicLayout>;
  if (!sayfa) return <Navigate to="/" replace />;
  const ilanlar = all.filter(sayfa.match).sort((a, b) => Number(a.status === 'satildi') - Number(b.status === 'satildi') || Number(b.featured) - Number(a.featured));
  const digerleri = aramaSayfalari(all).filter((p) => p.slug !== sayfa.slug);
  return (
    <PublicLayout>
      <section className="container section">
        <nav className="muted small" aria-label="Sayfa yolu">
          <Link to="/">{SITE.name}</Link> › {sayfa.h1}
        </nav>
        <h1>{sayfa.h1}</h1>
        {sayfa.intro.map((p) => (
          <p key={p} className="muted">{p}</p>
        ))}
        {ilanlar.length ? (
          <div className="grid">
            {ilanlar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <p><b>Şu an bu aramaya uygun yayında ilan yok.</b> İsteğinizi yazın, uygun ilan çıktığında size haber verelim.</p>
        )}
        <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          <a className="btn btn-wa" href={generalWhatsappLink()} target="_blank" rel="noopener noreferrer">
            <IconWhatsapp /> <span>İsteğimi WhatsApp'tan yaz</span>
          </a>
          <Link className="btn" to="/ilan-basvurusu">Mülkümü ilana ver</Link>
        </p>
        <TrustNotice compact />
        <h2>{SITE.name} – diğer aramalar</h2>
        <ul className="arama-linkleri">
          {digerleri.map((p) => (
            <li key={p.slug}><Link to={`/emlak/${p.slug}`}>{p.h1}</Link></li>
          ))}
        </ul>
      </section>
    </PublicLayout>
  );
}
