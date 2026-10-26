import { SITE } from '../config';
import { resetConsent, useConsent } from '../lib/consent';
import { usePageMeta } from '../lib/usePageMeta';
import { PublicLayout } from '../components/Layout';

/**
 * KVKK Aydınlatma Metni ve Çerez Politikası — TASLAK.
 * Yayına almadan önce bir hukukçuya kontrol ettirilmesi ve işletmenin resmî unvan/adres bilgileriyle tamamlanması önerilir.
 */
export default function Kvkk() {
  usePageMeta(`KVKK Aydınlatma Metni ve Çerez Politikası | ${SITE.name}`, `${SITE.name} kişisel verilerin korunması aydınlatma metni ve çerez politikası.`);
  const consent = useConsent();
  return (
    <PublicLayout>
      <article className="container section legal">
        <h1>KVKK Aydınlatma Metni</h1>
        <p className="muted small">Sürüm: Ekim 2026</p>

        <p>
          {SITE.name} ("Veri Sorumlusu", {SITE.city}) olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında,
          sitemizdeki ilan başvuru formu aracılığıyla paylaştığınız kişisel verileri aşağıda açıklanan şekilde işliyoruz.
        </p>

        <h2>1. İşlenen kişisel veriler</h2>
        <ul>
          <li>
            <b>Kimlik ve iletişim:</b> ad soyad, cep telefonu, (isteğe bağlı) e-posta adresi.
          </li>
          <li>
            <b>Mülk / araç bilgileri:</b> ilan tipi, konum ve adres tarifi, fiyat beklentisi, mülke veya araca ait özellikler,
            açıklama ve yüklediğiniz fotoğraflar.
          </li>
          <li>
            <b>İşlem bilgileri:</b> başvuru numarası, gönderim zamanı, başvurunun tekrar gönderim olup olmadığı ve sitenin size
            atadığı anonim teknik oturum kimliği.
          </li>
        </ul>
        <p>Yüklenen fotoğraflar gönderilmeden önce cihazınızda küçültülür ve içlerindeki konum (GPS) bilgisi silinir.</p>

        <h2>2. İşleme amaçları</h2>
        <ul>
          <li>İlan başvurunuzu değerlendirmek ve sizinle iletişime geçmek,</li>
          <li>Onayınızla mülkünüzün/aracınızın satış veya kiralama ilanını hazırlamak,</li>
          <li>Kötüye kullanımı ve otomatik (bot) gönderimleri önlemek, bilgi güvenliğini sağlamak.</li>
        </ul>

        <h2>3. Hukuki sebepler</h2>
        <p>
          Verileriniz; bir sözleşmenin kurulmasıyla doğrudan ilgili olması (KVKK m. 5/2-c), meşru menfaatimiz (m. 5/2-f; güvenlik
          ve kötüye kullanımın önlenmesi) ve yurt dışında saklanmasına ilişkin olarak açık rızanız (m. 5/1 ve m. 9) hukuki
          sebeplerine dayanılarak işlenir.
        </p>

        <h2>4. Aktarım ve saklama yeri</h2>
        <p>
          Başvurular, hizmet sağlayıcımız Google'ın <b>Firebase</b> altyapısında, <b>Frankfurt (Almanya)</b> veri merkezinde
          saklanır. Her başvuruda {SITE.name} çalışanlarına Google (Gmail) üzerinden bilgilendirme e-postası gönderilir. Bu
          nedenle verileriniz, açık rızanıza dayanılarak yurt dışındaki sunuculara aktarılmaktadır. Verileriniz bunun dışında
          üçüncü kişilerle paylaşılmaz; ilanınız yalnızca onayınızla ve sizin belirlediğiniz bilgilerle yayınlanır.
        </p>

        <h2>5. Saklama süresi</h2>
        <p>
          Başvurular ve fotoğrafları, gönderim tarihinden itibaren en fazla <b>2 yıl</b> saklanır ve bu sürenin sonunda
          sistem tarafından otomatik olarak silinir. Tamamlanmamış (başvuruya eklenmemiş) fotoğraflar 24 saat içinde silinir.
        </p>

        <h2>6. Haklarınız</h2>
        <p>
          KVKK m. 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini
          isteme, aktarıldığı kişileri öğrenme, itiraz etme ve zarara uğramanız hâlinde tazminat talep etme haklarına sahipsiniz.
          Taleplerinizi başvuru numaranızla birlikte <b>{SITE.phoneDisplay}</b> numaralı WhatsApp hattımız üzerinden
          iletebilirsiniz. Başvuru formundaki "Başvurularım" bölümünden silinen geçmiş yalnızca cihazınızdan silinir; bize
          ulaşmış başvurunun silinmesi için bu kanaldan talepte bulunabilirsiniz.
        </p>

        <h1 id="cerezler">Çerez Politikası</h1>
        <p>Sitemiz aşağıdaki çerezleri ve tarayıcı depolama alanlarını kullanır:</p>
        <table className="legal-table">
          <thead>
            <tr>
              <th>Tür</th>
              <th>Ne için</th>
              <th>Süre</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Zorunlu</b>
              </td>
              <td>
                Çerez tercihinizin kaydı; başvuru formunda geçmiş başvurularınızın (yalnızca bu cihazda) saklanması; Firebase
                anonim oturumu; Google reCAPTCHA ile bot koruması.
              </td>
              <td>Siz silene kadar / oturum süresince</td>
            </tr>
            <tr>
              <td>
                <b>Analitik</b> (isteğe bağlı)
              </td>
              <td>Google Analytics ile ziyaret istatistikleri (_ga, _ga_* çerezleri). Yalnızca izin verirseniz kullanılır.</td>
              <td>En fazla 2 yıl</td>
            </tr>
          </tbody>
        </table>
        <p>
          Zorunlu depolama olmadan başvuru formu çalışmaz. Analitik çerezleri reddetmeniz sitenin kullanımını etkilemez.
        </p>
        <p>
          Şu anki tercihiniz:{' '}
          <b>{consent ? (consent.analytics ? 'Tüm çerezler kabul edildi' : 'Yalnızca zorunlu') : 'Henüz seçilmedi'}</b>.{' '}
          <button type="button" className="link-btn" onClick={resetConsent}>
            Tercihimi değiştir
          </button>
        </p>
      </article>
    </PublicLayout>
  );
}
