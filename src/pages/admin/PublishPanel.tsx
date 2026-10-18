import { useEffect, useState, type FormEvent } from 'react';
import { GITHUB } from '../../config';
import { buildPublishPackage, getMeta, syncFromLive, type DraftMeta } from '../../data/draft';
import { forgetGithubToken, hasGithubToken, publishToGithub, saveGithubToken } from '../../data/github';
import { loadPublished } from '../../data/published';
import { formatDateTime } from '../../lib/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAdmin } from './session';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export default function PublishPanel() {
  const { session, toast } = useAdmin();
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [live, setLive] = useState('');

  const refresh = async () => {
    setMeta(await getMeta());
    setConnected(await hasGithubToken());
  };

  const checkLive = async () => {
    const s = await loadPublished(true);
    setLive(
      s.status === 'ok'
        ? `✓ Sitedeki veri doğrulandı · ${s.data.listings.filter((l) => l.status !== 'taslak').length} ilan · son yayın ${formatDateTime(s.data.publishedAt)}`
        : s.status === 'invalid'
          ? '⚠ Sitedeki dosyanın imzası GEÇERSİZ. Dosya değiştirilmiş olabilir; yeniden yayınlayın.'
          : '⚠ Sitedeki veri okunamadı.',
    );
  };

  useEffect(() => {
    void refresh();
    void checkLive();
  }, []);

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await saveGithubToken(session, token);
      setToken('');
      toast('GitHub bağlantısı kuruldu.');
      await refresh();
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setResult(null);
    try {
      const { count } = await publishToGithub(session, setProgress);
      setResult({
        ok: true,
        msg: `Yayınlandı (${count} ilan). Site 1–2 dakika içinde otomatik güncellenir; sonra aşağıdan doğrulayabilirsiniz.`,
      });
      await refresh();
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setProgress('');
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const { blob, count } = await buildPublishPackage(session);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ak-emlak-yayin-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast(`Yayın paketi hazırlandı (${count} ilan).`);
      await refresh();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    setBusy(true);
    try {
      const { missingImages } = await syncFromLive();
      toast(missingImages ? `Sitedeki sürüm yüklendi (${missingImages} fotoğraf bulunamadı).` : 'Sitedeki sürüm yüklendi.');
      await refresh();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    setConfirmForget(false);
    await forgetGithubToken();
    toast('GitHub bağlantısı bu cihazdan kaldırıldı.');
    await refresh();
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Yayınla</h1>
          <p className="muted">Panelde yaptığınız değişiklikler, yayınlayana kadar yalnızca bu cihazda durur; müşteriler görmez.</p>
        </div>
      </div>

      {connected === false && (
        <section className="panel">
          <h2>Siteye bağlan (yalnızca ilk seferde)</h2>
          <p>
            Yayınla düğmesinin ilanları siteye gönderebilmesi için bu cihaza bir kez GitHub erişim anahtarı girmeniz gerekir.
            Anahtar şifrenizle kilitlenerek yalnızca bu cihazda saklanır.
          </p>
          <ol className="howto">
            <li>
              <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer">
                GitHub’da yeni anahtar oluşturma sayfasını açın ↗
              </a>{' '}
              (GitHub hesabınıza giriş yapmış olmalısınız).
            </li>
            <li>
              <b>Token name:</b> “Ak Emlak Yayın” · <b>Expiration:</b> 1 yıl (Custom).
            </li>
            <li>
              <b>Repository access:</b> “Only select repositories” → <b>{`${GITHUB.owner}/${GITHUB.repo}`}</b>
            </li>
            <li>
              <b>Permissions → Repository permissions → Contents:</b> “Read and write”
            </li>
            <li>
              <b>Generate token</b> deyin, çıkan <code>github_pat_…</code> anahtarını aşağıya yapıştırın.
            </li>
          </ol>
          <form className="token-form" onSubmit={connect}>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
              spellCheck={false}
              aria-label="GitHub erişim anahtarı"
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !token.trim()}>
              {busy ? 'Kontrol ediliyor…' : 'Bağlan'}
            </button>
          </form>
        </section>
      )}

      {connected && (
        <section className="panel publish-main">
          <h2>Değişiklikleri siteye gönder</h2>
          {meta?.dirty ? (
            <p className="alert alert-info">Yayınlanmamış değişiklikleriniz var.</p>
          ) : (
            <p className="small muted">Yayınlanmamış değişiklik yok.</p>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={publish} disabled={busy}>
            {busy && progress ? progress : '🚀 Siteye Yayınla'}
          </button>
          {meta?.exportedAt && <p className="small muted">Son yayın: {formatDateTime(meta.exportedAt)}</p>}
        </section>
      )}

      {result && (
        <div className={`alert ${result.ok ? 'alert-info' : 'alert-err'}`} role="status">
          {result.msg}
        </div>
      )}

      <section className="panel">
        <h2>Sitedeki durumu kontrol et</h2>
        <button type="button" className="btn btn-ghost" onClick={checkLive}>
          Sitedeki veriyi doğrula
        </button>
        {live && <p className={live.startsWith('✓') ? 'ok-text' : 'danger-text'}>{live}</p>}
      </section>

      <section className="panel">
        <h2>Başka cihazdan çalışma / değişiklikleri geri alma</h2>
        <p className="small muted">
          Başka bir cihazda yayın yaptıysanız, bu cihazda çalışmadan önce sitedeki güncel sürümü yükleyin. Böylece yeni
          yayın, diğer cihazda eklenen ilanları silmez.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
          Sitedeki sürümü yükle
        </button>
      </section>

      <details className="panel">
        <summary>Diğer seçenekler</summary>
        <p className="small muted">
          GitHub kullanmayan bir barındırma için: imzalı yayın paketini indirip içindeki <b>data</b> klasörünü sitenizin ana
          dizinine yükleyebilirsiniz.
        </p>
        <div className="row-between">
          <button type="button" className="btn btn-ghost" onClick={download} disabled={busy}>
            ⬇ Yayın paketini indir (.zip)
          </button>
          {connected && (
            <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirmForget(true)}>
              GitHub bağlantısını bu cihazdan kaldır
            </button>
          )}
        </div>
      </details>

      <ConfirmDialog
        open={confirmReset}
        title="Bu cihazdaki değişiklikler silinsin mi?"
        confirmLabel="Evet, sitedekini yükle"
        danger
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      >
        <p>Bu cihazdaki yayınlanmamış değişiklikler ve taslaklar silinip yerine sitedeki güncel ilanlar yüklenecek.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmForget}
        title="GitHub bağlantısı kaldırılsın mı?"
        confirmLabel="Kaldır"
        danger
        onConfirm={forget}
        onCancel={() => setConfirmForget(false)}
      >
        <p>Bu cihazdan tekrar yayın yapmak için anahtarı yeniden girmeniz gerekir.</p>
      </ConfirmDialog>
    </>
  );
}
