import { imageUrl, imageVariantUrl } from '../lib/format';
import { CATEGORY_GROUP, CATEGORY_LABEL, type Category } from '../types';

interface Props {
  name?: string;
  alt: string;
  category?: Category;
  className?: string;
  eager?: boolean;
  /** Görselin sayfada kaplayacağı genişlik; tarayıcı buna göre küçük/orta/tam kopyayı seçer */
  sizes?: string;
}

/** İlan fotoğrafı; fotoğraf yoksa zarif bir yer tutucu gösterir. */
export function Photo({ name, alt, category, className = '', eager = false, sizes = '(max-width: 640px) 100vw, 400px' }: Props) {
  if (!name) return <Placeholder category={category} className={className} />;
  return (
    <img
      className={`photo ${className}`}
      src={import.meta.env.PROD ? imageVariantUrl(name, 'o') : imageUrl(name)}
      srcSet={import.meta.env.PROD ? `${imageVariantUrl(name, 'k')} 480w, ${imageVariantUrl(name, 'o')} 1200w, ${imageUrl(name)} 1600w` : undefined}
      sizes={import.meta.env.PROD ? sizes : undefined}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

const PLACEHOLDER_ART = {
  konut: (
    <>
      <path d="M18 66V38l26-20 26 20v28" />
      <path d="M36 66V48h16v18" />
      <path d="M70 66V44l16-12 16 12v22" />
      <path d="M8 66h104" />
    </>
  ),
  isyeri: (
    <>
      <path d="M22 66V22h44v44M66 66V36h32v30" />
      <path d="M32 32h8M48 32h8M32 44h8M48 44h8M76 46h12M76 56h12M38 66V56h12v10" />
      <path d="M8 66h104" />
    </>
  ),
  arsa: (
    <>
      <path d="M8 66h104M14 66l22-26 16 14 18-24 36 36" />
      <path d="M86 26a6 6 0 1 0 0-.1" />
    </>
  ),
  vasita: (
    <>
      <path d="M14 56V46l10-14h44l14 14h18a6 6 0 0 1 6 6v4" />
      <path d="M14 56h10M44 56h30M96 56h10" />
      <circle cx="34" cy="57" r="9" />
      <circle cx="86" cy="57" r="9" />
      <path d="M30 34l-6 12h56l-12-12" />
      <path d="M8 66h104" />
    </>
  ),
  diger: (
    <>
      <path d="M30 30l30-12 30 12v30L60 72 30 60z" />
      <path d="M30 30l30 12 30-12M60 42v30" />
    </>
  ),
};

export function Placeholder({ category, className = '' }: { category?: Category; className?: string }) {
  return (
    <div className={`photo placeholder ${className}`} role="img" aria-label="Fotoğraf yakında eklenecek">
      <svg viewBox="0 0 120 80" aria-hidden="true">
        {PLACEHOLDER_ART[category ? CATEGORY_GROUP[category] : 'konut']}
      </svg>
      <span>{category ? CATEGORY_LABEL[category] : 'Ak Emlak'}</span>
    </div>
  );
}
