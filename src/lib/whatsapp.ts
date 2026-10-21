import { SITE, siteOrigin } from '../config';
import type { Listing } from '../types';

function waLink(text: string): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export function listingUrl(l: Pick<Listing, 'slug'>): string {
  return `${siteOrigin()}/detay/${l.slug}`;
}

/** İlan adı, numarası ve bağlantısıyla sade WhatsApp mesajı. */
export function listingWhatsappLink(l: Listing): string {
  const ask = l.price > 0 ? 'hakkında bilgi almak istiyorum.' : 'hakkında fiyat ve detay bilgisi almak istiyorum.';
  const lines = [`Merhaba, "${l.title}" ilanınız ${ask}`, l.code ? `İlan No: ${l.code}` : null, listingUrl(l)];
  return waLink(lines.filter(Boolean).join('\n'));
}

export function generalWhatsappLink(): string {
  return waLink('Merhaba, ilanlarınız hakkında bilgi almak istiyorum.');
}
