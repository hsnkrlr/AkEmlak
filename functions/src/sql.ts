/**
 * data.json ilanlarından MySQL / MariaDB uyumlu SQL dökümü (phpMyAdmin ile içe aktarılabilir).
 * Saf modül: hem sunucu fonksiyonu (GitHub'daki veri/ilanlar.sql) hem yönetim uygulaması (indir) kullanır.
 */
type Ilan = Record<string, unknown>;

/** [sütun, data.json alanı, tür] */
const SUTUNLAR: [string, string, 'metin' | 'sayi' | 'mantik' | 'liste' | 'tarih'][] = [
  ['ilan_no', 'ilanNo', 'metin'], ['baslik', 'baslik', 'metin'], ['tur', 'tur', 'metin'], ['kategori', 'kategori', 'metin'],
  ['kategori_adi', 'kategoriAdi', 'metin'], ['fiyat', 'fiyat', 'sayi'], ['para_birimi', 'paraBirimi', 'metin'],
  ['il', 'il', 'metin'], ['ilce', 'ilce', 'metin'], ['mahalle', 'mahalle', 'metin'], ['brut_m2', 'brutM2', 'sayi'], ['net_m2', 'netM2', 'sayi'],
  ['oda_sayisi', 'odaSayisi', 'metin'], ['banyo_sayisi', 'banyoSayisi', 'sayi'], ['kat', 'kat', 'metin'], ['bina_yasi', 'binaYasi', 'sayi'],
  ['isitma', 'isitma', 'metin'], ['imar_durumu', 'imarDurumu', 'metin'], ['tapu_durumu', 'tapuDurumu', 'metin'], ['ada_parsel', 'adaParsel', 'metin'],
  ['marka', 'marka', 'metin'], ['model', 'model', 'metin'], ['model_yili', 'modelYili', 'sayi'], ['km', 'km', 'sayi'], ['yakit', 'yakit', 'metin'],
  ['vites', 'vites', 'metin'], ['renk', 'renk', 'metin'], ['ozellikler', 'ozellikler', 'liste'], ['aciklama', 'aciklama', 'metin'],
  ['fotograflar', 'fotograflar', 'liste'], ['durum', 'durum', 'metin'], ['firsat', 'firsat', 'mantik'], ['tarih', 'tarih', 'tarih'], ['baglanti', 'baglanti', 'metin'],
];
const SQL_TUR = { metin: 'TEXT', sayi: 'DECIMAL(15,2)', mantik: 'TINYINT(1) NOT NULL DEFAULT 0', liste: 'TEXT', tarih: 'DATE' };

/** MySQL dize sabiti: tek tırnak ve ters bölü kaçışlı, satır sonları \n */
const dize = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\r?\n/g, '\\n').replace(/\0/g, '')}'`;

function deger(v: unknown, tur: (typeof SUTUNLAR)[number][2]): string {
  if (tur === 'mantik') return v === true ? '1' : '0';
  if (v === undefined || v === null || v === '') return 'NULL';
  if (tur === 'sayi') return typeof v === 'number' && Number.isFinite(v) ? String(v) : 'NULL';
  if (tur === 'liste') return Array.isArray(v) ? dize(JSON.stringify(v)) : 'NULL';
  if (tur === 'tarih') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dize(String(v)) : 'NULL';
  return dize(String(v));
}

export function sqlUret(ilanlar: Ilan[], tarih = new Date().toISOString()): string {
  const tablo = SUTUNLAR.map(([ad, , tur]) => `  ${ad} ${ad === 'ilan_no' ? 'VARCHAR(20)' : SQL_TUR[tur]}`);
  const satirlar = ilanlar.map(
    (i) => `INSERT INTO ilanlar (${SUTUNLAR.map(([a]) => a).join(', ')}) VALUES (${SUTUNLAR.map(([, k, t]) => deger(i[k], t)).join(', ')});`,
  );
  return [
    `-- Ak Emlak ilanları (public/data.json kopyası) — ${tarih}`,
    `-- MySQL / MariaDB için. phpMyAdmin → İçe aktar ile yüklenebilir.`,
    'SET NAMES utf8mb4;',
    'DROP TABLE IF EXISTS ilanlar;',
    `CREATE TABLE ilanlar (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n${tablo.join(',\n')}\n) DEFAULT CHARSET=utf8mb4;`,
    ...satirlar,
    '',
  ].join('\n');
}
