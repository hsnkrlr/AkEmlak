import { useEffect, useState } from 'react';
import { buildPublishPackage, getMeta, syncFromLive, type DraftMeta } from '../../data/draft';
import { loadPublished } from '../../data/published';
import { formatDateTime } from '../../lib/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAdmin } from './session';

export default function PublishPanel() {
  const { session, toast } = useAdmin();
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [live, setLive] = useState<string>('');

  const refresh = () => getMeta().then(setMeta);

  const checkLive = async () => {
    const s = await loadPublished(true);
    setLive(
      s.status === 'ok'
        ? `✓ Yayındaki veri doğrulandı · ${s.data.listings.filter((l) => l.status !== 'taslak').length} ilan · yayın tarihi ${formatDateTime(s.data.publishedAt)}`
        : s.status === 'invalid'
          ? '⚠ Yayındaki dosyanın imzası GEÇERSİZ. Dosya değiştirilmiş olabilir; son paketinizi yeniden yükleyin.'
          : '⚠ Yayındaki veri okunamadı.',
    );
  };

  useEffect(() => {
    void refresh();
    void checkLive();
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      const { blob, count } = await buildPublishPackage(session);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `ak-emlak-yayin-${stamp}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast(`Yayın paketi hazırlandı (${count} ilan).`);
      await refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    setBusy(true);
    try {
      const { missingImages } = await syncFromLive();
      toast(missingImages ? `Yayındaki sürüm yüklendi (${missingImages} fotoğraf bulunamadı).` : 'Yayındaki sürüm yüklendi.');
      await refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Yayınla</h1>
          <p className="muted">Yaptığınız değişikliklerin müşterilere görünmesi için 3 kolay adım.</p>
        </div>
      </div>

      <ol className="steps">
        <li className="panel">
          <span className="step-no">1</span>
          <div>
            <h2>Yayın paketini indirin</h2>
            <p>
              Tüm yayındaki ilanlarınız ve fotoğraflarınız, şifrenizle <b>dijital olarak imzalanmış</b> tek bir .zip dosyasına
              hazırlanır. İmzasız veya değiştirilmiş dosyalar sitede gösterilmez.
            </p>
            {meta?.dirty ? (
              <p className="alert alert-info">Yayınlanmamış değişiklikleriniz var.</p>
            ) : (
              <p className="small muted">Yayınlanmamış değişiklik yok.</p>
            )}
            <button type="button" className="btn btn-primary btn-lg" onClick={download} disabled={busy}>
              {busy ? 'Hazırlanıyor…' : '⬇ Yayın paketini indir'}
            </button>
            {meta?.exportedAt && <p className="small muted">Son paket: {formatDateTime(meta.exportedAt)}</p>}
          </div>
        </li>
        <li className="panel">
          <span className="step-no">2</span>
          <div>
            <h2>Paketi sitenize yükleyin</h2>
            <p>
              Zip dosyasını açın. İçindeki <b>data</b> klasörünü, barındırma (hosting) panelinizden sitenin ana dizinindeki
              mevcut <b>data</b> klasörünün yerine yükleyin.
            </p>
          </div>
        </li>
        <li className="panel">
          <span className="step-no">3</span>
          <div>
            <h2>Yayını kontrol edin</h2>
            <button type="button" className="btn btn-ghost" onClick={checkLive}>
              Yayındaki veriyi doğrula
            </button>
            {live && <p className={live.startsWith('✓') ? 'ok-text' : 'danger-text'}>{live}</p>}
          </div>
        </li>
      </ol>

      <section className="panel">
        <h2>Başka cihazdan çalışma / değişiklikleri geri alma</h2>
        <p className="small muted">
          İlan taslaklarınız bu cihazın tarayıcısında saklanır. Başka bir cihazda çalışacaksanız ya da yerel değişiklikleri
          iptal etmek istiyorsanız yayındaki sürümü yükleyin.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
          Yayındaki sürümü yükle
        </button>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Yerel değişiklikler silinsin mi?"
        confirmLabel="Evet, yayındakini yükle"
        danger
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      >
        <p>Bu cihazdaki yayınlanmamış tüm değişiklikler ve taslaklar silinip yerine sitedeki güncel ilanlar yüklenecek.</p>
      </ConfirmDialog>
    </>
  );
}
