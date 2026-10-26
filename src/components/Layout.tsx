import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../config';
import { resetConsent } from '../lib/consent';
import { generalWhatsappLink } from '../lib/whatsapp';
import { IconShield, IconWhatsapp } from './Icons';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label={`${SITE.name} ana sayfa`}>
      <img src="/logo.webp" alt={SITE.name} width={180} height={48} decoding="async" />
    </Link>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Logo />
        <nav className="header-nav" aria-label="Ana menü">
          <Link to="/#ilanlar">İlanlar</Link>
          <Link to="/ilan-basvurusu" className="btn btn-ghost btn-sm nav-apply">
            İlan Ver
          </Link>
          <a className="btn btn-wa btn-sm" href={generalWhatsappLink()} target="_blank" rel="noopener noreferrer">
            <IconWhatsapp /> <span>Bize Yazın</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

export function TrustNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`trust-notice ${compact ? 'compact' : ''}`} aria-label="Güvenlik uyarısı">
      <IconShield width={26} height={26} />
      <div>
        <strong>Dolandırıcılığa karşı dikkat</strong>
        <p>
          {SITE.name} yer göstermeden ve sözleşme imzalanmadan <b>hiçbir şekilde kapora veya ön ödeme istemez</b>.
          Resmi WhatsApp hattımız yalnızca <b className="nowrap">{SITE.phoneDisplay}</b> numarasıdır. Farklı numaralardan
          gelen mesajlara itibar etmeyin; ilan numarasını mutlaka bu siteden kontrol edin.
        </p>
      </div>
    </aside>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p className="muted">{SITE.slogan}</p>
        </div>
        <div className="footer-contact">
          <span className="muted">İletişim</span>
          <a href={generalWhatsappLink()} target="_blank" rel="noopener noreferrer" className="footer-wa">
            <IconWhatsapp /> {SITE.phoneDisplay}
          </a>
          <span className="muted small">{SITE.workingHours}</span>
        </div>
      </div>
      <div className="container footer-bottom muted small">
        <span>
          © {year} {SITE.name}. Tüm hakları saklıdır.
        </span>
        <nav className="footer-links" aria-label="Alt menü">
          <Link to="/ilan-basvurusu">İlan Ver</Link>
          <Link to="/kvkk">KVKK ve Çerezler</Link>
          <button type="button" className="link-btn" onClick={resetConsent}>
            Çerez tercihleri
          </button>
        </nav>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
