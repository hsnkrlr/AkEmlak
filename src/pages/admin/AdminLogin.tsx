import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AUTH_POLICY, siteOrigin } from '../../config';
import { formatCountdown } from '../../lib/format';
import { getSession, login } from '../../security/auth';
import { getLockStatus, type LockStatus } from '../../security/rateLimit';
import { Logo } from '../../components/Layout';

const REASONS: Record<string, string> = {
  expired: 'Güvenliğiniz için 15 dakikalık oturum süresi doldu. Lütfen şifrenizi yeniden girin.',
  logout: 'Oturum kapatıldı.',
  revoked: 'Oturum başka bir sekmede kapatıldı veya yenilendi.',
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const reason = (location.state as { reason?: string } | null)?.reason;
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lock, setLock] = useState<LockStatus | null>(null);
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Yönetici Girişi';
    getLockStatus().then(setLock);
    getSession().then((s) => s && navigate('/admin', { replace: true }));
  }, [navigate]);

  useEffect(() => {
    if (!lock?.locked) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lock.until) getLockStatus().then(setLock);
    }, 1000);
    return () => clearInterval(t);
  }, [lock]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError('');
    const res = await login(password);
    setPassword('');
    if (res.ok) {
      navigate('/admin', { replace: true });
      return;
    }
    setBusy(false);
    setLock(res.lock);
    setNow(Date.now());
    if (res.reason === 'wrong') {
      setError(`Şifre hatalı. Kalan deneme hakkı: ${res.lock.attemptsLeft}`);
      input.current?.focus();
    } else if (res.reason === 'error') {
      setError('Giriş sırasında bir hata oluştu. Tarayıcınızı güncelleyip tekrar deneyin.');
    }
  };

  const locked = !!lock?.locked;

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} autoComplete="on">
        <Logo />
        <h1>Yönetici Girişi</h1>
        {reason && REASONS[reason] && <div className="alert alert-info">{REASONS[reason]}</div>}

        {locked ? (
          <div className="alert alert-err" role="alert">
            <strong>Çok fazla hatalı deneme.</strong>
            <br />
            Bu cihazdan girişler geçici olarak durduruldu. Tekrar deneyebilmek için:{' '}
            <b className="mono">{formatCountdown(lock!.until - now)}</b>
          </div>
        ) : (
          <>
            <label className="field">
              <span>Şifre</span>
              <div className="pw">
                <input
                  ref={input}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                  maxLength={128}
                  disabled={busy}
                  aria-invalid={!!error}
                />
                <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                  {show ? 'Gizle' : 'Göster'}
                </button>
              </div>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || !password}>
              {busy ? 'Doğrulanıyor…' : 'Giriş Yap'}
            </button>
          </>
        )}

        <p className="small muted login-note">
          Her cihaz için {AUTH_POLICY.failWindowMs / 60000} dakikada en fazla {AUTH_POLICY.maxFails} hatalı deneme yapılabilir. Oturum{' '}
          {AUTH_POLICY.sessionMs / 60000} dakika sonra otomatik kapanır.
        </p>
        <p className="small muted login-note">
          Adres çubuğunda yalnızca <b className="mono">{new URL(siteOrigin()).host}</b> yazdığından emin olun. Şifrenizi asla
          başka bir sitede veya mesajlaşma uygulamasında paylaşmayın.
        </p>
      </form>
    </div>
  );
}
