import { useEffect, useRef, useState, type ReactNode } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CATEGORY_GROUP, CATEGORY_LABEL, GROUP_LABEL, type Category, type CategoryGroup } from '../../types';
import { buyukHarfUygula, type BuyukHarfDurumu } from '../buyukHarf';
import { db } from '../firebase';
import { fotografUrl, useBasvuru } from '../basvurular/veri';
import { basvurudanIlan, type IlanTaslak } from '../donustur';
import { IkonGeri } from '../ikonlar';
import { useYetkili } from '../oturum';
import { git } from '../router';
import { durumOf, hataMetni, ilanKaydet, ilanlariGetir, istekKimligi, turOf, type FotoGirdi, type IlanKaydi } from './api';
import Fotograflar, { fotoGirdisi, type FotoSecim } from './Fotograflar';

export type DuzenleyiciModu = { mod: 'yeni' } | { mod: 'duzenle'; ilanNo: string } | { mod: 'basvuru'; basvuruId: string };

const IMAR = ['Konut İmarlı', 'Ticari İmarlı', 'Sanayi İmarlı', 'Tarla (İmarsız)', 'Köy İçi', 'Belirtilmemiş'];
const TAPU = ['Müstakil Tapu', 'Hisseli Tapu', 'Kat Mülkiyeti', 'Kat İrtifakı', 'Zilliyet'];
/** Kategori grubuna göre hızlı eklenen özellikler */
const ONERILER: Record<string, string[]> = {
  konut: ['Bahçeli', 'Otopark', 'Asansör', 'Balkon', 'Doğalgaz', 'Eşyalı', 'Site İçinde', 'Güvenlik', 'Ankastre Mutfak', 'Camiye Yakın', 'Okula Yakın', 'Krediye Uygun', 'Takasa Uygun'],
  arsa: ['Yola Cepheli', 'Köşe Parsel', 'Elektrik Var', 'Su Var', 'Kuyu', 'Sulama İmkânı', 'Manzaralı', 'Düz Arazi', 'Meyve Ağaçlı', 'Fıstık Ağaçlı', 'Zeytin Ağaçlı', 'Asfalta Yakın', 'Takasa Uygun'],
  isyeri: ['Cadde Üzeri', 'Vitrinli', 'Depolu', 'Asma Katlı', 'Tır Girişli', 'Trifaze Elektrik', 'Otoparklı', 'Kiracılı', 'Devren'],
  vasita: ['Hasar Kayıtsız', 'Boyasız', 'Değişensiz', 'Servis Bakımlı', 'İlk Sahibinden', 'Takasa Uygun', 'Krediye Uygun'],
  diger: ['Takasa Uygun', 'Pazarlık Payı Var', 'Acil Satılık'],
};

/** Formda her alan metin olarak tutulur; kaydederken türüne çevrilir */
type Form = Record<string, string> & { ozellikler: string; firsat: string };

const SAYILAR = ['fiyat', 'brutM2', 'netM2', 'banyoSayisi', 'binaYasi', 'modelYili', 'km'];
const BOS: Form = { baslik: '', kategori: 'daire', tur: 'satilik', fiyat: '', paraBirimi: 'TRY', durum: 'yayinda', ozellikler: '', firsat: '' };

/** Son girilen konum bu cihazda hatırlanır; ilk seferde Gaziantep / Nurdağı */
const KONUM_ANAHTARI = 'ak.yonetim.konum';
function sonKonum(): { il: string; ilce: string; mahalle: string } {
  try {
    const k = JSON.parse(localStorage.getItem(KONUM_ANAHTARI) || 'null');
    if (k && typeof k === 'object') return { il: String(k.il ?? ''), ilce: String(k.ilce ?? ''), mahalle: String(k.mahalle ?? '') };
  } catch {
    /* depolama kapalı */
  }
  return { il: 'Gaziantep', ilce: 'Nurdağı', mahalle: '' };
}
function konumuHatirla(f: Form) {
  try {
    localStorage.setItem(KONUM_ANAHTARI, JSON.stringify({ il: f.il ?? '', ilce: f.ilce ?? '', mahalle: f.mahalle ?? '' }));
  } catch {
    /* yok say */
  }
}

/** "Nurdağı Esenyurt Satılık Arsa" */
function baslikOnerisi(f: Form): string {
  const mahalle = (f.mahalle ?? '').replace(/\s+(mahallesi|mah\.?)$/i, '');
  const kat = f.kategori === 'diger' ? f.kategoriAdi ?? '' : CATEGORY_LABEL[f.kategori as Category] ?? '';
  return [f.ilce, mahalle, f.tur === 'kiralik' ? 'Kiralık' : 'Satılık', kat.split(' / ')[0]].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
}

const GRUPLAR: CategoryGroup[] = ['konut', 'arsa', 'isyeri', 'vasita', 'diger'];
type Sahip = { ad: string; telefon: string; not: string };

function formOf(i: IlanTaslak | IlanKaydi): Form {
  const f: Form = { ...BOS };
  for (const [k, v] of Object.entries(i)) {
    if (k === 'ozellikler' && Array.isArray(v)) f.ozellikler = v.join(', ');
    else if (k === 'firsat') f.firsat = v === true ? '1' : '';
    else if (typeof v === 'string' || typeof v === 'number') f[k] = String(v);
  }
  if (!f.kategori) f.kategori = 'diger';
  // Elle yazılmış eşdeğer değerler (kiralık, taslak, usd…) seçim düğmelerinde doğru görünsün
  f.tur = turOf(f.tur);
  f.durum = durumOf(f.durum);
  f.paraBirimi = ['USD', 'EUR'].includes(f.paraBirimi.toUpperCase()) ? f.paraBirimi.toUpperCase() : 'TRY';
  return f;
}

function ilanOf(f: Form): IlanTaslak {
  const i: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    const t = v.trim();
    if (!t || k === 'ozellikler' || k === 'firsat') continue;
    if (SAYILAR.includes(k)) {
      const n = Number(t.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n)) i[k] = n;
    } else i[k] = t;
  }
  const oz = f.ozellikler.split(',').map((s) => s.trim()).filter(Boolean);
  if (oz.length) i.ozellikler = oz;
  if (f.firsat) i.firsat = true;
  if (!f.fiyat.trim()) i.fiyat = 0;
  return i as unknown as IlanTaslak;
}

export default function Duzenleyici(p: DuzenleyiciModu) {
  const { uid, email } = useYetkili();
  const basvuru = useBasvuru(p.mod === 'basvuru' ? p.basvuruId : null);
  const [form, setForm] = useState<Form | null>(p.mod === 'yeni' ? { ...BOS, ...sonKonum() } : null);
  const [sahip, setSahip] = useState<Sahip>({ ad: '', telefon: '', not: '' });
  const baslikHarf = useRef<BuyukHarfDurumu>({ iptal: new Set() });
  const aciklamaHarf = useRef<BuyukHarfDurumu>({ iptal: new Set() });

  // İlan sahibi (gizli): düzenlemede Firestore'dan oku
  useEffect(() => {
    if (p.mod !== 'duzenle') return;
    getDoc(doc(db, 'ilanSahipleri', p.ilanNo)).then(
      (d) => d.exists() && setSahip({ ad: String(d.get('ad') ?? ''), telefon: String(d.get('telefon') ?? ''), not: String(d.get('not') ?? '') }),
      () => undefined,
    );
  }, [p.mod, p.mod === 'duzenle' ? p.ilanNo : '']);
  const [fotolar, setFotolar] = useState<FotoSecim[]>([]);
  const [yukHata, setYukHata] = useState('');
  const [surum, setSurum] = useState<string | undefined>(undefined);
  // Bu formun kaydı için tek kimlik: "Tekrar dene" aynı kaydı iki kez yayınlamaz
  const [istekId] = useState(istekKimligi);
  const [durum, setDurum] = useState<{ ad: 'hazir' } | { ad: 'kaydediliyor' } | { ad: 'hata'; mesaj: string } | { ad: 'tamam'; ilanNo: string; baglanti: string }>({ ad: 'hazir' });

  // Düzenleme: güncel ilanı GitHub'dan getir
  useEffect(() => {
    if (p.mod !== 'duzenle') return;
    // Her açılışta güncel hâli okunur (başka yetkilinin değişikliği ezilmesin)
    ilanlariGetir(true).then(
      ({ ilanlar, surumler }) => {
        const i = ilanlar.find((x) => x.ilanNo === p.ilanNo);
        if (!i) return setYukHata('İlan bulunamadı.');
        setSurum(surumler[p.ilanNo]);
        setForm(formOf(i));
        setFotolar((i.fotograflar ?? []).map((ad) => ({ anahtar: ad, tur: 'mevcut', ad, onizleme: `/img/${encodeURIComponent(ad)}` })));
      },
      (e) => setYukHata(hataMetni(e)),
    );
  }, [p.mod, p.mod === 'duzenle' ? p.ilanNo : '']);

  // Başvurudan: taslak ve fotoğrafları başvurudan doldur
  useEffect(() => {
    if (p.mod !== 'basvuru' || !basvuru || form) return;
    setForm(formOf(basvurudanIlan(basvuru)));
    setSahip({ ad: basvuru.seller.name, telefon: basvuru.seller.phone, not: `Başvuru ${basvuru.number}` });
    setFotolar(basvuru.photos.map((yol) => ({ anahtar: yol, tur: 'basvuru', yol, onizleme: null })));
    for (const yol of basvuru.photos) {
      fotografUrl(yol).then(
        (u) => setFotolar((o) => o.map((f) => (f.tur === 'basvuru' && f.yol === yol ? { ...f, onizleme: u } : f))),
        () => undefined,
      );
    }
  }, [p.mod, basvuru, form]);

  const geri = () => git(p.mod === 'basvuru' ? `/basvuru/${p.basvuruId}` : '/ilanlar');
  const baslik = p.mod === 'yeni' ? 'Yeni ilan' : p.mod === 'duzenle' ? `İlanı düzenle · ${p.ilanNo}` : 'Başvurudan ilan';

  if (durum.ad === 'tamam') {
    return (
      <section>
        <h1 className="y-baslik">Kaydedildi</h1>
        <div className="y-basari">
          <b>{durum.ilanNo}</b> sitede yayına alınıyor. 1–2 dakika içinde görünür.
        </div>
        <div className="y-menu">
          <a className="y-btn" href={durum.baglanti} target="_blank" rel="noopener noreferrer">
            İlanı sitede aç
          </a>
          <a className="y-btn y-btn-ana" href="#/ilanlar">
            İlanlara dön
          </a>
        </div>
      </section>
    );
  }

  if (p.mod === 'basvuru' && basvuru === null) return <p className="y-bos">Başvuru bulunamadı.</p>;
  if (yukHata) return <p className="y-hata">{yukHata}</p>;
  if (!form) return <p className="y-bos">Yükleniyor…</p>;

  const set = (k: string, v: string) => setForm((f) => ({ ...f!, [k]: v }));
  const grup = CATEGORY_GROUP[form.kategori as Category] ?? 'diger';
  const yukleniyor = fotolar.some((f) => f.tur === 'yukleme' && !f.yol);
  const kiralik = form.tur === 'kiralik';

  async function kaydet() {
    const f = form!.baslik.trim() ? form! : { ...form!, baslik: baslikOnerisi(form!) };
    if (!f.baslik.trim()) return setDurum({ ad: 'hata', mesaj: 'Başlık yazın.' });
    setDurum({ ad: 'kaydediliyor' });
    try {
      const r = await ilanKaydet({
        ilan: ilanOf(f),
        ilanNo: p.mod === 'duzenle' ? p.ilanNo : undefined,
        surum: p.mod === 'duzenle' ? surum : undefined,
        istekId,
        basvuruId: p.mod === 'basvuru' ? p.basvuruId : undefined,
        fotograflar: fotolar.map(fotoGirdisi).filter((x): x is FotoGirdi => x !== null),
      });
      konumuHatirla(f);
      // İlan sahibi bilgisi yalnızca Firestore'a (yetkililere açık) yazılır, sitede yayınlanmaz
      if (sahip.ad.trim() || sahip.telefon.trim() || sahip.not.trim() || p.mod === 'duzenle') {
        await setDoc(doc(db, 'ilanSahipleri', r.ilanNo), {
          ad: sahip.ad.trim().slice(0, 80),
          telefon: sahip.telefon.trim().slice(0, 20),
          not: sahip.not.trim().slice(0, 1000),
          guncelleyen: email,
          guncellendi: serverTimestamp(),
        }).catch(() => undefined);
      }
      setDurum({ ad: 'tamam', ilanNo: r.ilanNo, baglanti: r.baglanti });
      window.scrollTo(0, 0);
    } catch (e) {
      setDurum({ ad: 'hata', mesaj: hataMetni(e) });
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void kaydet();
      }}
    >
      <button type="button" className="y-geri" onClick={geri}>
        <IkonGeri /> Geri
      </button>
      <h1 className="y-baslik">{baslik}</h1>

      <Bolum baslik="1. İlan tipi">
        {GRUPLAR.map((g) => (
          <div key={g} className="y-alan">
            <span>{GROUP_LABEL[g]}</span>
            <div className="y-secenekler">
              {(Object.keys(CATEGORY_LABEL) as Category[])
                .filter((k) => CATEGORY_GROUP[k] === g)
                .map((k) => (
                  <button key={k} type="button" className={`y-cip ${form.kategori === k ? 'on' : ''}`} aria-pressed={form.kategori === k} onClick={() => set('kategori', k)}>
                    {CATEGORY_LABEL[k]}
                  </button>
                ))}
            </div>
          </div>
        ))}
        {form.kategori === 'diger' && <Alan ad="Kategori adı" deger={form.kategoriAdi ?? ''} degis={(v) => set('kategoriAdi', v)} ipucu="Örn. Tekne" max={40} />}
        <Secim ad="Satılık / Kiralık" secenekler={[['satilik', 'Satılık'], ['kiralik', 'Kiralık']]} deger={form.tur} degis={(v) => set('tur', v)} />
      </Bolum>

      <Bolum baslik="2. Konum">
        <Alan ad="İl" deger={form.il ?? ''} degis={(v) => set('il', v)} ipucu="Gaziantep" max={60} />
        <p className="y-soluk y-kucuk" style={{ marginTop: -6 }}>Son girdiğiniz konum hatırlanır; gerekirse değiştirin.</p>
        <div className="y-iki">
          <Alan ad="İlçe" deger={form.ilce ?? ''} degis={(v) => set('ilce', v)} max={60} />
          <Alan ad="Mahalle" deger={form.mahalle ?? ''} degis={(v) => set('mahalle', v)} max={80} />
        </div>
      </Bolum>

      <Bolum baslik="3. Fiyat">
        <div className="y-iki">
          <Alan ad={kiralik ? 'Aylık kira' : 'Fiyat'} deger={form.fiyat} degis={(v) => set('fiyat', v.replace(/[^\d]/g, ''))} sayi ipucu="Boş: Fiyat için arayın" />
          <label className="y-alan">
            <span>Para birimi</span>
            <select value={form.paraBirimi || 'TRY'} onChange={(e) => set('paraBirimi', e.target.value)}>
              <option value="TRY">TL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
      </Bolum>

      {grup !== 'diger' && (
        <Bolum baslik="4. Ayrıntılar">
          {grup === 'vasita' ? (
            <>
              <div className="y-iki">
                <Alan ad="Marka" deger={form.marka ?? ''} degis={(v) => set('marka', v)} max={40} />
                <Alan ad="Model" deger={form.model ?? ''} degis={(v) => set('model', v)} max={80} />
                <Alan ad="Model yılı" deger={form.modelYili ?? ''} degis={(v) => set('modelYili', v)} sayi />
                <Alan ad="Kilometre" deger={form.km ?? ''} degis={(v) => set('km', v)} sayi />
                <Alan ad="Yakıt" deger={form.yakit ?? ''} degis={(v) => set('yakit', v)} max={30} />
                <Alan ad="Vites" deger={form.vites ?? ''} degis={(v) => set('vites', v)} max={30} />
              </div>
              <Alan ad="Renk" deger={form.renk ?? ''} degis={(v) => set('renk', v)} max={30} />
            </>
          ) : (
            <div className="y-iki">
              <Alan ad={grup === 'arsa' ? 'Alan (m²)' : 'Brüt m²'} deger={form.brutM2 ?? ''} degis={(v) => set('brutM2', v)} sayi />
              {grup !== 'arsa' && <Alan ad="Net m²" deger={form.netM2 ?? ''} degis={(v) => set('netM2', v)} sayi />}
              {grup === 'konut' && <Alan ad="Oda sayısı" deger={form.odaSayisi ?? ''} degis={(v) => set('odaSayisi', v)} ipucu="3+1" max={20} />}
              {grup === 'konut' && <Alan ad="Banyo" deger={form.banyoSayisi ?? ''} degis={(v) => set('banyoSayisi', v)} sayi />}
              {grup !== 'arsa' && <Alan ad="Kat" deger={form.kat ?? ''} degis={(v) => set('kat', v)} max={30} />}
              {grup !== 'arsa' && <Alan ad="Bina yaşı" deger={form.binaYasi ?? ''} degis={(v) => set('binaYasi', v)} sayi />}
              {grup !== 'arsa' && <Alan ad="Isıtma" deger={form.isitma ?? ''} degis={(v) => set('isitma', v)} max={40} />}
              {grup === 'arsa' && <Alan ad="Ada / Parsel" deger={form.adaParsel ?? ''} degis={(v) => set('adaParsel', v)} ipucu="125 / 4" max={40} />}
            </div>
          )}
        </Bolum>
      )}

      {grup === 'arsa' && (
        <Bolum baslik="İmar ve tapu">
          <Secim ad="İmar durumu" secenekler={IMAR.map((x) => [x, x])} deger={form.imarDurumu ?? ''} degis={(v) => set('imarDurumu', form.imarDurumu === v ? '' : v)} />
          <Secim ad="Tapu durumu" secenekler={TAPU.map((x) => [x, x])} deger={form.tapuDurumu ?? ''} degis={(v) => set('tapuDurumu', form.tapuDurumu === v ? '' : v)} />
        </Bolum>
      )}

      <Bolum baslik="5. Özellikler ve açıklama">
        <Alan ad="Öne çıkan özellikler" deger={form.ozellikler} degis={(v) => set('ozellikler', v)} ipucu="Virgülle ayırın ya da aşağıdan seçin" />
        <div className="y-secenekler" style={{ marginTop: -4, marginBottom: 12 }} aria-label="Önerilen özellikler">
          {ONERILER[grup].map((o) => {
            const secili = form.ozellikler.split(',').map((x) => x.trim()).includes(o);
            return (
              <button
                key={o}
                type="button"
                className={`y-cip ${secili ? 'on' : ''}`}
                aria-pressed={secili}
                onClick={() => {
                  const liste = form.ozellikler.split(',').map((x) => x.trim()).filter(Boolean);
                  set('ozellikler', (secili ? liste.filter((x) => x !== o) : [...liste, o]).join(', '));
                }}
              >
                {secili ? '✓ ' : '+ '}
                {o}
              </button>
            );
          })}
        </div>
        <label className="y-alan">
          <span>Açıklama</span>
          <textarea
            value={form.aciklama ?? ''}
            onChange={(e) => set('aciklama', buyukHarfUygula(form.aciklama ?? '', e.target.value, 'cumle', aciklamaHarf.current))}
            autoCapitalize="sentences"
            maxLength={6000}
            rows={6}
          />
        </label>
      </Bolum>

      <Bolum baslik="6. Fotoğraflar">
        <Fotograflar uid={uid} fotolar={fotolar} degistir={setFotolar} />
      </Bolum>

      <Bolum baslik="7. İlan sahibi (yalnızca yöneticiler görür)">
        <div className="y-iki">
          <Alan ad="Ad soyad" deger={sahip.ad} degis={(v) => setSahip({ ...sahip, ad: v })} max={80} />
          <Alan ad="Telefon" deger={sahip.telefon} degis={(v) => setSahip({ ...sahip, telefon: v })} ipucu="+90 5XX XXX XX XX" max={20} />
        </div>
        <label className="y-alan">
          <span>Not</span>
          <textarea value={sahip.not} onChange={(e) => setSahip({ ...sahip, not: e.target.value })} maxLength={1000} rows={2} placeholder="Örn. Anahtar komşuda, komisyon %2" />
        </label>
        <p className="y-soluk y-kucuk" style={{ margin: 0 }}>Bu bilgiler sitede yayınlanmaz.</p>
      </Bolum>

      <Bolum baslik="8. Başlık">
        <label className="y-alan">
          <span>İlan başlığı</span>
          <input
            value={form.baslik}
            onChange={(e) => set('baslik', buyukHarfUygula(form.baslik, e.target.value, 'kelime', baslikHarf.current))}
            placeholder={baslikOnerisi(form) || 'Örn. Nurdağı Esenyurt Satılık Arsa'}
            autoCapitalize="words"
            maxLength={140}
          />
        </label>
        {!form.baslik.trim() && baslikOnerisi(form) && (
          <button type="button" className="y-btn y-btn-kucuk" onClick={() => set('baslik', baslikOnerisi(form))}>
            Öneriyi kullan: {baslikOnerisi(form)}
          </button>
        )}
      </Bolum>

      <Bolum baslik="9. Yayın">
        <Secim
          ad="Durum"
          secenekler={[['yayinda', 'Yayında'], ['satildi', kiralik ? 'Kiralandı' : 'Satıldı'], ['gizli', 'Gizli']]}
          deger={form.durum || 'yayinda'}
          degis={(v) => set('durum', v)}
        />
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600 }}>
          <input type="checkbox" checked={!!form.firsat} onChange={(e) => set('firsat', e.target.checked ? '1' : '')} style={{ width: 22, height: 22 }} />
          “Fırsat” etiketiyle en üstte göster
        </label>
      </Bolum>

      {durum.ad === 'hata' && (
        <p className="y-hata" role="alert">
          {durum.mesaj}
        </p>
      )}
      <div className="y-sabit-alt">
        <button type="submit" className="y-btn y-btn-ana y-btn-blok" disabled={durum.ad === 'kaydediliyor' || yukleniyor}>
          {durum.ad === 'kaydediliyor' ? 'Yayına alınıyor…' : yukleniyor ? 'Fotoğraflar yükleniyor…' : durum.ad === 'hata' ? 'Tekrar dene' : p.mod === 'duzenle' ? 'Kaydet' : 'Siteye ekle'}
        </button>
      </div>
    </form>
  );
}

function Bolum({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <section className="y-kart y-bolum">
      <h2>{baslik}</h2>
      {children}
    </section>
  );
}

function Alan({ ad, deger, degis, ipucu, sayi, max }: { ad: string; deger: string; degis: (v: string) => void; ipucu?: string; sayi?: boolean; max?: number }) {
  return (
    <label className="y-alan">
      <span>{ad}</span>
      <input value={deger} onChange={(e) => degis(e.target.value)} placeholder={ipucu} inputMode={sayi ? 'numeric' : undefined} maxLength={max} />
    </label>
  );
}

function Secim({ ad, secenekler, deger, degis }: { ad: string; secenekler: [string, string][]; deger: string; degis: (v: string) => void }) {
  return (
    <div className="y-alan" role="group" aria-label={ad}>
      <span>{ad}</span>
      <div className="y-secenekler">
        {secenekler.map(([k, etiket]) => (
          <button key={k} type="button" className={`y-cip ${deger === k ? 'on' : ''}`} aria-pressed={deger === k} onClick={() => degis(k)}>
            {etiket}
          </button>
        ))}
      </div>
    </div>
  );
}
