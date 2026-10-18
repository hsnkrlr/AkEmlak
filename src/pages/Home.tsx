import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE } from '../config';
import { publicListings, usePublished } from '../data/published';
import { generalWhatsappLink } from '../lib/whatsapp';
import { usePageMeta } from '../lib/usePageMeta';
import { IconChat, IconSearch, IconShield, IconSpark, IconWhatsapp } from '../components/Icons';
import { ListingCard } from '../components/ListingCard';
import { PublicLayout, TrustNotice } from '../components/Layout';
import { categoryLabel, groupOf } from '../lib/format';
import { CATEGORY_GROUP, CATEGORY_LABEL, GROUP_LABEL, type Category, type CategoryGroup, type DealType, type Listing } from '../types';

type Sort = 'yeni' | 'artan' | 'azalan';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

function filterListings(list: Listing[], q: string, deal: DealType | '', group: CategoryGroup | '', cat: Category | '', sort: Sort): Listing[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const out = list.filter((l) => {
    if (deal && l.dealType !== deal) return false;
    if (group && groupOf(l) !== group) return false;
    if (cat && l.category !== cat) return false;
    if (!terms.length) return true;
    const hay = norm(
      [l.title, l.city, l.district, l.neighborhood, l.rooms, l.code, categoryLabel(l), CATEGORY_LABEL[l.category], l.brand, l.model, l.modelYear ?? ''].join(' '),
    );
    return terms.every((t) => hay.includes(t));
  });
  const rank = (l: Listing) => (l.status === 'satildi' ? 2 : l.featured ? 0 : 1);
  return out.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (sort === 'artan') return a.price - b.price;
    if (sort === 'azalan') return b.price - a.price;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export default function Home() {
  usePageMeta(
    `${SITE.name} | Satılık ve Kiralık Emlak ve Araç İlanları`,
    `${SITE.name} güncel satılık ve kiralık daire, villa, arsa, iş yeri ve araç ilanları. WhatsApp ile hemen bilgi alın.`,
  );
  const state = usePublished();
  const all = useMemo(() => publicListings(state), [state]);
  const [q, setQ] = useState('');
  const [deal, setDeal] = useState<DealType | ''>('');
  const [group, setGroup] = useState<CategoryGroup | ''>('');
  const [cat, setCat] = useState<Category | ''>('');
  const [sort, setSort] = useState<Sort>('yeni');
  const shown = useMemo(() => filterListings(all, q, deal, group, cat, sort), [all, q, deal, group, cat, sort]);
  const active = all.filter((l) => l.status === 'yayinda').length;
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#ilanlar' && state.status === 'ok') {
      document.getElementById('ilanlar')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, state.status]);

  const groups = useMemo(() => (Object.keys(GROUP_LABEL) as CategoryGroup[]).filter((g) => all.some((l) => groupOf(l) === g)), [all]);
  const categories = useMemo(
    () => (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => (!group || CATEGORY_GROUP[c] === group) && all.some((l) => l.category === c)),
    [all, group],
  );

  return (
    <PublicLayout>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">{SITE.city} ve çevresinde güvenilir alım satım</p>
          <h1>
            Aradığınız ilana <span className="grad-text">güvenle</span> ulaşın
          </h1>
          <p className="hero-sub">
            Ev, arsa, iş yeri, araç ve daha fazlası. Beğendiğiniz ilanı tek dokunuşla WhatsApp’tan sorun, size hemen
            dönüş yapalım.
          </p>

          <form className="search" role="search" onSubmit={(e) => (e.preventDefault(), document.getElementById('ilanlar')?.scrollIntoView({ behavior: 'smooth' }))}>
            <div className="seg" role="group" aria-label="İlan türü">
              {(
                [
                  ['', 'Tümü'],
                  ['satilik', 'Satılık'],
                  ['kiralik', 'Kiralık'],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" className={deal === v ? 'on' : ''} aria-pressed={deal === v} onClick={() => setDeal(v)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="search-field">
              <IconSearch />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Semt, marka, model, oda sayısı veya ilan no…"
                aria-label="İlan ara"
                maxLength={80}
              />
            </label>
            <button className="btn btn-primary" type="submit">
              İlanları Göster
            </button>
          </form>

          <ul className="hero-stats">
            <li>
              <strong>{state.status === 'loading' ? '—' : active}</strong>
              <span>aktif ilan</span>
            </li>
            <li>
              <strong>7/24</strong>
              <span>WhatsApp iletişim</span>
            </li>
            <li>
              <strong>%100</strong>
              <span>doğrulanmış ilan</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="ilanlar" className="container section">
        <div className="section-head">
          <div>
            <h2>Güncel İlanlar</h2>
            <p className="muted">{state.status === 'ok' ? `${shown.length} ilan listeleniyor` : ' '}</p>
          </div>
          <div className="filters">
            <select value={cat} onChange={(e) => setCat(e.target.value as Category | '')} aria-label="Kategori">
              <option value="">{group ? `Tüm ${GROUP_LABEL[group]} ilanları` : 'Tüm kategoriler'}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sıralama">
              <option value="yeni">En yeni</option>
              <option value="artan">Fiyat (düşükten yükseğe)</option>
              <option value="azalan">Fiyat (yüksekten düşüğe)</option>
            </select>
          </div>
        </div>

        {groups.length > 1 && (
          <div className="group-chips" role="group" aria-label="İlan grubu">
            {(['', ...groups] as const).map((g) => (
              <button
                key={g || 'all'}
                type="button"
                className={group === g ? 'on' : ''}
                aria-pressed={group === g}
                onClick={() => {
                  setGroup(g);
                  setCat('');
                }}
              >
                {g ? GROUP_LABEL[g] : 'Tümü'}
              </button>
            ))}
          </div>
        )}

        {state.status === 'loading' && (
          <div className="grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="card skeleton" aria-hidden="true" />
            ))}
          </div>
        )}
        {state.status === 'invalid' && (
          <div className="empty warn">
            <IconShield width={32} height={32} />
            <h3>İlanlar güvenlik doğrulamasından geçemedi</h3>
            <p>Güvenliğiniz için ilanlar şu anda gösterilmiyor. Lütfen bizimle doğrudan iletişime geçin.</p>
          </div>
        )}
        {state.status === 'error' && (
          <div className="empty">
            <h3>İlanlar yüklenemedi</h3>
            <p>İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p>
          </div>
        )}
        {state.status === 'ok' &&
          (shown.length ? (
            <div className="grid">
              {shown.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>Aradığınız kriterde ilan bulunamadı</h3>
              <p>Filtreleri değiştirin ya da bize yazın; size uygun portföyü sizin için bulalım.</p>
              <a className="btn btn-wa" href={generalWhatsappLink()} target="_blank" rel="noopener noreferrer">
                <IconWhatsapp /> Aradığımı Bulun
              </a>
            </div>
          ))}
      </section>

      <section className="container section">
        <div className="features">
          <div className="feature">
            <span className="feature-ico">
              <IconShield />
            </span>
            <h3>Doğrulanmış ilanlar</h3>
            <p>Tüm ilanlar dijital imzalıdır; yalnızca {SITE.name} tarafından yayınlanan ilanlar sitede görünür.</p>
          </div>
          <div className="feature">
            <span className="feature-ico">
              <IconChat />
            </span>
            <h3>Hızlı iletişim</h3>
            <p>İlan bilgileri mesajınıza otomatik eklenir; uzun uzun anlatmanıza gerek kalmaz.</p>
          </div>
          <div className="feature">
            <span className="feature-ico">
              <IconSpark />
            </span>
            <h3>Şeffaf süreç</h3>
            <p>Net fiyat, gerçek fotoğraflar ve yer göstermeden önce hiçbir ödeme talep etmeyen dürüst hizmet.</p>
          </div>
        </div>
        <TrustNotice />
      </section>
    </PublicLayout>
  );
}
