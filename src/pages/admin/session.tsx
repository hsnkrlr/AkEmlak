import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasGithubToken, syncWithGithub } from '../../data/github';
import { getSession, logout, onSessionBroadcast, type AdminSession } from '../../security/auth';

export type SyncStatus = 'checking' | 'disconnected' | 'syncing' | 'done' | 'error';

export interface SyncState {
  status: SyncStatus;
  message: string;
  at?: number;
}

interface Ctx {
  session: AdminSession;
  remaining: number;
  signOut: () => Promise<void>;
  toast: (msg: string, kind?: 'ok' | 'err') => void;
  sync: SyncState;
  /** Değişikliği siteye gönder (arka planda; üst üste gelen istekler birleştirilir) */
  requestSync: () => void;
  /** GitHub bağlantısı kurulduğunda/kaldırıldığında çağrılır */
  refreshConnection: () => Promise<void>;
  /** Başka cihazdan veri geldiğinde artar; listeler yeniden okunur */
  dataVersion: number;
}

const SessionCtx = createContext<Ctx | null>(null);

export function useAdmin(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('Yönetici oturumu yok');
  return c;
}

/**
 * Oturum süresini izler. Süre dolduğunda, başka sekmede çıkış/yeni giriş yapıldığında ya da
 * belirteç geçersizleştiğinde anında oturumu kapatır. Ayrıca ilanları siteyle otomatik eşitler.
 */
export function SessionProvider({ session, children }: { session: AdminSession; children: ReactNode }) {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(session.exp - Date.now());
  const [toastState, setToast] = useState<{ msg: string; kind: 'ok' | 'err'; id: number } | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: 'checking', message: '' });
  const [dataVersion, setDataVersion] = useState(0);
  const ended = useRef(false);
  const running = useRef(false);
  const pending = useRef(false);

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

  const runSync = useCallback(async () => {
    if (running.current) {
      pending.current = true;
      return;
    }
    running.current = true;
    setSync((s) => (s.status === 'disconnected' ? s : { status: 'syncing', message: 'Siteye gönderiliyor…' }));
    if (!(await hasGithubToken())) {
      running.current = false;
      setSync({ status: 'disconnected', message: 'Siteye bağlı değil' });
      return;
    }
    try {
      do {
        pending.current = false;
        setSync({ status: 'syncing', message: 'Siteye gönderiliyor…' });
        try {
          const r = await syncWithGithub(session, (m) => setSync({ status: 'syncing', message: m }));
          if (r.pulled > 0) setDataVersion((v) => v + 1);
          setSync({
            status: 'done',
            message: r.published ? 'Siteye kaydedildi · 1–2 dk içinde yayında' : 'Site güncel',
            at: Date.now(),
          });
        } catch (e) {
          setSync({ status: 'error', message: (e as Error).message });
        }
      } while (pending.current);
    } finally {
      running.current = false;
    }
  }, [session]);

  const requestSync = useCallback(() => void runSync(), [runSync]);

  const refreshConnection = useCallback(async () => {
    if (await hasGithubToken()) await runSync();
    else setSync({ status: 'disconnected', message: 'Siteye bağlı değil' });
  }, [runSync]);

  // Panel açılınca: diğer cihazlardaki değişiklikleri al, bu cihazda bekleyenleri gönder
  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  // Gönderim sürerken sayfa kapatılmak istenirse uyar
  useEffect(() => {
    if (sync.status !== 'syncing') return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [sync.status]);

  return (
    <SessionCtx.Provider value={{ session, remaining, signOut: () => end('logout'), toast, sync, requestSync, refreshConnection, dataVersion }}>
      {children}
      {toastState && (
        <div className={`toast toast-${toastState.kind}`} role="status">
          {toastState.msg}
        </div>
      )}
    </SessionCtx.Provider>
  );
}
