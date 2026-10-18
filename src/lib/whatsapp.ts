import { SITE, siteOrigin } from '../config';
import { DEAL_LABEL, type Listing } from '../types';
import { categoryLabel, formatLocation, formatPrice, groupOf, summaryFacts } from './format';

function waLink(text: string): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export function listingUrl(l: Pick<Listing, 'slug'>): string {
  return `${siteOrigin()}/detay/${l.slug}`;
}

/** İlan özeti + bağlantısıyla hazır WhatsApp mesajı. */
export function listingWhatsappLink(l: Listing): string {
  const facts = summaryFacts(l);
  const icon = { konut: '🏠', arsa: '🌳', isyeri: '🏢', vasita: '🚗', diger: '📦' }[groupOf(l)];
  const name = [l.brand, l.model].filter(Boolean).join(' ');
  const lines = [
    `Merhaba ${SITE.name}, bu ilanla ilgileniyorum:`,
    '',
    `${icon} ${l.title}`,
    `📌 ${DEAL_LABEL[l.dealType]} ${categoryLabel(l)}${name ? ` – ${name}` : ''}`,
    `📍 ${formatLocation(l)}`,
    `💰 ${formatPrice(l)}`,
    facts.length ? `📋 ${facts.join(' · ')}` : '',
    `🔖 İlan No: ${l.code}`,
    '',
    listingUrl(l),
  ].filter((line, i, arr) => line !== '' || arr[i - 1] !== '');
  return waLink(lines.join('\n'));
}

export function generalWhatsappLink(): string {
  return waLink(`Merhaba ${SITE.name}, ilanlarınız hakkında bilgi almak istiyorum.`);
}
