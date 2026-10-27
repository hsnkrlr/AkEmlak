/**
 * Nurdağı arama sayfaları (SEO): "Nurdağı kiralık ev", "Nurdağı satılık arsa", "Nurdağı Esenyurt Mahallesi emlak" gibi
 * aramalara karşılık gelen sayfalar. Hem tarayıcıda (/emlak/:slug) hem derlemede (hazır HTML + sitemap) kullanılır.
 */
import { SITE } from '../config';
import type { Category, DealType, Listing } from '../types';
import { slugify } from './format';

export const BOLGE = 'Nurdağı';

export interface Landing {
  slug: string;
  /** Sayfa başlığı (h1) */
  h1: string;
  title: string;
  description: string;
  /** Sayfanın üstündeki tanıtım paragrafları */
  intro: string[];
  match: (l: Listing) => boolean;
}

const KONUT: Category[] = ['daire', 'rezidans', 'villa', 'mustakil', 'yazlik'];
const ISYERI: Category[] = ['isyeri', 'ofis', 'depo'];
const VASITA: Category[] = ['otomobil', 'arazi_suv', 'motosiklet', 'ticari', 'is_makinesi'];

interface Sablon {
  key: string;
  ad: string;
  deal?: DealType;
  cats?: Category[];
  /** Arama niyetine özgü kısa açıklama */
  not: string;
}

const SABLONLAR: Sablon[] = [
  { key: 'emlak', ad: 'Emlak İlanları', not: 'satılık ve kiralık ev, daire, arsa, tarla, bahçe ve iş yeri ilanları' },
  { key: 'kiralik-ev', ad: 'Kiralık Ev', deal: 'kiralik', cats: KONUT, not: 'kiralık ev, daire ve müstakil ev ilanları' },
  { key: 'satilik-ev', ad: 'Satılık Ev', deal: 'satilik', cats: KONUT, not: 'satılık ev, daire ve müstakil ev ilanları' },
  { key: 'kiralik-daire', ad: 'Kiralık Daire', deal: 'kiralik', cats: ['daire', 'rezidans'], not: 'kiralık daire ve TOKİ konutu ilanları' },
  { key: 'satilik-daire', ad: 'Satılık Daire', deal: 'satilik', cats: ['daire', 'rezidans'], not: 'satılık daire ve TOKİ konutu ilanları' },
  { key: 'kiralik-mustakil-ev', ad: 'Kiralık Müstakil Ev', deal: 'kiralik', cats: ['mustakil', 'villa'], not: 'bahçeli, kiralık müstakil ev ilanları' },
  { key: 'satilik-mustakil-ev', ad: 'Satılık Müstakil Ev', deal: 'satilik', cats: ['mustakil', 'villa'], not: 'bahçeli, satılık müstakil ev ilanları' },
  { key: 'satilik-arsa', ad: 'Satılık Arsa', deal: 'satilik', cats: ['arsa'], not: 'imarlı ve yola cepheli satılık arsa ilanları' },
  { key: 'satilik-tarla-bahce', ad: 'Satılık Tarla ve Bahçe', deal: 'satilik', cats: ['tarla'], not: 'fıstık bahçesi, zeytinlik, bağ ve tarla ilanları' },
  { key: 'kiralik-dukkan', ad: 'Kiralık Dükkan ve İş Yeri', deal: 'kiralik', cats: ISYERI, not: 'cadde üzeri kiralık dükkan, ofis ve depo ilanları' },
  { key: 'satilik-dukkan', ad: 'Satılık Dükkan ve İş Yeri', deal: 'satilik', cats: ISYERI, not: 'satılık dükkan, ofis ve depo ilanları' },
  { key: 'satilik-arac', ad: 'Satılık Araç', deal: 'satilik', cats: VASITA, not: 'ikinci el otomobil, arazi aracı ve ticari araç ilanları' },
];

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');
const bolgede = (l: Listing) => !l.district || norm(l.district).includes(norm(BOLGE));
/** "Esenyurt Mahallesi" / "Esenyurt Mah." → "Esenyurt" */
const mahalleAdi = (m: string) => m.replace(/\s+(mahallesi|mah\.?)$/i, '').trim();

function sablonSayfa(s: Sablon): Landing {
  const baslik = `${BOLGE} ${s.ad}`;
  return {
    slug: `${slugify(BOLGE)}-${s.key}`,
    h1: `${baslik}`,
    title: `${baslik} | ${SITE.name}`,
    description: `${BOLGE}, ${SITE.city} bölgesinde güncel ${s.not}. Fotoğraflı ilanlar, ${SITE.name} ile WhatsApp'tan hemen bilgi alın.`,
    intro: [
      `${BOLGE} ve çevresindeki güncel ${s.not} bu sayfada. İlanların tamamı ${SITE.name} tarafından yerinde görülerek yayınlanır.`,
      `Aradığınız özellikte bir ${norm(s.ad)} bulamadıysanız isteğinizi WhatsApp'tan yazın; uygun ilan çıktığında size ilk biz haber verelim.`,
    ],
    match: (l) => bolgede(l) && (!s.deal || l.dealType === s.deal) && (!s.cats || s.cats.includes(l.category)),
  };
}

function mahalleSayfa(ad: string): Landing {
  const baslik = `${BOLGE} ${ad} Mahallesi`;
  return {
    slug: `${slugify(BOLGE)}-${slugify(ad)}-mahallesi-emlak`,
    h1: `${baslik} Satılık ve Kiralık İlanlar`,
    title: `${baslik} Satılık, Kiralık Ev ve Daire | ${SITE.name}`,
    description: `${baslik} (${SITE.city}) satılık ve kiralık ev, daire ve arsa ilanları. Konum, fiyat ve fotoğraflarıyla; ${SITE.name} ile hemen bilgi alın.`,
    intro: [
      `${baslik}nde yayındaki satılık ve kiralık ilanlar. Mahallenin konumu, ulaşımı ve çevresi hakkında da bilgi almak için bize yazabilirsiniz.`,
      `${ad} Mahallesi'nde ev veya arsa arıyorsanız isteğinizi bırakın; yeni ilan çıktığında haber verelim.`,
    ],
    match: (l) => bolgede(l) && norm(mahalleAdi(l.neighborhood)) === norm(ad),
  };
}

/** Tüm arama sayfaları: sabit tür sayfaları + ilanı olan her mahalle için bir sayfa */
export function aramaSayfalari(listings: Listing[]): Landing[] {
  const mahalleler = Array.from(new Set(listings.filter(bolgede).map((l) => mahalleAdi(l.neighborhood)).filter(Boolean)));
  return [...SABLONLAR.map(sablonSayfa), ...mahalleler.map(mahalleSayfa)];
}

export function aramaSayfasi(listings: Listing[], slug: string): Landing | undefined {
  return aramaSayfalari(listings).find((p) => p.slug === slug);
}
