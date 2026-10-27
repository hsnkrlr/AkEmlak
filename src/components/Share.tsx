import { useState } from 'react';
import { IconFacebook, IconLink, IconShare, IconWhatsapp, IconX } from './Icons';

/** İlan paylaşım düğmeleri. `yuzen`: mobilde sağ kenarda sabit, kavisli dikey bar. */
export function Share({ url, title, yuzen = false }: { url: string; title: string; yuzen?: boolean }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const metin = `${title} – ${url}`;
  const yerel = typeof navigator !== 'undefined' && 'share' in navigator;
  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1800);
    } catch {
      /* pano kapalı */
    }
  };
  return (
    <div className={yuzen ? 'share share-float' : 'share'} role="group" aria-label="İlanı paylaş">
      {!yuzen && <span className="small muted">Paylaş</span>}
      {yuzen && yerel && (
        <button type="button" className="share-btn" aria-label="Paylaş" onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
          <IconShare width={18} height={18} />
        </button>
      )}
      <a className="share-btn wa" href={`https://wa.me/?text=${encodeURIComponent(metin)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp'ta paylaş">
        <IconWhatsapp width={18} height={18} />
      </a>
      <a className="share-btn fb" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Facebook'ta paylaş">
        <IconFacebook width={18} height={18} />
      </a>
      <a className="share-btn x" href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="X'te paylaş">
        <IconX width={16} height={16} />
      </a>
      <button type="button" className="share-btn" onClick={kopyala} aria-label="Bağlantıyı kopyala" title={kopyalandi ? 'Kopyalandı' : 'Bağlantıyı kopyala'}>
        {kopyalandi ? '✓' : <IconLink width={18} height={18} />}
      </button>
      {!yuzen && yerel && (
        <button type="button" className="share-btn" aria-label="Diğer uygulamalarla paylaş" onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
          <IconShare width={18} height={18} />
        </button>
      )}
    </div>
  );
}
