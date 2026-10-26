import { Link, useLocation } from 'react-router-dom';
import { saveConsent, useConsent } from '../lib/consent';

/** Site genelinde çerez/depolama onayı. Seçim yapılana kadar görünür; başvuru formu onaysız çalışmaz. */
export function ConsentBanner() {
  const consent = useConsent();
  const { pathname } = useLocation();
  if (consent || pathname === '/kvkk') return null;
  return (
    <div className="consent" role="dialog" aria-label="Çerez tercihleri" aria-live="polite">
      <div className="consent-text">
        <strong>Çerez ve cihaz depolama izni</strong>
        <p>
          Başvuru formunun çalışması için cihazınızda zorunlu veriler saklanır. İzin verirseniz ziyaret istatistikleri için
          Google Analytics çerezleri de kullanılır. <Link to="/kvkk">Ayrıntılar</Link>
        </p>
      </div>
      <div className="consent-actions">
        <button type="button" className="btn btn-primary" onClick={() => saveConsent(true)}>
          Tümünü kabul et
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => saveConsent(false)}>
          Yalnızca zorunlu
        </button>
      </div>
    </div>
  );
}
