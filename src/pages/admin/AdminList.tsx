import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDraft, ensureDraft, getMeta, listDrafts, saveDraft, type DraftMeta } from '../../data/draft';
import { categoryLabel, formatDateTime, formatPrice } from '../../lib/format';
import { getLoginLog, type LoginEvent } from '../../security/auth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Photo } from '../../components/Photo';
import { DEAL_LABEL, STATUS_LABEL, type Listing, type ListingStatus } from '../../types';
import { useAdmin } from './session';

export default function AdminList() {
  const { toast } = useAdmin();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [log, setLog] = useState<LoginEvent[]>([]);
  const [q, setQ] = useState('');
  const [toDelete, setToDelete] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState('');

  const refresh = async () => {
    setItems(await listDrafts());
    setMeta(await getMeta());
  };

  useEffect(() => {
    ensureDraft()
      .catch((e: Error) => setLoadError(e.message))
      .finally(refresh);
    getLoginLog().then(setLog);
  }, []);

  const filtered = useMemo(() => {
    const t = q.toLocaleLowerCase('tr-TR').trim();
    if (!items) return [];
    if (!t) return items;
    return items.filter((l) => [l.title, l.code, l.district, l.neighborhood, l.brand, l.model, categoryLabel(l)].join(' ').toLocaleLowerCase('tr-TR').includes(t));
  }, [items, q]);

  const setStatus = async (l: Listing, status: ListingStatus) => {
    await saveDraft({ ...l, status });
    toast(`"${l.title}" → ${STATUS_LABEL[status]}`);
    await refresh();
  };

  const doDelete = async () => {
    if (!toDelete) return;
    await deleteDraft(toDelete.id);
    toast('İlan silindi. Siteden kalkması için yayınlamayı unutmayın.');
    setToDelete(null);
    await refresh();
  };

  const counts = items
    ? { yayinda: items.filter((l) => l.status === 'yayinda').length, taslak: items.filter((l) => l.status === 'taslak').length, satildi: items.filter((l) => l.status === 'satildi').length }
    : null;
  const failsSinceLastOk = log.slice(1).findIndex((e) => e.ok);
  const recentFails = (failsSinceLastOk === -1 ? log.slice(1) : log.slice(1, failsSinceLastOk + 1)).filter((e) => !e.ok).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>İlanlarım</h1>
          {counts && (
            <p className="muted">
              {counts.yayinda} yayında · {counts.satildi} satıldı/kiralandı · {counts.taslak} taslak
            </p>
          )}
        </div>
        <Link to="/admin/yeni" className="btn btn-primary btn-lg">
          + Yeni İlan Ekle
        </Link>
      </div>

      {loadError && <div className="alert alert-err">{loadError}</div>}
      {recentFails > 0 && (
        <div className="alert alert-warn">
          Son başarılı girişinizden önce bu cihazda <b>{recentFails} hatalı şifre denemesi</b> yapıldı. Siz değilseniz şifrenizi
          değiştirmeniz önerilir.
        </div>
      )}
      {meta?.dirty && (
        <div className="alert alert-info row-between">
          <span>Yayınlanmamış değişiklikleriniz var. Müşterilerin görmesi için yayın paketini indirip siteye yükleyin.</span>
          <Link to="/admin/yayinla" className="btn btn-primary btn-sm">
            Yayınla
          </Link>
        </div>
      )}

      <div className="admin-toolbar">
        <input type="search" placeholder="İlan ara (başlık, ilan no, semt)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="İlan ara" />
      </div>

      {items === null ? (
        <p className="muted">Yükleniyor…</p>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h3>{items.length ? 'Aramanıza uygun ilan yok' : 'Henüz ilan eklenmemiş'}</h3>
          {!items.length && (
            <Link to="/admin/yeni" className="btn btn-primary">
              İlk ilanı ekle
            </Link>
          )}
        </div>
      ) : (
        <ul className="admin-list">
          {filtered.map((l) => (
            <li key={l.id} className="admin-item">
              <div className="admin-thumb">
                <Photo name={l.images[0]} thumb alt="" category={l.category} />
              </div>
              <div className="admin-info">
                <div className="admin-title">
                  <Link to={`/admin/duzenle/${l.id}`}>{l.title}</Link>
                </div>
                <div className="small muted">
                  {l.code} · {DEAL_LABEL[l.dealType]} {categoryLabel(l)} · {formatPrice(l)} · {l.images.length}/10 foto
                </div>
                <div className="small muted">Son güncelleme: {formatDateTime(l.updatedAt)}</div>
              </div>
              <select
                className={`status-select st-${l.status}`}
                value={l.status}
                onChange={(e) => setStatus(l, e.target.value as ListingStatus)}
                aria-label="Durum"
              >
                {(Object.keys(STATUS_LABEL) as ListingStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <div className="admin-actions">
                <Link to={`/admin/duzenle/${l.id}`} className="btn btn-ghost btn-sm">
                  Düzenle
                </Link>
                <Link to={`/admin/onizle/${l.id}`} className="btn btn-ghost btn-sm">
                  Önizle
                </Link>
                <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setToDelete(l)}>
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {log.length > 0 && (
        <section className="panel login-log">
          <h2>Bu cihazdaki son giriş denemeleri</h2>
          <ul>
            {log.slice(0, 6).map((e) => (
              <li key={e.at}>
                <span className={e.ok ? 'ok' : 'bad'}>{e.ok ? '✓ Başarılı' : '✕ Hatalı şifre'}</span>
                <span className="muted">{formatDateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="İlan silinsin mi?"
        confirmLabel="Evet, sil"
        danger
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      >
        <p>
          <b>{toDelete?.title}</b> ilanı ve fotoğrafları kalıcı olarak silinecek. Bu işlem geri alınamaz.
        </p>
      </ConfirmDialog>
    </>
  );
}
