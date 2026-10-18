import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, logout, onSessionBroadcast, type AdminSession } from '../../security/auth';

interface Ctx {
  session: AdminSession;
  remaining: number;
  signOut: () => Promise<void>;
  toast: (msg: string, kind?: 'ok' | 'err') => void;
}

const SessionCtx = createContext<Ctx | null>(null);

export function useAdmin(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('Yönetici oturumu yok');
  return c;
}

/**
 * Oturum süresini izler. Süre dolduğunda, başka sekmede çıkış/yeni giriş yapıldığında ya da
 * belirteç geçersizleştiğinde anında oturumu kapatır.
 */
export function SessionProvider({ session, children }: { session: AdminSession; children: ReactNode }) {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(session.exp - Date.now());
  const [toastState, setToast] = useState<{ msg: string; kind: 'ok' | 'err'; id: number } | null>(null);
  const ended = useRef(false);

  const end = useCallback(
    async (reason: 'expired' | 'logout' | 'revoked') => {
      if (ended.current) return;
      ended.current = true;
      await logout();
      navigate('/admin/login', { replace: true, state: { reason } });
    },
    [navigate],
  );

  useEffect(() => {
    const tick = () => {
      const left = session.exp - Date.now();
      setRemaining(left);
      if (left <= 0) void end('expired');
    };
    const verify = async () => {
      const s = await getSession();
      if (!s || s.sid !== session.sid) void end(s ? 'revoked' : Date.now() >= session.exp ? 'expired' : 'revoked');
    };
    const t1 = window.setInterval(tick, 1000);
    const t2 = window.setInterval(verify, 10_000);
    const onVis = () => document.visibilityState === 'visible' && (tick(), void verify());
    document.addEventListener('visibilitychange', onVis);
    const off = onSessionBroadcast(() => void verify());
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      document.removeEventListener('visibilitychange', onVis);
      off();
    };
  }, [session, end]);

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now();
    setToast({ msg, kind, id });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  }, []);

  return (
    <SessionCtx.Provider value={{ session, remaining, signOut: () => end('logout'), toast }}>
      {children}
      {toastState && (
        <div className={`toast toast-${toastState.kind}`} role="status">
          {toastState.msg}
        </div>
      )}
    </SessionCtx.Provider>
  );
}
