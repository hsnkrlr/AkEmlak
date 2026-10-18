import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LIMITS } from '../../config';
import { ensureDraft, getDraft, nextCode, saveDraft, storeImage, uniqueSlug } from '../../data/draft';
import { randomId } from '../../lib/crypto';
import { slugify } from '../../lib/format';
import { processImage } from '../../lib/images';
import { ChoiceField } from '../../components/ChoiceField';
import { Photo } from '../../components/Photo';
import {
  CATEGORY_GROUP, CATEGORY_LABEL, CURRENCY_LABEL, DEAL_LABEL, GROUP_LABEL, STATUS_LABEL,
  type Category, type CategoryGroup, type Currency, type DealType, type Listing, type ListingStatus,
} from '../../types';
import { useAdmin } from './session';

const FEATURE_SUGGESTIONS: Record<CategoryGroup, string[]> = {
  konut: [
    'Asansör', 'Otopark', 'Kapalı Otopark', 'Balkon', 'Teras', 'Bahçe', 'Havuz', 'Site İçerisinde', 'Güvenlik',
    'Eşyalı', 'Ankastre Mutfak', 'Ebeveyn Banyosu', 'Doğalgaz', 'Klima', 'Jeneratör', 'Çocuk Parkı',
    'Krediye Uygun', 'Tapulu', 'Takasa Uygun', 'Toplu Taşımaya Yakın', 'Okula Yakın', 'Deniz Manzarası',
  ],
  arsa: ['Konut İmarlı', 'Ticari İmarlı', 'Yola Cephe', 'Köşe Parsel', 'Elektrik', 'Su', 'Kuyu', 'Müstakil Tapulu', 'Hisseli Tapu', 'Zeytinlik', 'Fıstıklık', 'Bağ', 'Takasa Uygun'],
  isyeri: ['Cadde Üzeri', 'Köşe Konum', 'Vitrinli', 'Asma Kat', 'Otopark', 'Asansör', 'Jeneratör', 'Yükleme Rampası', 'Tır Girişi', 'Devren', 'Kiracılı', 'Krediye Uygun'],
  vasita: [
    'Hasar Kayıtsız', 'Boyasız', 'Değişensiz', 'Garantili', 'İlk Sahibinden', 'Servis Bakımlı', 'Muayenesi Yeni',
    'Takasa Uygun', 'Krediye Uygun', 'Sunroof', 'Geri Görüş Kamerası', 'Navigasyon', 'Deri Koltuk', 'Hız Sabitleyici',
  ],
  diger: ['Sıfır', 'Az Kullanılmış', 'Garantili', 'Faturalı', 'Takasa Uygun', 'Krediye Uygun', 'Pazarlık Payı Var'],
};
const HEATING = ['Kombi (Doğalgaz)', 'Merkezi Sistem', 'Yerden Isıtma', 'Klima', 'Soba', 'Yok'];
const ROOMS = ['1+0', '1+1', '2+1', '3+1', '3+2', '4+1', '4+2', '5+1', '6+1'];
const FLOORS = [
  'Bodrum Kat', 'Zemin Kat', 'Bahçe Katı', 'Yüksek Giriş', '1. Kat', '2. Kat', '3. Kat', '4. Kat', '5. Kat',
  '6. Kat', '7. Kat', '8. Kat', '9. Kat', '10. Kat ve üzeri', 'Çatı Katı', 'Villa Tipi (tüm katlar)',
];
const FUELS = ['Benzin', 'Dizel', 'LPG & Benzin', 'Hibrit', 'Elektrik'];
const GEARS = ['Manuel', 'Otomatik', 'Yarı Otomatik'];
const COLORS = ['Beyaz', 'Siyah', 'Gri', 'Gümüş', 'Kırmızı', 'Mavi', 'Lacivert', 'Yeşil', 'Kahverengi', 'Bej'];
const GROUPS = Object.keys(GROUP_LABEL) as CategoryGroup[];

/** Kategori grubuna göre formda gösterilen alanlar; diğer gruplara ait alanlar kayıtta temizlenir. */
const GROUP_FIELDS: Record<CategoryGroup, (keyof Form)[]> = {
  konut: ['grossM2', 'netM2', 'rooms', 'bathrooms', 'floor', 'buildingAge', 'heating'],
  arsa: ['grossM2'],
  isyeri: ['grossM2', 'netM2', 'bathrooms', 'floor', 'buildingAge', 'heating'],
  vasita: ['brand', 'model', 'modelYear', 'km', 'fuel', 'gear', 'color'],
  diger: ['grossM2'],
};
const OPTIONAL_FIELDS: (keyof Form)[] = [
  'grossM2', 'netM2', 'rooms', 'bathrooms', 'floor', 'buildingAge', 'heating', 'brand', 'model', 'modelYear', 'km', 'fuel', 'gear', 'color',
];

interface Form {
  title: string;
  slug: string;
  dealType: DealType;
  category: Category;
  price: string;
  currency: Currency;
  status: ListingStatus;
  featured: boolean;
  city: string;
  district: string;
  neighborhood: string;
  grossM2: string;
  netM2: string;
  rooms: string;
  bathrooms: string;
  floor: string;
  buildingAge: string;
  heating: string;
  brand: string;
  model: string;
  modelYear: string;
  km: string;
  fuel: string;
  gear: string;
  color: string;
  categoryOther: string;
  features: string[];
  description: string;
  images: string[];
}

const EMPTY: Form = {
  title: '', slug: '', dealType: 'satilik', category: 'daire', price: '', currency: 'TRY', status: 'yayinda', featured: false,
  city: '', district: '', neighborhood: '', grossM2: '', netM2: '', rooms: '', bathrooms: '', floor: '', buildingAge: '',
  heating: '', brand: '', model: '', modelYear: '', km: '', fuel: '', gear: '', color: '', categoryOther: '',
  features: [], description: '', images: [],
};

const numStr = (n: number | null) => (n === null ? '' : String(n));
const toNum = (s: string): number | null => {
  const v = Number(s.replace(/\./g, '').replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(v) ? null : v;
};

function fromListing(l: Listing): Form {
  return {
    ...l,
    price: String(l.price),
    grossM2: numStr(l.grossM2),
    netM2: numStr(l.netM2),
    bathrooms: numStr(l.bathrooms),
    buildingAge: numStr(l.buildingAge),
    modelYear: numStr(l.modelYear),
    km: numStr(l.km),
  };
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export default function ListingEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, requestSync } = useAdmin();
  const [form, setForm] = useState<Form>(EMPTY);
  const [original, setOriginal] = useState<Listing | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [notFound, setNotFound] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    ensureDraft()
      .catch(() => undefined)
      .then(() => getDraft(id))
      .then((l) => {
        if (!l) return setNotFound(true);
        setOriginal(l);
        setForm(fromListing(l));
        setSlugTouched(true);
      });
  }, [id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onTitle = (title: string) => setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));

  const addFeature = (raw: string) => {
    const v = raw.trim().slice(0, 60);
    if (!v || form.features.includes(v)) return;
    set('features', [...form.features, v]);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = LIMITS.maxImagesPerListing - form.images.length;
    const list = Array.from(files);
    const errs: string[] = [];
    if (list.length > room) errs.push(`En fazla ${LIMITS.maxImagesPerListing} fotoğraf eklenebilir; ${list.length - Math.max(room, 0)} dosya atlandı.`);
    const accepted = list.slice(0, Math.max(room, 0));
    setUploading(accepted.length);
    const added: string[] = [];
    for (const file of accepted) {
      try {
        const img = await processImage(file);
        await storeImage(img);
        if (!form.images.includes(img.name) && !added.includes(img.name)) added.push(img.name);
      } catch (e) {
        errs.push((e as Error).message);
      }
      setUploading((n) => n - 1);
    }
    setForm((f) => ({ ...f, images: [...f.images, ...added].slice(0, LIMITS.maxImagesPerListing) }));
    setErrors(errs);
    if (fileInput.current) fileInput.current.value = '';
  };

  const moveImage = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= form.images.length) return;
    const imgs = [...form.images];
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    set('images', imgs);
  };

  const makeCover = (i: number) => {
    const imgs = [...form.images];
    const [x] = imgs.splice(i, 1);
    set('images', [x, ...imgs]);
  };

  const group = CATEGORY_GROUP[form.category];
  const isRent = form.dealType === 'kiralik';
  const digits = (k: keyof Form) => (e: { target: { value: string } }) => set(k, e.target.value.replace(/[^\d]/g, '') as never);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    const price = toNum(form.price);
    if (form.title.trim().length < 5) errs.push('Başlık en az 5 karakter olmalı.');
    if (price === null || price <= 0) errs.push('Geçerli bir fiyat girin.');
    const baseSlug = slugify(form.slug || form.title);
    if (!baseSlug) errs.push('Bağlantı adı oluşturulamadı; başlığa harf ekleyin.');
    if (!form.city.trim()) errs.push('İl bilgisi zorunludur.');
    if (form.category === 'diger' && !form.categoryOther.trim()) errs.push('"Diğer" kategorisi için kategori adını yazın (örn. Tekne, Beyaz Eşya).');
    const year = toNum(form.modelYear);
    if (group === 'vasita' && year !== null && (year < 1950 || year > new Date().getFullYear() + 1)) errs.push('Model yılı geçersiz.');
    if (errs.length) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    // Seçilen kategoriye ait olmayan alanları temizle (örn. araçta oda sayısı kalmasın)
    const f: Form = { ...form };
    for (const k of OPTIONAL_FIELDS) if (!GROUP_FIELDS[group].includes(k)) (f[k] as string) = '';
    try {
      const listingId = original?.id ?? randomId(12);
      const now = new Date().toISOString();
      const saved = await saveDraft({
        id: listingId,
        code: original?.code ?? (await nextCode()),
        slug: original && baseSlug === original.slug ? baseSlug : await uniqueSlug(baseSlug, listingId),
        title: f.title,
        dealType: f.dealType,
        category: f.category,
        categoryOther: f.category === 'diger' ? f.categoryOther : '',
        price: price!,
        currency: f.currency,
        city: f.city,
        district: f.district,
        neighborhood: f.neighborhood,
        grossM2: toNum(f.grossM2),
        netM2: toNum(f.netM2),
        rooms: f.rooms,
        bathrooms: toNum(f.bathrooms),
        floor: f.floor,
        buildingAge: toNum(f.buildingAge),
        heating: f.heating,
        brand: f.brand,
        model: f.model,
        modelYear: toNum(f.modelYear),
        km: toNum(f.km),
        fuel: f.fuel,
        gear: f.gear,
        color: f.color,
        features: f.features,
        description: f.description,
        images: f.images,
        status: f.status,
        featured: f.featured,
        createdAt: original?.createdAt ?? now,
        updatedAt: now,
      });
      toast(`"${saved.title}" kaydedildi, siteye gönderiliyor…`);
      requestSync();
      navigate('/admin');
    } catch (err) {
      setErrors([(err as Error).message]);
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div className="empty">
        <h3>İlan bulunamadı</h3>
        <Link to="/admin" className="btn btn-primary">
          İlanlara dön
        </Link>
      </div>
    );
  }


  return (
    <form className="editor" onSubmit={submit} noValidate>
      <div className="admin-head">
        <div>
          <Link to="/admin" className="back-link">
            ← İlanlar
          </Link>
          <h1>{original ? 'İlanı Düzenle' : 'Yeni İlan'}</h1>
          {original && <p className="muted">{original.code}</p>}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="alert alert-err" role="alert">
          <ul>
            {errors.map((er, i) => (
              <li key={i}>{er}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="panel">
        <h2>1. Temel Bilgiler</h2>
        <div className="form-grid">
          <Field label="İlan başlığı *" wide hint={group === 'vasita' ? 'Örn: 2019 Renault Clio 1.0 Joy Hatasız' : 'Örn: Merkezde 3+1 Asansörlü Geniş Daire'}>
            <input value={form.title} onChange={(e) => onTitle(e.target.value)} maxLength={140} required />
          </Field>
          <Field label="İlan türü">
            <div className="seg seg-form">
              {(Object.keys(DEAL_LABEL) as DealType[]).map((d) => (
                <button key={d} type="button" className={form.dealType === d ? 'on' : ''} onClick={() => set('dealType', d)}>
                  {DEAL_LABEL[d]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Kategori" hint={form.category === 'diger' ? undefined : 'Listede yoksa en alttaki "Diğer" seçeneğini seçin.'}>
            <select value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {GROUPS.filter((g) => g !== 'diger').map((g) => (
                <optgroup key={g} label={GROUP_LABEL[g]}>
                  {(Object.keys(CATEGORY_LABEL) as Category[])
                    .filter((c) => CATEGORY_GROUP[c] === g)
                    .map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                </optgroup>
              ))}
              <option value="diger">Diğer (listede yok)</option>
            </select>
            {form.category === 'diger' && (
              <input
                value={form.categoryOther}
                onChange={(e) => set('categoryOther', e.target.value)}
                placeholder="Kategori adı (örn. Tekne, Beyaz Eşya, Karavan)"
                maxLength={40}
                aria-label="Diğer kategori adı"
                autoFocus
              />
            )}
          </Field>
          <Field label={isRent ? 'Aylık kira *' : 'Fiyat *'}>
            <div className="input-group">
              <input inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" required />
              <select value={form.currency} onChange={(e) => set('currency', e.target.value as Currency)} aria-label="Para birimi">
                {(Object.keys(CURRENCY_LABEL) as Currency[]).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Durum" hint="Taslaklar sitede görünmez.">
            <select value={form.status} onChange={(e) => set('status', e.target.value as ListingStatus)}>
              {(Object.keys(STATUS_LABEL) as ListingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
            <span>
              <b>Fırsat ilanı</b> olarak öne çıkar
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>2. Konum</h2>
        <div className="form-grid three">
          <Field label="İl *">
            <input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={60} />
          </Field>
          <Field label="İlçe">
            <input value={form.district} onChange={(e) => set('district', e.target.value)} maxLength={60} />
          </Field>
          <Field label="Mahalle / Semt">
            <input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} maxLength={80} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <h2>3. {group === 'vasita' ? 'Araç Bilgileri' : 'Özellikler'}</h2>
        <div className="form-grid three">
          {group === 'vasita' && (
            <>
              <Field label="Marka">
                <input value={form.brand} onChange={(e) => set('brand', e.target.value)} maxLength={40} placeholder="Örn: Renault" />
              </Field>
              <Field label="Model / Paket">
                <input value={form.model} onChange={(e) => set('model', e.target.value)} maxLength={80} placeholder="Örn: Clio 1.0 TCe Joy" />
              </Field>
              <Field label="Model yılı">
                <input inputMode="numeric" maxLength={4} value={form.modelYear} onChange={digits('modelYear')} placeholder="Örn: 2019" />
              </Field>
              <Field label="Kilometre">
                <input inputMode="numeric" value={form.km} onChange={digits('km')} placeholder="Örn: 85000" />
              </Field>
              <Field label="Yakıt">
                <ChoiceField value={form.fuel} options={FUELS} onChange={(v) => set('fuel', v)} ariaLabel="Yakıt" />
              </Field>
              <Field label="Vites">
                <ChoiceField value={form.gear} options={GEARS} onChange={(v) => set('gear', v)} ariaLabel="Vites" />
              </Field>
              <Field label="Renk">
                <ChoiceField value={form.color} options={COLORS} onChange={(v) => set('color', v)} ariaLabel="Renk" />
              </Field>
            </>
          )}
          {group !== 'vasita' && (
            <Field label={group === 'konut' || group === 'isyeri' ? 'Brüt m²' : 'Alan (m²)'}>
              <input inputMode="numeric" value={form.grossM2} onChange={digits('grossM2')} />
            </Field>
          )}
          {(group === 'konut' || group === 'isyeri') && (
            <Field label="Net m²">
              <input inputMode="numeric" value={form.netM2} onChange={digits('netM2')} />
            </Field>
          )}
          {group === 'konut' && (
            <Field label="Oda sayısı">
              <ChoiceField value={form.rooms} options={ROOMS} onChange={(v) => set('rooms', v)} placeholder="Örn: 7+2" maxLength={20} ariaLabel="Oda sayısı" />
            </Field>
          )}
          {(group === 'konut' || group === 'isyeri') && (
            <>
              <Field label={group === 'isyeri' ? 'WC / Banyo sayısı' : 'Banyo sayısı'}>
                <input inputMode="numeric" value={form.bathrooms} onChange={digits('bathrooms')} />
              </Field>
              <Field label="Bulunduğu kat">
                <ChoiceField value={form.floor} options={FLOORS} onChange={(v) => set('floor', v)} placeholder="Örn: 14. Kat" maxLength={30} ariaLabel="Bulunduğu kat" />
              </Field>
              <Field label="Bina yaşı" hint="Sıfır bina için 0 yazın.">
                <input inputMode="numeric" value={form.buildingAge} onChange={digits('buildingAge')} />
              </Field>
              <Field label="Isıtma">
                <ChoiceField value={form.heating} options={HEATING} onChange={(v) => set('heating', v)} ariaLabel="Isıtma" />
              </Field>
            </>
          )}
        </div>
        {group === 'diger' && <p className="small muted">Ürünle ilgili diğer detayları aşağıdaki özelliklere ve açıklamaya yazabilirsiniz.</p>}

        <div className="field wide">
          <span>Öne çıkan özellikler</span>
          <div className="feature-input">
            <input
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addFeature(featureInput);
                  setFeatureInput('');
                }
              }}
              placeholder="Yazıp Enter’a basın"
              maxLength={60}
            />
            <button type="button" className="btn btn-ghost" onClick={() => (addFeature(featureInput), setFeatureInput(''))}>
              Ekle
            </button>
          </div>
          {form.features.length > 0 && (
            <ul className="chips editable">
              {form.features.map((f) => (
                <li key={f}>
                  {f}
                  <button type="button" aria-label={`${f} kaldır`} onClick={() => set('features', form.features.filter((x) => x !== f))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="suggestions">
            {FEATURE_SUGGESTIONS[group].filter((s) => !form.features.includes(s)).map((s) => (
              <button key={s} type="button" onClick={() => addFeature(s)}>
                + {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>4. Açıklama</h2>
        <textarea
          rows={8}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={6000}
          placeholder={
            group === 'vasita'
              ? 'Aracın bakım geçmişini, varsa değişen/boyalı parçaları ve öne çıkan donanımlarını anlatın. Paragraf için bir satır boş bırakın.'
              : 'Öne çıkan yönlerini, çevresini ve ulaşım imkânlarını anlatın. Paragraf için bir satır boş bırakın.'
          }
        />
        <small className="muted">{form.description.length} / 6000</small>
      </section>

      <section className="panel">
        <div className="row-between">
          <h2>
            5. Fotoğraflar <span className="muted">({form.images.length}/{LIMITS.maxImagesPerListing})</span>
          </h2>
        </div>
        <p className="small muted">
          İlk fotoğraf kapak olarak kullanılır. Fotoğraflar otomatik küçültülür ve içlerindeki konum (GPS) bilgisi silinir.
        </p>
        {form.images.length < LIMITS.maxImagesPerListing && (
          <label
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files);
            }}
          >
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => void onFiles(e.target.files)} hidden />
            <strong>{uploading ? `Fotoğraflar işleniyor… (${uploading})` : 'Fotoğraf seçmek için dokunun'}</strong>
            <span className="small muted">veya sürükleyip bırakın · JPG, PNG, WEBP · en fazla 15 MB</span>
          </label>
        )}
        {form.images.length > 0 && (
          <ol className="image-grid">
            {form.images.map((name, i) => (
              <li key={name}>
                <Photo name={name} thumb alt={`Fotoğraf ${i + 1}`} />
                {i === 0 && <span className="cover-tag">Kapak</span>}
                <div className="image-tools">
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Sola taşı">
                    ←
                  </button>
                  {i !== 0 && (
                    <button type="button" onClick={() => makeCover(i)}>
                      Kapak yap
                    </button>
                  )}
                  <button type="button" onClick={() => moveImage(i, 1)} disabled={i === form.images.length - 1} aria-label="Sağa taşı">
                    →
                  </button>
                  <button type="button" className="danger-text" onClick={() => set('images', form.images.filter((x) => x !== name))} aria-label="Fotoğrafı kaldır">
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel">
        <h2>6. Bağlantı Adresi</h2>
        <Field label="Bağlantı adı" hint={`Site adresi: /detay/${slugify(form.slug || form.title) || '…'}`} wide>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value.toLocaleLowerCase('tr-TR'));
            }}
            onBlur={() => set('slug', slugify(form.slug))}
            maxLength={80}
          />
        </Field>
      </section>

      <div className="editor-actions">
        <Link to="/admin" className="btn btn-ghost btn-lg">
          Vazgeç
        </Link>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || uploading > 0}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
