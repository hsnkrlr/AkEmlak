import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { isWhatsappConfigured } from '../../config';
import { getImageBlob } from '../../data/draft';
import { formatCountdown } from '../../lib/format';
import { getSession, type AdminSession } from '../../security/auth';
import { ImageSourceProvider } from '../../components/ImageSource';
import { Logo } from '../../components/Layout';
import AdminLogin from './AdminLogin';
import AdminList from './AdminList';
import ListingEditor from './ListingEditor';
import PublishPanel from './PublishPanel';
import AdminPreview from './AdminPreview';
import { SessionProvider, useAdmin } from './session';

/** Oturum yokken /admin tamamen boş bir sayfa gibi görünür; hiçbir ipucu vermez. */
function Blank() {
  useEffect(() => {
    const prev = document.title;
    document.title = '‎';
    document.body.classList.add('blank');
    return () => {
      document.title = prev;
      document.body.classList.remove('blank');
    };
  }, []);
  return null;
}

function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
}

const objectUrls = new Map<string, string>();
const draftImage = async (name: string, thumb: boolean) => {
  const key = `${name}|${thumb}`;
  const hit = objectUrls.get(key);
  if (hit) return hit;
  const blob = await getImageBlob(name, thumb);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
};

function Gate() {
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getSession().then((s) => alive && setSession(s));
    return () => {
      alive = false;
    };
  }, []);
  if (!session) return <Blank />;
  return (
    <SessionProvider session={session}>
      <ImageSourceProvider resolve={draftImage}>
        <Shell />
      </ImageSourceProvider>
    </SessionProvider>
  );
}

function SyncBadge() {
  const { sync, requestSync } = useAdmin();
  const label = {
    checking: '…',
    disconnected: '⚠ Siteye bağlı değil',
    syncing: '⏳ Gönderiliyor',
    done: '✓ Sitede kayıtlı',
    error: '⚠ Gönderilemedi',
  }[sync.status];
  return (
    <button
      type="button"
      className={`sync-pill sync-${sync.status}`}
      title={sync.message}
      onClick={() => sync.status === 'error' && requestSync()}
      aria-live="polite"
    >
      {label}
    </button>
  );
}

function SyncBanner() {
  const { sync, requestSync } = useAdmin();
  if (sync.status === 'disconnected') {
    return (
      <div className="alert alert-err row-between">
        <span>
          <b>Site bağlantısı kurulmadı.</b> Eklediğiniz ilanlar şu an yalnızca bu cihazda kayıtlı; müşteriler göremez. Bir
          kereliğine bağlantıyı kurun, sonrasında her kayıt otomatik olarak siteye gider.
        </span>
        <Link to="/admin/yayinla" className="btn btn-primary btn-sm">
          Bağlantıyı kur
        </Link>
      </div>
    );
  }
  if (sync.status === 'error') {
    return (
      <div className="alert alert-err row-between">
        <span>
          <b>Değişiklikler siteye gönderilemedi.</b> {sync.message} Verileriniz bu cihazda güvende; tekrar deneyebilirsiniz.
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={requestSync}>
          Tekrar dene
        </button>
      </div>
    );
  }
  return null;
}

function Shell() {
  const { remaining, signOut } = useAdmin();
  const low = remaining < 60_000;
  const confirmLeave = useCallback(() => void signOut(), [signOut]);
  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="container admin-bar-inner">
          <Logo />
          <nav className="admin-nav" aria-label="Yönetim menüsü">
            <NavLink to="/admin" end>
              İlanlar
            </NavLink>
            <NavLink to="/admin/yeni">+ Yeni İlan</NavLink>
            <NavLink to="/admin/yayinla">Site Bağlantısı</NavLink>
          </nav>
          <div className="admin-bar-right">
            <SyncBadge />
            <span className={`session-pill ${low ? 'low' : ''}`} title="Güvenlik için oturum 15 dakika sonra kapanır">
              ⏱ {formatCountdown(remaining)}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={confirmLeave}>
              Çıkış
            </button>
          </div>
        </div>
      </header>
      {low && (
        <div className="container">
          <div className="alert alert-warn">Oturumunuz 1 dakika içinde kapanacak. Kaydedilmemiş değişikliklerinizi şimdi kaydedin.</div>
        </div>
      )}
      <div className="container">
        <SyncBanner />
      </div>
      {!isWhatsappConfigured() && (
        <div className="container">
          <div className="alert alert-warn">
            WhatsApp numarası henüz ayarlanmamış. <code>src/config.ts</code> dosyasındaki <code>whatsappNumber</code> değerini
            güncelleyin.
          </div>
        </div>
      )}
      <main className="container admin-main">
        <Routes>
          <Route index element={<AdminList />} />
          <Route path="yeni" element={<ListingEditor />} />
          <Route path="duzenle/:id" element={<ListingEditor />} />
          <Route path="onizle/:id" element={<AdminPreview />} />
          <Route path="yayinla" element={<PublishPanel />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
      <footer className="container admin-foot small muted">
        <Link to="/" target="_blank" rel="noopener">
          Siteyi yeni sekmede görüntüle ↗
        </Link>
      </footer>
    </div>
  );
}

export default function AdminApp() {
  useNoIndex();
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
}
