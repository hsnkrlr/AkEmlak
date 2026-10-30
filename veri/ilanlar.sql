-- Ak Emlak ilanları (public/data.json kopyası) — 2026-10-30T18:33:21.183Z
-- MySQL / MariaDB için. phpMyAdmin → İçe aktar ile yüklenebilir.
SET NAMES utf8mb4;
DROP TABLE IF EXISTS ilanlar;
CREATE TABLE ilanlar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ilan_no VARCHAR(20),
  baslik TEXT,
  tur TEXT,
  kategori TEXT,
  kategori_adi TEXT,
  fiyat DECIMAL(15,2),
  para_birimi TEXT,
  il TEXT,
  ilce TEXT,
  mahalle TEXT,
  brut_m2 DECIMAL(15,2),
  net_m2 DECIMAL(15,2),
  oda_sayisi TEXT,
  banyo_sayisi DECIMAL(15,2),
  kat TEXT,
  bina_yasi DECIMAL(15,2),
  isitma TEXT,
  imar_durumu TEXT,
  tapu_durumu TEXT,
  ada_parsel TEXT,
  marka TEXT,
  model TEXT,
  model_yili DECIMAL(15,2),
  km DECIMAL(15,2),
  yakit TEXT,
  vites TEXT,
  renk TEXT,
  ozellikler TEXT,
  aciklama TEXT,
  fotograflar TEXT,
  durum TEXT,
  firsat TINYINT(1) NOT NULL DEFAULT 0,
  tarih DATE,
  baglanti TEXT
) DEFAULT CHARSET=utf8mb4;
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10012', 'Sanayide kiralık iş yeri', 'kiralik', 'imalathane', NULL, 12000, 'TRY', NULL, 'Nurdağı', 'Aslanlı', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '["D Blok"]', 'D Blok - Traktörcünün Karşısı', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10011', 'Bademli Tokiler', 'satilik', 'daire', NULL, 2250000, 'TRY', NULL, 'Nurdağı', 'Bademli', NULL, NULL, '2+1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '["Cam Balkon","Klima","Kombi","Yeni Dolap Yapılı"]', 'Tapusu Hazır', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10010', 'Aşağı Olucak Mezarlık Karşısı', 'satilik', 'bag_bahce', NULL, 7500000, 'TRY', NULL, 'Nurdağı', 'Olucak', 1114, 170, '3+1', NULL, NULL, NULL, NULL, NULL, NULL, '170/8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '1114m² Arsa içinde 170m² ev dahil', '["ak-10010-1-35dd.webp","ak-10010-2-2600.webp","ak-10010-3-9463.webp","ak-10010-4-f39e.webp","ak-10010-5-cad7.webp","ak-10010-6-1af3.webp","ak-10010-7-dda8.webp","ak-10010-8-9e58.webp","ak-10010-9-cfc6.webp"]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10009', 'Yukarı Olucak mahallesi', 'satilik', 'arsa', NULL, 0, 'TRY', NULL, 'Nurdağı', 'Olucak', 1460, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Tek tapu', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10008', 'Esenyurt mahallesi 450m² arsa', 'satilik', 'arsa', NULL, 2000000, 'TRY', NULL, 'Nurdağı', 'Esenyurt', 450, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Ada 450 parsel 3', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10007', 'Bahçelievler mahallesinde 499m² arsa', 'satilik', 'arsa', NULL, 400000, 'TRY', NULL, 'Nurdağı', 'Bahçelievler', 499, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Çarşıya yakın, tek tapu', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10006', 'İslahiye Eski Yol Altı Çiftlik', 'satilik', 'ciftlik', 'Çiftlik', 12500000, 'TRY', NULL, 'Nurdağı', NULL, 2600, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Yol Altı satılık çiftlik', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10005', 'Esenyurt Müstakil Ev', 'kiralik', 'mustakil', NULL, 12000, 'TRY', NULL, 'Nurdağı', 'Esenyurt', NULL, NULL, '3+1', 1, '1', NULL, 'Doğalgaz', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'İki katlı müstakil evin alt katı', '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10004', 'Yukarı Olucak Elmacık Yaylası', 'satilik', 'arsa', NULL, 2000000, 'TRY', 'Gaziantepe', 'Nurdağı', 'Olucak', 2000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10003', 'Beyoğlu Kalenin Batısı', 'satilik', 'arsa', NULL, 3000000, 'TRY', 'Kahramanmaraş', 'Türkoğlu', 'Beyoğlu', 1150, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', 'yayinda', 0, '2026-10-30', NULL);
INSERT INTO ilanlar (ilan_no, baslik, tur, kategori, kategori_adi, fiyat, para_birimi, il, ilce, mahalle, brut_m2, net_m2, oda_sayisi, banyo_sayisi, kat, bina_yasi, isitma, imar_durumu, tapu_durumu, ada_parsel, marka, model, model_yili, km, yakit, vites, renk, ozellikler, aciklama, fotograflar, durum, firsat, tarih, baglanti) VALUES ('AK-10002', 'Esenyurt 356m² arsa', 'satilik', 'arsa', NULL, 1500000, 'TRY', NULL, 'Nurdağı', 'Esenyurt', 356, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', 'yayinda', 0, '2026-10-30', NULL);
