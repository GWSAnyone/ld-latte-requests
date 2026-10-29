import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, recoveryRequested, supabase } from './supabase';
import { errorMessage } from './domain';
import { Brand } from './ui';
import { Auth } from './Auth';
import { Workspace } from './Workspace';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);
  const [authError, setAuthError] = useState('');
  const [recovery, setRecovery] = useState(() => {
    const incoming = recoveryRequested;
    try { return incoming || sessionStorage.getItem('ld-latte-recovery') === 'true'; } catch { return incoming; }
  });
  function finishRecovery() { setRecovery(false); try { sessionStorage.removeItem('ld-latte-recovery'); } catch { /* Storage can be blocked. */ } }
  useEffect(() => { if (recovery) { try { sessionStorage.setItem('ld-latte-recovery', 'true'); } catch { /* Storage can be blocked. */ } } }, [recovery]);
  useEffect(() => {
    const incoming = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
    if (incoming) { try { sessionStorage.setItem('ld-latte-recovery', 'true'); } catch { /* Storage can be blocked. */ } }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true; let revision = 0;
    const incomingError = new URLSearchParams(location.hash.slice(1)).get('error_code');
    if (incomingError) { setAuthError(errorMessage({ code: incomingError })); history.replaceState(null, '', location.pathname); }
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      revision++;
      if (active) { if (event === 'PASSWORD_RECOVERY') setRecovery(true); setSession(next); setReady(true); if (!incomingError) setAuthError(''); }
    });
    const started = revision;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== started) return;
      if (error) setAuthError(errorMessage(error));
      setSession(data.session); setReady(true);
    }).catch(() => { if (active && revision === started) { setAuthError('Не удалось восстановить вход. Обновите страницу.'); setReady(true); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  if (!ready) return <main className="boot-screen" role="status"><Brand /><span className="loader" />Открываем рабочее пространство…</main>;
  if (authError) return <main className="boot-screen"><Brand /><p role="alert">{authError}</p><button className="secondary" onClick={() => { setAuthError(''); setRecovery(false); }}>Вернуться ко входу</button></main>;
  if (recovery) return <Auth recovery onRecovered={finishRecovery} />;
  return session ? <Workspace key={session.user.id} session={session} /> : <Auth />;
}
