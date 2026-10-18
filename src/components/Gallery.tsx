import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import type { Listing } from '../types';
import { IconCamera, IconChevron, IconClose } from './Icons';
import { Photo } from './Photo';

export function Gallery({ listing }: { listing: Listing }) {
  const images = listing.images;
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = images.length;

  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => setIndex(0), [listing.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, go]);

  const swipe = {
    onTouchStart: (e: TouchEvent) => (touchX.current = e.touches[0].clientX),
    onTouchEnd: (e: TouchEvent) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touchX.current = null;
    },
  };

  if (count === 0) {
    return (
      <div className="gallery">
        <div className="gallery-main">
          <Photo alt={listing.title} category={listing.category} />
        </div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-main" {...swipe}>
        <button type="button" className="gallery-open" onClick={() => setOpen(true)} aria-label="Fotoğrafı büyüt">
          <Photo name={images[index]} alt={`${listing.title} – fotoğraf ${index + 1}`} eager />
        </button>
        {count > 1 && (
          <>
            <button type="button" className="gallery-nav prev" onClick={() => go(-1)} aria-label="Önceki fotoğraf">
              <IconChevron dir="left" />
            </button>
            <button type="button" className="gallery-nav next" onClick={() => go(1)} aria-label="Sonraki fotoğraf">
              <IconChevron />
            </button>
          </>
        )}
        <span className="gallery-counter">
          <IconCamera width={15} height={15} /> {index + 1} / {count}
        </span>
      </div>
      {count > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Fotoğraflar">
          {images.map((name, i) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? 'active' : ''}
              onClick={() => setIndex(i)}
              aria-label={`Fotoğraf ${i + 1}`}
            >
              <Photo name={name} thumb alt="" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Fotoğraf görüntüleyici" onClick={() => setOpen(false)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()} {...swipe}>
            <Photo name={images[index]} alt={`${listing.title} – fotoğraf ${index + 1}`} eager />
          </div>
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Kapat">
            <IconClose width={26} height={26} />
          </button>
          {count > 1 && (
            <>
              <button type="button" className="lightbox-nav prev" onClick={(e) => (e.stopPropagation(), go(-1))} aria-label="Önceki">
                <IconChevron dir="left" width={30} height={30} />
              </button>
              <button type="button" className="lightbox-nav next" onClick={(e) => (e.stopPropagation(), go(1))} aria-label="Sonraki">
                <IconChevron width={30} height={30} />
              </button>
            </>
          )}
          <span className="lightbox-counter">
            {index + 1} / {count}
          </span>
        </div>
      )}
    </div>
  );
}
