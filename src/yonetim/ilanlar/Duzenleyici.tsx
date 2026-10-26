import { useEffect, useState, type ReactNode } from 'react';
import { CATEGORY_GROUP, CATEGORY_LABEL, type Category } from '../../types';
import { fotografUrl, useBasvuru } from '../basvurular/veri';
import { basvurudanIlan, type IlanTaslak } from '../donustur';
import { IkonGeri } from '../ikonlar';
import { useYetkili } from '../oturum';
import { git } from '../router';
import { durumOf, hataMetni, ilanKaydet, ilanlariGetir, istekKimligi, turOf, type FotoGirdi, type IlanKaydi } from './api';
import Fotograflar, { fotoGirdisi, type FotoSecim } from './Fotograflar';

export type DuzenleyiciModu = { mod: 'yeni' } | { mod: 'duzenle'; ilanNo: string } | { mod: 'basvuru'; basvuruId: string };

/** Formda her alan metin olarak tutulur; kaydederken türüne çevrilir */
type Form = Record<string, string> & { ozellikler: string; firsat: string };

const SAYILAR = ['fiyat', 'brutM2', 'netM2', 'banyoSayisi', 'binaYasi', 'modelYili', 'km'];
const BOS: Form = { baslik: '', kategori: 'daire', tur: 'satilik', fiyat: '', paraBirimi: 'TRY', durum: 'yayinda', ozellikler: '', firsat: '' };

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
  const { uid } = useYetkili();
  const basvuru = useBasvuru(p.mod === 'basvuru' ? p.basvuruId : null);
  const [form, setForm] = useState<Form | null>(p.mod === 'yeni' ? { ...BOS } : null);
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
    if (!form!.baslik.trim()) return setDurum({ ad: 'hata', mesaj: 'Başlık zorunlu.' });
    setDurum({ ad: 'kaydediliyor' });
    try {
      const r = await ilanKaydet({
        ilan: ilanOf(form!),
        ilanNo: p.mod === 'duzenle' ? p.ilanNo : undefined,
        surum: p.mod === 'duzenle' ? surum : undefined,
        istekId,
        basvuruId: p.mod === 'basvuru' ? p.basvuruId : undefined,
        fotograflar: fotolar.map(fotoGirdisi).filter((x): x is FotoGirdi => x !== null),
      });
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

      <Bolum baslik="Fotoğraflar">
        <Fotograflar uid={uid} fotolar={fotolar} degistir={setFotolar} />
      </Bolum>

      <Bolum baslik="Temel bilgiler">
        <Alan ad="Başlık *" deger={form.baslik} degis={(v) => set('baslik', v)} max={140} />
        <label className="y-alan">
          <span>Kategori</span>
          <select value={form.kategori} onChange={(e) => set('kategori', e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([k, ad]) => (
              <option key={k} value={k}>
                {ad}
              </option>
            ))}
          </select>
        </label>
        {form.kategori === 'diger' && <Alan ad="Kategori adı" deger={form.kategoriAdi ?? ''} degis={(v) => set('kategoriAdi', v)} ipucu="Örn. Tekne" max={40} />}
        <Secim ad="İşlem" secenekler={[['satilik', 'Satılık'], ['kiralik', 'Kiralık']]} deger={form.tur} degis={(v) => set('tur', v)} />
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

      <Bolum baslik="Konum">
        <Alan ad="İl" deger={form.il ?? ''} degis={(v) => set('il', v)} ipucu="Gaziantep" max={60} />
        <div className="y-iki">
          <Alan ad="İlçe" deger={form.ilce ?? ''} degis={(v) => set('ilce', v)} max={60} />
          <Alan ad="Mahalle" deger={form.mahalle ?? ''} degis={(v) => set('mahalle', v)} max={80} />
        </div>
      </Bolum>

      {grup !== 'diger' && (
        <Bolum baslik="Özellikler">
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
            </div>
          )}
        </Bolum>
      )}

      <Bolum baslik="Açıklama">
        <Alan ad="Öne çıkan özellikler" deger={form.ozellikler} degis={(v) => set('ozellikler', v)} ipucu="Virgülle ayırın: Bahçe, Otopark" />
        <label className="y-alan">
          <span>Açıklama</span>
          <textarea value={form.aciklama ?? ''} onChange={(e) => set('aciklama', e.target.value)} maxLength={5000} rows={5} />
        </label>
      </Bolum>

      <Bolum baslik="Yayın">
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
