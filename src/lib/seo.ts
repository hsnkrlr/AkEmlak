/**
 * Arama motorları ve paylaşım önizlemeleri için başlık/açıklama metinleri.
 * Hem tarayıcıda (sayfa açıkken) hem de derlemede üretilen statik sayfalarda aynı metinler kullanılır.
 */
import { SITE } from '../config';
import { DEAL_LABEL, type Listing } from '../types';
import { categoryLabel, formatLocation, formatPrice, summaryFacts } from './format';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Bölgeler: ilanlardaki ilçeler + şehir (örn. "Nurdağı, Gaziantep") */
export function serviceArea(listings: Listing[]): string {
  const districts = Array.from(new Set(listings.map((l) => l.district).filter(Boolean)));
  return [...districts, SITE.city].join(', ');
}

export function homeTitle(): string {
  return `${SITE.name} | ${SITE.city} Satılık ve Kiralık Emlak İlanları`;
}

export function homeDescription(listings: Listing[]): string {
  const n = listings.filter((l) => l.status === 'yayinda').length;
  return clip(
    `${serviceArea(listings)} bölgesinde satılık ve kiralık ev, daire, arsa, iş yeri ve araç ilanları.` +
      (n ? ` ${n} güncel ilan.` : '') +
      ` ${SITE.name} ile WhatsApp üzerinden hemen bilgi alın.`,
  );
}

export function listingTitle(l: Listing): string {
  const place = l.district || l.city;
  const withPlace = place && !norm(l.title).includes(norm(place)) ? `${l.title} – ${place}` : l.title;
  return `${withPlace} | ${SITE.name}`;
}

export function listingDescription(l: Listing): string {
  const head = [`${DEAL_LABEL[l.dealType]} ${categoryLabel(l)}`, formatLocation(l), formatPrice(l), ...summaryFacts(l)].filter(Boolean).join(' · ');
  const body = l.description.replace(/\s+/g, ' ').trim();
  return clip(body ? `${head}. ${body}` : head);
}

/** Arama sonuçlarında kesilmemesi için ~160 karakterde, kelime sınırında kısaltır. */
function clip(s: string, max = 160): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30))}…`;
}
