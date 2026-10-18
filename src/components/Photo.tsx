import { useImageSrc } from './ImageSource';
import type { Category } from '../types';
import { CATEGORY_LABEL } from '../types';

interface Props {
  name?: string;
  thumb?: boolean;
  alt: string;
  category?: Category;
  className?: string;
  eager?: boolean;
}

/** İlan fotoğrafı; fotoğraf yoksa zarif bir yer tutucu gösterir. */
export function Photo({ name, thumb = false, alt, category, className = '', eager = false }: Props) {
  const src = useImageSrc(name, thumb);
  if (!name) return <Placeholder category={category} className={className} />;
  return (
    <img
      className={`photo ${className}`}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

export function Placeholder({ category, className = '' }: { category?: Category; className?: string }) {
  return (
    <div className={`photo placeholder ${className}`} role="img" aria-label="Fotoğraf yakında eklenecek">
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <path d="M18 66V38l26-20 26 20v28" />
        <path d="M36 66V48h16v18" />
        <path d="M70 66V44l16-12 16 12v22" />
        <path d="M8 66h104" />
      </svg>
      <span>{category ? CATEGORY_LABEL[category] : 'Ak Emlak'}</span>
    </div>
  );
}
