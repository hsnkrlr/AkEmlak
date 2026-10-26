/// <reference types="node" />
/**
 * SEO ön-üretimi (derleme sırasında çalışır).
 *
 * Site tek sayfa uygulaması olduğundan arama motorları ve WhatsApp/Facebook bağlantı önizlemeleri
 * içerik için JavaScript'in çalışmasını beklemeden sayfanın HTML'ine bakar. Bu eklenti
 * public/data.json'daki her ilan için hazır bir HTML sayfası üretir:
 *   dist/detay/<adres>/index.html  → başlık, açıklama, canonical, Open Graph, JSON-LD ve sayfa içeriği
 *   dist/index.html                → ana sayfa etiketleri ve ilan listesi
 *   dist/sitemap.xml, dist/robots.txt (Sitemap satırı)
 *
 * Tam adresler (canonical, og:url, sitemap) için sitenin alan adı gerekir. Sırasıyla:
 * SITE_URL ortam değişkeni → src/config.ts içindeki siteUrl → Vercel'in VERCEL_PROJECT_PRODUCTION_URL değişkeni.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { SITE } from '../src/config';
import { categoryLabel, fmtInt, formatLocation, formatPrice, groupOf, soldLabel, summaryFacts } from '../src/lib/format';
import { parseData } from '../src/lib/schema';
import { homeDescription, homeTitle, listingDescription, listingTitle, serviceArea } from '../src/lib/seo';
import { DEAL_LABEL, type Listing } from '../src/types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** JSON-LD'yi <script> içine güvenle gömer ("</script>" ile kaçamaz). */
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function siteOriginForBuild(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.SITE_URL || SITE.siteUrl || (vercel ? `https://${vercel}` : '')).replace(/\/+$/, '');
}

interface Page {
  title: string;
  description: string;
  path: string;
  image?: string;
  type: 'website' | 'article';
  ld: unknown[];
  body: string;
}

function renderHtml(template: string, origin: string, p: Page): string {
  const url = origin ? origin + p.path : '';
  const image = origin ? origin + (p.image ?? '/og.jpg') : '';
  const tags = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    url && `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${p.type}" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:locale" content="tr_TR" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    url && `<meta property="og:url" content="${esc(url)}" />`,
    image && `<meta property="og:image" content="${esc(image)}" />`,
    image && !p.image && `<meta property="og:image:width" content="1200" />`,
    image && !p.image && `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...p.ld.map(jsonLd),
  ].filter(Boolean);
  return template
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${p.body}</div>`);
}

const imagePath = (name: string) => `/img/${encodeURIComponent(name)}`;
const abs = (origin: string, path: string) => (origin ? origin + path : path);

function offer(l: Listing, origin: string) {
  return {
    '@type': 'Offer',
    url: abs(origin, `/detay/${l.slug}`),
    ...(l.price > 0 ? { price: l.price, priceCurrency: l.currency } : {}),
    availability: l.status === 'satildi' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    businessFunction: `http://purl.org/goodrelations/v1#${l.dealType === 'kiralik' ? 'LeaseOut' : 'Sell'}`,
    seller: { '@type': 'RealEstateAgent', name: SITE.name, telephone: `+${SITE.whatsappNumber}` },
  };
}

function listingLd(l: Listing, origin: string, description: string): unknown[] {
  const url = abs(origin, `/detay/${l.slug}`);
  const images = l.images.map((n) => abs(origin, imagePath(n)));
  const address = {
    '@type': 'PostalAddress',
    addressLocality: l.district || l.city,
    addressRegion: l.city,
    ...(l.neighborhood ? { streetAddress: l.neighborhood } : {}),
    addressCountry: 'TR',
  };
  const group = groupOf(l);
  const main =
    group === 'vasita'
      ? {
          '@type': 'Car',
          name: l.title,
          description,
          url,
          ...(images.length ? { image: images } : {}),
          ...(l.brand ? { brand: { '@type': 'Brand', name: l.brand } } : {}),
          ...(l.model ? { model: l.model } : {}),
          ...(l.modelYear ? { vehicleModelDate: String(l.modelYear) } : {}),
          ...(l.km !== null ? { mileageFromOdometer: { '@type': 'QuantitativeValue', value: l.km, unitCode: 'KMT' } } : {}),
          ...(l.fuel ? { fuelType: l.fuel } : {}),
          ...(l.gear ? { vehicleTransmission: l.gear } : {}),
          ...(l.color ? { color: l.color } : {}),
          offers: offer(l, origin),
        }
      : {
          '@type': 'RealEstateListing',
          name: l.title,
          description,
          url,
          ...(images.length ? { image: images } : {}),
          ...(l.createdAt ? { datePosted: l.createdAt.slice(0, 10) } : {}),
          offers: offer(l, origin),
          about: {
            '@type': group === 'konut' ? (['daire', 'rezidans'].includes(l.category) ? 'Apartment' : 'SingleFamilyResidence') : 'Place',
            name: l.title,
            address,
            ...(l.netM2 || l.grossM2 ? { floorSize: { '@type': 'QuantitativeValue', value: l.netM2 ?? l.grossM2, unitCode: 'MTK' } } : {}),
            ...(group === 'konut' && /^\d+/.test(l.rooms) ? { numberOfRooms: l.rooms } : {}),
          },
        };
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.name, item: abs(origin, '/') },
      { '@type': 'ListItem', position: 2, name: l.title, item: url },
    ],
  };
  return [{ '@context': 'https://schema.org', ...main }, { '@context': 'https://schema.org', ...breadcrumb }];
}

function listingBody(l: Listing): string {
  const facts: [string, string | number | null][] = [
    ['İlan No', l.code],
    ['İlan Türü', DEAL_LABEL[l.dealType]],
    ['Kategori', categoryLabel(l)],
    ['Konum', formatLocation(l)],
    ['Fiyat', formatPrice(l)],
    ['Durum', l.status === 'satildi' ? soldLabel(l) : ''],
    ['Brüt m²', l.grossM2 === null ? null : fmtInt(l.grossM2)],
    ['Net m²', l.netM2 === null ? null : fmtInt(l.netM2)],
    ['Oda Sayısı', l.rooms],
    ['Bulunduğu Kat', l.floor],
    ['Marka', l.brand],
    ['Model', l.model],
    ['Model Yılı', l.modelYear],
    ['Kilometre', l.km === null ? null : `${fmtInt(l.km)} km`],
  ];
  const rows = facts
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(String(v))}</li>`)
    .join('');
  const paras = l.description
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
  const features = l.features.length ? `<h2>Özellikler</h2><ul>${l.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const img = l.images[0] ? `<img src="${esc(imagePath(l.images[0]))}" alt="${esc(l.title)}" width="800" />` : '';
  return (
    `<main class="container section prerender"><p><a href="/">${esc(SITE.name)} – tüm ilanlar</a></p>` +
    `<article><h1>${esc(l.title)}</h1>${img}<ul>${rows}</ul>${paras}${features}` +
    `<p>İletişim: WhatsApp ${esc(SITE.phoneDisplay)}</p></article></main>`
  );
}

function homeBody(listings: Listing[]): string {
  const items = listings
    .map((l) => `<li><a href="/detay/${l.slug}">${esc(l.title)}</a> – ${esc(summaryLine(l))}</li>`)
    .join('');
  return (
    `<main class="container section prerender"><h1>${esc(SITE.name)} – ${esc(serviceArea(listings))} satılık ve kiralık ilanlar</h1>` +
    `<ul>${items}</ul><p>İletişim: WhatsApp ${esc(SITE.phoneDisplay)}</p></main>`
  );
}

const summaryLine = (l: Listing) => [`${DEAL_LABEL[l.dealType]} ${categoryLabel(l)}`, formatLocation(l), formatPrice(l), ...summaryFacts(l)].filter(Boolean).join(' · ');

function homeLd(listings: Listing[], origin: string): unknown[] {
  const areas = Array.from(new Set([...listings.map((l) => l.district).filter(Boolean), SITE.city]));
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: SITE.name,
      slogan: SITE.slogan,
      url: abs(origin, '/'),
      telephone: `+${SITE.whatsappNumber}`,
      areaServed: areas.map((name) => ({ '@type': 'Place', name })),
      address: { '@type': 'PostalAddress', addressRegion: SITE.city, addressCountry: 'TR' },
      ...(origin ? { image: `${origin}/og.jpg`, logo: `${origin}/logo.png` } : {}),
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: abs(origin, '/'), inLanguage: 'tr-TR' },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: listings.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(origin, `/detay/${l.slug}`), name: l.title })),
    },
  ];
}

export function seoPrerender(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'akemlak-seo-prerender',
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const origin = siteOriginForBuild();
      const template = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      let listings: Listing[] = [];
      try {
        listings = parseData(JSON.parse(readFileSync(resolve(root, 'public/data.json'), 'utf8')));
      } catch (e) {
        // Yazım hatası derlemeyi durdurmaz; site yine "İlanlar yüklenemedi" mesajını gösterir
        console.warn(`\n[seo] public/data.json okunamadı, ilan sayfaları üretilmedi: ${(e as Error).message}`);
      }
      const visible = listings
        .filter((l) => l.status !== 'taslak')
        .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt));

      writeFileSync(
        resolve(outDir, 'index.html'),
        renderHtml(template, origin, {
          title: homeTitle(),
          description: homeDescription(visible),
          path: '/',
          type: 'website',
          ld: homeLd(visible, origin),
          body: homeBody(visible),
        }),
      );

      for (const l of visible) {
        const description = listingDescription(l);
        const dir = resolve(outDir, 'detay', l.slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          resolve(dir, 'index.html'),
          renderHtml(template, origin, {
            title: listingTitle(l),
            description,
            path: `/detay/${l.slug}`,
            image: l.images[0] ? imagePath(l.images[0]) : undefined,
            type: 'article',
            ld: listingLd(l, origin, description),
            body: listingBody(l),
          }),
        );
      }

      // Sabit sayfalar: ilan başvurusu ve KVKK
      const staticPages = [
        {
          path: '/ilan-basvurusu',
          title: `İlan Başvurusu | ${SITE.name}`,
          description: `Evinizi, arsanızı veya iş yerinizi ${SITE.name} ile satmak ya da kiraya vermek için birkaç dakikada başvurun. Fotoğraf ekleyin, biz sizi arayalım.`,
          body: `<main class="container section prerender"><h1>${esc(SITE.name)} – ilan başvurusu</h1><p>Mülkünüzü satmak veya kiraya vermek için başvuru formunu doldurun.</p></main>`,
        },
        {
          path: '/kvkk',
          title: `KVKK Aydınlatma Metni ve Çerez Politikası | ${SITE.name}`,
          description: `${SITE.name} kişisel verilerin korunması aydınlatma metni ve çerez politikası.`,
          body: `<main class="container section prerender"><h1>KVKK Aydınlatma Metni ve Çerez Politikası</h1></main>`,
        },
      ];
      for (const page of staticPages) {
        const dir = resolve(outDir, page.path.slice(1));
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'index.html'), renderHtml(template, origin, { ...page, type: 'website', ld: [] }));
      }

      if (origin) {
        const day = (iso: string) => (iso ? `<lastmod>${iso.slice(0, 10)}</lastmod>` : '');
        const newest = visible.map((l) => l.createdAt).sort().pop() ?? '';
        const urls = [
          `<url><loc>${esc(origin)}/</loc>${day(newest)}<changefreq>daily</changefreq><priority>1.0</priority></url>`,
          ...visible.map((l) => `<url><loc>${esc(`${origin}/detay/${l.slug}`)}</loc>${day(l.createdAt)}<priority>0.8</priority></url>`),
          `<url><loc>${esc(origin)}/ilan-basvurusu</loc><priority>0.7</priority></url>`,
          `<url><loc>${esc(origin)}/kvkk</loc><priority>0.2</priority></url>`,
        ];
        writeFileSync(
          resolve(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
        );
        writeFileSync(resolve(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
      } else {
        console.warn('\n[seo] Site adresi bilinmiyor; canonical, og:url ve sitemap.xml üretilmedi. SITE_URL ortam değişkenini ya da src/config.ts → siteUrl alanını ayarlayın.');
      }
      console.log(`[seo] ${visible.length} ilan sayfası üretildi${origin ? ` (${origin})` : ''}.`);
    },
  };
}
