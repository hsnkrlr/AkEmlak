import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE } from '../config';
import { isFirebaseConfigured } from '../firebase/config';
import type { ApplicationPayload } from '../firebase/client';
import {
  buildListing, buildSeller, clearHistory, EMPTY_FORM, FEATURE_SUGGESTIONS, FIELDS_BY_TYPE, formatPhone, formFromParams, formToParams,
  KVKK_VERSION, loadHistory, MAX_PHOTOS, OPTIONS, phoneDigits, preparePhoto, saveToHistory, TYPE_LABEL, TYPES, validate,
  type ApplyForm, type ApplyType, type Errors, type FieldKey, type PreparedPhoto, type StoredApplication,
} from '../lib/apply';
import { saveConsent, useConsent } from '../lib/consent';
import { formatDateTime } from '../lib/format';
import { usePageMeta } from '../lib/usePageMeta';
import { generalWhatsappLink } from '../lib/whatsapp';
import { IconCamera, IconClose, IconWhatsapp } from '../components/Icons';
import { PublicLayout } from '../components/Layout';

type PhotoItem =
  | { id: string; kind: 'new'; prepared: PreparedPhoto; preview: string }
  | { id: string; kind: 'existing'; path: string; thumb: string };

type View = { name: 'form' } | { name: 'history' } | { name: 'done'; number: string; resubmission: boolean };

let seq = 0;
const nextId = () => `p${++seq}`;

/** Firebase kütüphanesi ayrı parça olarak yüklenir: form anında açılır, gönderime kadar arka planda hazırlanır. */
const loadFirebase = () => import('../firebase/client');

/* ---------------- küçük yapı taşları ---------------- */

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="apply-section">
      <header>
        <span className="apply-step">{n}</span>
        <div>
          <h2>{title}</h2>
          {hint && <p className="muted small">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Text({
  label, value, onChange, placeholder, suffix, numeric, max = 120, required, error, autoComplete, wide,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string; numeric?: boolean;
  max?: number; required?: boolean; error?: string; autoComplete?: string; wide?: boolean;
}) {
  return (
    <label className={`af ${wide ? 'wide' : ''} ${error ? 'has-error' : ''}`}>
      <span>
        {label} {required ? <b className="req">*</b> : <i className="opt">isteğe bağlı</i>}
      </span>
      <div className="af-input">
        <input
          value={value}
          onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d]/g, '').slice(0, 12) : e.target.value.slice(0, max))}
          inputMode={numeric ? 'numeric' : undefined}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
        />
        {suffix && <em>{suffix}</em>}
      </div>
      {error && <small className="af-error">{error}</small>}
    </label>
  );
}

/** Dokunarak seçilen seçenekler; aynı seçeneğe tekrar dokununca seçim kalkar. */
function Chips({ label, options, value, onChange, wide }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <div className={`af ${wide ? 'wide' : ''}`} role="group" aria-label={label}>
      <span>
        {label} <i className="opt">isteğe bağlı</i>
      </span>
      <div className="chip-row">
        {options.map((o) => (
          <button key={o} type="button" className={value === o ? 'on' : ''} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const TYPE_ICONS: Record<ApplyType, ReactNode> = {
  daire: <path d="M6 28V6h14v22M20 12h6v16M10 10h2M14 10h2M10 15h2M14 15h2M10 20h2M14 20h2M4 28h24" />,
  mustakil: <path d="M5 28V15L16 6l11 9v13M13 28v-7h6v7M3 28h26" />,
  villa: <path d="M3 28V16l8-6 8 6v12M19 20h10v8M7 28v-5h5v5M22 24h4M2 28h28" />,
  arsa: <path d="M4 26l6-14h12l6 14zM16 12V4l6 3-6 3" />,
  tarla: <path d="M16 28V16M16 16c-6 0-8-5-8-9 4 0 8 3 8 9zM16 16c6 0 8-5 8-9-4 0-8 3-8 9M4 28h24" />,
  isyeri: <path d="M4 12l2-6h20l2 6zM4 12c0 2 2 3 4 3s4-1 4-3c0 2 2 3 4 3s4-1 4-3c0 2 2 3 4 3s4-1 4-3M6 15v13h20V15M13 28v-7h6v7" />,
  arac: <path d="M4 22v-5l3-6h18l3 6v5zM4 22h24M9 22v3M23 22v3M8 17h16M9 19.5h.5M22.5 19.5h.5" />,
  diger: <path d="M8 16h.5M16 16h.5M24 16h.5M4 6h24v20H4z" />,
};

/* ---------------- sayfa ---------------- */

export default function Apply() {
  usePageMeta(
    `İlan Başvurusu | ${SITE.name}`,
    `Evinizi, arsanızı veya iş yerinizi ${SITE.name} ile satmak ya da kiraya vermek için birkaç dakikada başvurun. Fotoğraf ekleyin, biz sizi arayalım.`,
  );
  const consent = useConsent();
  const location = useLocation();
  const configured = isFirebaseConfigured();
  const [history, setHistory] = useState<StoredApplication[]>(loadHistory);
  const [view, setView] = useState<View>({ name: 'form' });
  const [editing, setEditing] = useState<StoredApplication | null>(null);
  const [form, setForm] = useState<ApplyForm>(() => initialForm(location.search, loadHistory()[0]));
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [kvkk, setKvkk] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState<string>('');
  const [submitError, setSubmitError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // Hata gösterildikten sonra kullanıcı düzelttikçe uyarıları anında güncelle
  useEffect(() => {
    setErrors((prev) => (Object.keys(prev).length ? validate(form, kvkk) : prev));
  }, [form, kvkk]);

  // Form değiştikçe bağlantıyı güncelle: sayfa yenilenince ya da bağlantı paylaşılınca aynı bilgilerle açılır.
  // Ad, telefon ve e-posta bağlantıya yazılmaz (bkz. formToParams).
  useEffect(() => {
    const t = setTimeout(() => {
      const url = location.pathname + formToParams(form) + window.location.hash;
      if (url !== window.location.pathname + window.location.search + window.location.hash) replaceUrl(url);
    }, 400);
    return () => clearTimeout(t);
  }, [form, location.pathname, location.key]);

  // Firebase'i arka planda önceden yükle (izin verildiyse)
  useEffect(() => {
    if (consent && configured) void loadFirebase();
  }, [consent, configured]);

  // Önizleme adreslerini temizle
  useEffect(() => () => photos.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.preview)), []);

  const set = <K extends keyof ApplyForm>(k: K, v: ApplyForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fields = useMemo(() => new Set<FieldKey>(form.type ? FIELDS_BY_TYPE[form.type] : []), [form.type]);
  const scrollTop = () => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, Math.max(room, 0));
    const errs = files.length > room ? [`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz.`] : [];
    setPreparing(list.length);
    for (const f of list) {
      try {
        const prepared = await preparePhoto(f);
        setPhotos((p) => [...p, { id: nextId(), kind: 'new', prepared, preview: URL.createObjectURL(prepared.blob) }]);
      } catch (e) {
        errs.push((e as Error).message);
      }
      setPreparing((n) => n - 1);
    }
    setPhotoErrors(errs);
    if (fileInput.current) fileInput.current.value = '';
  };

  const removePhoto = (id: string) =>
    setPhotos((list) => {
      const item = list.find((p) => p.id === id);
      if (item?.kind === 'new') URL.revokeObjectURL(item.preview);
      return list.filter((p) => p.id !== id);
    });

  const startEdit = (app: StoredApplication) => {
    setEditing(app);
    setForm({ ...EMPTY_FORM, ...app.form, features: [...(app.form.features ?? [])] });
    setPhotos(app.photos.map((p) => ({ id: nextId(), kind: 'existing', path: p.path, thumb: p.thumb })));
    setKvkk(false);
    setErrors({});
    setSubmitError('');
    setView({ name: 'form' });
    scrollTop();
  };

  const startNew = () => {
    setEditing(null);
    setForm(initialForm('', loadHistory()[0]));
    setPhotos([]);
    setKvkk(false);
    setErrors({});
    setSubmitError('');
    setView({ name: 'form' });
    scrollTop();
  };

  const submit = async () => {
    const e = validate(form, kvkk);
    setErrors(e);
    setSubmitError('');
    if (Object.keys(e).length) {
      document.querySelector('.has-error, .af-error, .type-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let fb: Awaited<ReturnType<typeof loadFirebase>>;
    try {
      setSending('Hazırlanıyor…');
      fb = await loadFirebase();
    } catch {
      setSending('');
      setSubmitError('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      return;
    }
    const number = fb.newApplicationNumber();
    try {
      const paths: { path: string; thumb: string }[] = [];
      const fresh = photos.filter((p) => p.kind === 'new').length;
      let done = 0;
      for (const p of photos) {
        if (p.kind === 'existing') {
          paths.push({ path: p.path, thumb: p.thumb });
          continue;
        }
        setSending(`Fotoğraflar yükleniyor (${++done}/${fresh})…`);
        paths.push({ path: await fb.uploadPhoto(p.prepared), thumb: p.prepared.thumb });
      }
      setSending('Başvuru gönderiliyor…');
      const resubmission: ApplicationPayload['resubmission'] = editing
        ? { isResubmission: true, of: editing.number, original: editing.resubmission.original ?? editing.number, revision: editing.resubmission.revision + 1 }
        : { isResubmission: false, of: null, original: null, revision: 0 };
      const id = await fb.submitApplication({
        number,
        seller: buildSeller(form),
        listing: buildListing(form),
        photos: paths.map((p) => p.path),
        resubmission,
        consent: { kvkk: true, version: KVKK_VERSION },
      });
      saveToHistory({ id, number, submittedAt: new Date().toISOString(), form, photos: paths, resubmission });
      setHistory(loadHistory());
      photos.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setEditing(null);
      setView({ name: 'done', number, resubmission: resubmission.isResubmission });
      scrollTop();
    } catch (err) {
      console.error('Başvuru gönderilemedi:', err);
      setSubmitError(
        err instanceof fb.RateLimitError
          ? 'Başvurunuz kabul edilmedi. Az önce bir başvuru gönderdiyseniz lütfen bir dakika bekleyip tekrar deneyin.'
          : 'Başvuru gönderilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      );
    } finally {
      setSending('');
    }
  };

  /* ------------ izin yoksa ------------ */
  if (!consent) {
    return (
      <PublicLayout>
        <div className="container section apply" ref={top}>
          <ApplyHero />
          <div className="apply-gate">
            <h2>Devam etmek için izniniz gerekiyor</h2>
            <p>
              Başvuru formu, bilgilerinizi ve geçmiş başvurularınızı <b>yalnızca bu cihazda</b> saklayabilmek için tarayıcı
              depolamasını kullanır. Bu izin olmadan form çalışmaz. Analitik çerezler isteğe bağlıdır.
            </p>
            <div className="apply-gate-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => saveConsent(true)}>
                Tümünü kabul et
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => saveConsent(false)}>
                Yalnızca zorunlu
              </button>
            </div>
            <p className="small muted">
              Ayrıntılar: <Link to="/kvkk">KVKK Aydınlatma Metni ve Çerez Politikası</Link>
            </p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="container section apply" ref={top}>
        <ApplyHero />

        <div className="apply-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view.name !== 'history'} className={view.name !== 'history' ? 'on' : ''} onClick={() => (view.name === 'done' ? startNew() : setView({ name: 'form' }))}>
            {editing ? 'Başvuruyu düzenle' : 'Yeni başvuru'}
          </button>
          <button type="button" role="tab" aria-selected={view.name === 'history'} className={view.name === 'history' ? 'on' : ''} onClick={() => setView({ name: 'history' })}>
            Başvurularım{history.length ? ` (${history.length})` : ''}
          </button>
        </div>

        {!configured && (
          <div className="apply-notice">
            Online başvuru sistemi kısa süre içinde açılacak. Şimdilik{' '}
            <a href={generalWhatsappLink()} target="_blank" rel="noopener noreferrer">
              WhatsApp'tan
            </a>{' '}
            bize ulaşabilirsiniz.
          </div>
        )}

        {view.name === 'done' && (
          <div className="apply-done" role="status">
            <div className="apply-done-icon" aria-hidden="true">
              ✓
            </div>
            <h2>{view.resubmission ? 'Güncellenen başvurunuz alındı' : 'Başvurunuz alındı'}</h2>
            <p>
              Başvuru numaranız <b className="mono">{view.number}</b>. En kısa sürede sizi arayacağız.
            </p>
            <div className="apply-gate-actions">
              <button type="button" className="btn btn-primary" onClick={() => setView({ name: 'history' })}>
                Başvurularım
              </button>
              <button type="button" className="btn btn-ghost" onClick={startNew}>
                Yeni başvuru
              </button>
            </div>
          </div>
        )}

        {view.name === 'history' && (
          <div className="apply-history">
            {history.length === 0 ? (
              <div className="empty">
                <h3>Bu cihazda kayıtlı başvuru yok</h3>
                <button type="button" className="btn btn-primary" onClick={startNew}>
                  Başvuru yap
                </button>
              </div>
            ) : (
              <>
                <ul>
                  {history.map((a) => (
                    <li key={a.id + a.number} className="history-card">
                      <div className="history-thumbs">
                        {a.photos.slice(0, 3).map((p, i) => (p.thumb ? <img key={i} src={p.thumb} alt="" /> : null))}
                        {a.photos.length === 0 && <span className="muted small">Fotoğraf yok</span>}
                      </div>
                      <div className="history-info">
                        <div className="history-title">
                          <b className="mono">{a.number}</b>
                          {a.resubmission.isResubmission && <span className="badge badge-soft">{a.resubmission.revision + 1}. sürüm · tekrar gönderim</span>}
                        </div>
                        <div>
                          {a.form.type ? TYPE_LABEL[a.form.type] : ''}
                          {a.form.deal ? ` · ${a.form.deal === 'satilik' ? 'Satılık' : 'Kiralık'}` : ''}
                          {[a.form.neighborhood, a.form.district].filter(Boolean).length ? ` · ${[a.form.neighborhood, a.form.district].filter(Boolean).join(', ')}` : ''}
                        </div>
                        <div className="muted small">Gönderildi: {formatDateTime(a.submittedAt)}</div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>
                        Düzenle ve tekrar gönder
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="history-clear">
                  {confirmClear ? (
                    <>
                      <span>Bu cihazdaki tüm başvuru geçmişi silinsin mi? (Gönderilmiş başvurular bize ulaşmış olarak kalır.)</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          clearHistory();
                          setHistory([]);
                          setConfirmClear(false);
                        }}
                      >
                        Evet, sil
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirmClear(true)}>
                      Tüm geçmişi bu cihazdan sil
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {view.name === 'form' && (
          <form
            className="apply-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {editing && (
              <div className="apply-notice">
                <b className="mono">{editing.number}</b> numaralı başvurunuzu düzenliyorsunuz. Gönderdiğinizde{' '}
                <b>{editing.resubmission.revision + 2}. sürüm</b> olarak, tekrar gönderim işaretiyle iletilir.{' '}
                <button type="button" className="link-btn" onClick={startNew}>
                  Düzenlemeyi bırak
                </button>
              </div>
            )}

            <Section n={1} title="Ne ilanı vermek istiyorsunuz?">
              <div className={`type-grid ${errors.type ? 'type-error' : ''}`} role="radiogroup" aria-label="İlan tipi">
                {TYPES.map((t) => (
                  <button key={t.key} type="button" role="radio" aria-checked={form.type === t.key} className={form.type === t.key ? 'on' : ''} onClick={() => set('type', t.key)}>
                    <svg viewBox="0 0 32 32" aria-hidden="true">
                      {TYPE_ICONS[t.key]}
                    </svg>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              {errors.type && <small className="af-error">{errors.type}</small>}
              <div className="seg seg-wide" role="group" aria-label="Satılık veya kiralık">
                {(
                  [
                    ['satilik', 'Satılık'],
                    ['kiralik', 'Kiralık'],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} type="button" className={form.deal === v ? 'on' : ''} aria-pressed={form.deal === v} onClick={() => set('deal', form.deal === v ? '' : v)}>
                    {l}
                  </button>
                ))}
              </div>
            </Section>

            <Section n={2} title="Nerede?">
              <div className="af-grid">
                <Text label="İl" value={form.city} onChange={(v) => set('city', v)} max={60} />
                <Text label="İlçe" value={form.district} onChange={(v) => set('district', v)} placeholder="Örn. Nurdağı" max={60} />
                <Text label="Mahalle" value={form.neighborhood} onChange={(v) => set('neighborhood', v)} placeholder="Örn. Esenyurt" max={80} />
                <Text label="Adres tarifi" value={form.address} onChange={(v) => set('address', v)} placeholder="Sokak, yakın bir yer…" max={300} />
              </div>
            </Section>

            {form.type && form.type !== 'diger' && (
              <Section n={3} title={`${TYPE_LABEL[form.type]} bilgileri`} hint="Bildiğiniz kadarını doldurun, gerisini telefonda konuşuruz.">
                <div className="af-grid">
                  {fields.has('rooms') && <Chips label="Oda sayısı" options={OPTIONS.rooms} value={form.rooms} onChange={(v) => set('rooms', v)} wide />}
                  {fields.has('grossM2') && (
                    <Text label={form.type === 'arsa' || form.type === 'tarla' ? 'Alan' : 'Brüt alan'} value={form.grossM2} onChange={(v) => set('grossM2', v)} suffix="m²" numeric />
                  )}
                  {fields.has('netM2') && <Text label="Net alan" value={form.netM2} onChange={(v) => set('netM2', v)} suffix="m²" numeric />}
                  {fields.has('buildingAge') && <Text label="Bina yaşı" value={form.buildingAge} onChange={(v) => set('buildingAge', v)} suffix="yıl" numeric />}
                  {fields.has('bathrooms') && <Text label="Banyo sayısı" value={form.bathrooms} onChange={(v) => set('bathrooms', v)} numeric />}
                  {fields.has('floor') && <Chips label="Bulunduğu kat" options={OPTIONS.floor} value={form.floor} onChange={(v) => set('floor', v)} wide />}
                  {fields.has('heating') && <Chips label="Isıtma" options={OPTIONS.heating} value={form.heating} onChange={(v) => set('heating', v)} wide />}
                  {fields.has('furnished') && <Chips label="Eşyalı mı?" options={['Evet', 'Hayır']} value={yn(form.furnished)} onChange={(v) => set('furnished', ny(v))} />}
                  {fields.has('inSite') && <Chips label="Site içinde mi?" options={['Evet', 'Hayır']} value={yn(form.inSite)} onChange={(v) => set('inSite', ny(v))} />}
                  {fields.has('zoning') && <Chips label="İmar durumu" options={OPTIONS.zoning} value={form.zoning} onChange={(v) => set('zoning', v)} wide />}
                  {fields.has('deed') && <Chips label="Tapu durumu" options={OPTIONS.deed} value={form.deed} onChange={(v) => set('deed', v)} wide />}
                  {fields.has('parcel') && <Text label="Ada / Parsel" value={form.parcel} onChange={(v) => set('parcel', v)} placeholder="Örn. 125 / 4" max={60} />}
                  {fields.has('brand') && <Text label="Marka" value={form.brand} onChange={(v) => set('brand', v)} placeholder="Örn. Renault" max={40} />}
                  {fields.has('model') && <Text label="Model" value={form.model} onChange={(v) => set('model', v)} placeholder="Örn. Clio 1.0" max={80} />}
                  {fields.has('modelYear') && <Text label="Model yılı" value={form.modelYear} onChange={(v) => set('modelYear', v.slice(0, 4))} numeric />}
                  {fields.has('km') && <Text label="Kilometre" value={form.km} onChange={(v) => set('km', v)} suffix="km" numeric />}
                  {fields.has('fuel') && <Chips label="Yakıt" options={OPTIONS.fuel} value={form.fuel} onChange={(v) => set('fuel', v)} wide />}
                  {fields.has('gear') && <Chips label="Vites" options={OPTIONS.gear} value={form.gear} onChange={(v) => set('gear', v)} />}
                </div>
                {FEATURE_SUGGESTIONS[form.type].length > 0 && (
                  <div className="af wide">
                    <span>
                      Öne çıkan özellikler <i className="opt">isteğe bağlı</i>
                    </span>
                    <div className="chip-row">
                      {FEATURE_SUGGESTIONS[form.type].map((f) => {
                        const on = form.features.includes(f);
                        return (
                          <button key={f} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => set('features', on ? form.features.filter((x) => x !== f) : [...form.features, f])}>
                            {on ? '✓ ' : '+ '}
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Section>
            )}

            <Section n={form.type && form.type !== 'diger' ? 4 : 3} title="Fiyat ve açıklama">
              <div className="af-grid">
                <Text
                  label={form.deal === 'kiralik' ? 'Aylık kira beklentiniz' : 'Fiyat beklentiniz'}
                  value={form.price ? new Intl.NumberFormat('tr-TR').format(Number(form.price)) : ''}
                  onChange={(v) => set('price', v)}
                  suffix="TL"
                  numeric
                  placeholder="Boş bırakırsanız birlikte belirleriz"
                />
                <label className="af wide">
                  <span>
                    Açıklama <i className="opt">isteğe bağlı</i>
                  </span>
                  <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value.slice(0, 3000))} placeholder="Eklemek istediğiniz her şey…" />
                </label>
              </div>
            </Section>

            <Section n={form.type && form.type !== 'diger' ? 5 : 4} title="Fotoğraflar" hint={`En fazla ${MAX_PHOTOS} fotoğraf. Fotoğraflar küçültülür ve içlerindeki konum bilgisi silinir.`}>
              {photos.length > 0 && (
                <ul className="photo-grid">
                  {photos.map((p, i) => (
                    <li key={p.id}>
                      <img src={p.kind === 'new' ? p.preview : p.thumb} alt={`Fotoğraf ${i + 1}`} />
                      {i === 0 && <span className="cover-tag">Kapak</span>}
                      <button type="button" className="photo-remove" onClick={() => removePhoto(p.id)} aria-label="Fotoğrafı kaldır">
                        <IconClose width={16} height={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {photos.length < MAX_PHOTOS && (
                <label
                  className="photo-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void addFiles(e.dataTransfer.files);
                  }}
                >
                  <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
                  <IconCamera width={28} height={28} />
                  <strong>{preparing ? `Hazırlanıyor… (${preparing})` : 'Fotoğraf ekle'}</strong>
                  <span className="small muted">
                    {photos.length}/{MAX_PHOTOS} · dokunun ya da sürükleyin
                  </span>
                </label>
              )}
              {photoErrors.map((e) => (
                <small key={e} className="af-error">
                  {e}
                </small>
              ))}
            </Section>

            <Section n={form.type && form.type !== 'diger' ? 6 : 5} title="İletişim bilgileriniz" hint="Sizi bu numaradan arayacağız.">
              <div className="af-grid">
                <Text label="Ad Soyad" value={form.name} onChange={(v) => set('name', v)} required error={errors.name} autoComplete="name" max={80} />
                <label className={`af ${errors.phone ? 'has-error' : ''}`}>
                  <span>
                    Cep telefonu <b className="req">*</b>
                  </span>
                  <div className="af-input phone">
                    <em className="prefix">+90</em>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="5XX XXX XX XX"
                      value={formatPhone(form.phone)}
                      onChange={(e) => set('phone', phoneDigits(e.target.value))}
                      aria-invalid={!!errors.phone}
                    />
                  </div>
                  {errors.phone && <small className="af-error">{errors.phone}</small>}
                </label>
                <Text label="E-posta" value={form.email} onChange={(v) => set('email', v.trim())} error={errors.email} autoComplete="email" max={120} />
              </div>
            </Section>

            <div className="apply-submit">
              <label className={`check ${errors.kvkk ? 'has-error' : ''}`}>
                <input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} />
                <span>
                  <Link to="/kvkk" target="_blank">
                    KVKK Aydınlatma Metni
                  </Link>
                  'ni okudum. Bilgilerimin başvurumun değerlendirilmesi için işlenmesine ve Google Firebase (Almanya) sunucularında
                  saklanmasına açık rıza veriyorum. <b className="req">*</b>
                </span>
              </label>
              {errors.kvkk && <small className="af-error">{errors.kvkk}</small>}
              {submitError && (
                <div className="apply-notice error" role="alert">
                  {submitError}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!!sending || preparing > 0 || !configured}>
                {sending || (editing ? 'Güncellenmiş başvuruyu gönder' : 'Başvuruyu gönder')}
              </button>
              <p className="small muted center">
                Sorunuz mu var?{' '}
                <a href={generalWhatsappLink()} target="_blank" rel="noopener noreferrer">
                  <IconWhatsapp width={14} height={14} /> WhatsApp'tan yazın
                </a>
              </p>
            </div>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}

function ApplyHero() {
  return (
    <div className="apply-hero">
      <p className="eyebrow">Ücretsiz ilan başvurusu</p>
      <h1>Mülkünüzü birlikte satalım ya da kiralayalım</h1>
      <p className="muted">Birkaç bilgi ve fotoğraf yeterli. Zorunlu olanlar yalnızca ilan tipi, adınız ve telefonunuz.</p>
    </div>
  );
}

const yn = (v: '' | 'evet' | 'hayir') => (v === 'evet' ? 'Evet' : v === 'hayir' ? 'Hayır' : '');
const ny = (v: string): '' | 'evet' | 'hayir' => (v === 'Evet' ? 'evet' : v === 'Hayır' ? 'hayir' : '');

/**
 * Adres çubuğunu geçmişe kayıt eklemeden günceller. ga-init.js'in sakladığı özgün replaceState kullanılır;
 * böylece Analytics her yazışta yeni sayfa görüntülemesi saymaz.
 */
function replaceUrl(url: string) {
  const native = (window as Window & { akReplaceState?: History['replaceState'] }).akReplaceState ?? History.prototype.replaceState;
  native.call(window.history, window.history.state, '', url);
}

/** Yeni başvuru: bağlantı parametreleri + önceki başvurudaki iletişim bilgileri (tekrar yazmamak için) */
function initialForm(search: string, last?: StoredApplication): ApplyForm {
  const base: ApplyForm = last ? { ...EMPTY_FORM, name: last.form.name, phone: last.form.phone, email: last.form.email } : EMPTY_FORM;
  return formFromParams(search, base);
}
