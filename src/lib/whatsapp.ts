import { SITE, siteOrigin } from '../config';
import { CATEGORY_LABEL, DEAL_LABEL, type Listing } from '../types';
import { formatLocation, formatPrice } from './format';

function waLink(text: string): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export function listingUrl(l: Pick<Listing, 'slug'>): string {
  return `${siteOrigin()}/detay/${l.slug}`;
}

/** İlan özeti + bağlantısıyla hazır WhatsApp mesajı. */
export function listingWhatsappLink(l: Listing): string {
  const facts = [
    l.netM2 ? `${l.netM2} m² net` : l.grossM2 ? `${l.grossM2} m²` : '',
    l.rooms,
    l.floor,
  ].filter(Boolean);
  const lines = [
    `Merhaba ${SITE.name}, bu ilanla ilgileniyorum:`,
    '',
    `🏠 ${l.title}`,
    `📌 ${DEAL_LABEL[l.dealType]} ${CATEGORY_LABEL[l.category]}`,
    `📍 ${formatLocation(l)}`,
    `💰 ${formatPrice(l)}`,
    facts.length ? `📐 ${facts.join(' · ')}` : '',
    `🔖 İlan No: ${l.code}`,
    '',
    listingUrl(l),
  ].filter((line, i, arr) => line !== '' || arr[i - 1] !== '');
  return waLink(lines.join('\n'));
}

export function generalWhatsappLink(): string {
  return waLink(`Merhaba ${SITE.name}, ilanlarınız hakkında bilgi almak istiyorum.`);
}
