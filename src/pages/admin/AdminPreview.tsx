import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDraft } from '../../data/draft';
import { DetailView } from '../Detail';
import type { Listing } from '../../types';

export default function AdminPreview() {
  const { id } = useParams();
  const [l, setL] = useState<Listing | null | undefined>(undefined);
  useEffect(() => {
    if (id) getDraft(id).then((x) => setL(x ?? null));
  }, [id]);
  if (l === undefined) return null;
  if (l === null) return <p>İlan bulunamadı.</p>;
  return (
    <>
      <div className="alert alert-info row-between">
        <span>Önizleme: müşterilerin göreceği görünüm. Değişiklikler yayınlanana kadar sitede görünmez.</span>
        <Link to={`/admin/duzenle/${l.id}`} className="btn btn-primary btn-sm">
          Düzenle
        </Link>
      </div>
      <div className="preview-frame">
        <DetailView listing={l} backTo="/admin" backLabel="Yönetim paneline dön" />
      </div>
    </>
  );
}
