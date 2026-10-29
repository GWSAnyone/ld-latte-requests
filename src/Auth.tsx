import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { configured, supabase } from './supabase';
import { errorMessage } from './domain';
import { Brand, FieldError, Icon } from './ui';

export function Auth({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'confirm'>(recovery ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const redirect = new URL(import.meta.env.BASE_URL, location.origin).href;
  const title = recovery ? 'Новый пароль' : mode === 'confirm' ? 'Проверьте почту' : mode === 'reset' ? 'Восстановим доступ' : mode === 'signup' ? 'Создайте аккаунт' : 'С возвращением';

  function switchMode(next: typeof mode) { setMode(next); setError(''); setMessage(''); setFields({}); setPassword(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !supabase) return;
    const validation = {
      email: !recovery && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Укажите корректную почту.' : undefined,
      password: (recovery || mode !== 'reset') && password.length < (recovery || mode === 'signup' ? 8 : 1) ? 'Введите пароль' + (recovery || mode === 'signup' ? ' не короче 8 символов.' : '.') : undefined,
    };
    setFields(validation);
    if (validation.email || validation.password) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (recovery) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw Object.assign(new Error('Ссылка восстановления недействительна или истекла. Запросите новое письмо.'), { name: 'UserError' });
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        history.replaceState(null, '', location.pathname);
        onRecovered?.();
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
        if (error) throw error;
        setMessage('Если аккаунт с этой почтой существует, мы отправили ссылку для восстановления. Проверьте также папку «Спам».');
      } else {
        const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
        if (result.error) throw result.error;
        if (mode === 'signup' && !result.data.session) { setMode('confirm'); setPassword(''); }
      }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="auth-layout">
    <aside className="auth-story"><Brand /><div className="story-content"><span className="eyebrow light">МЕНЬШЕ РУТИНЫ. БОЛЬШЕ ВОЗМОЖНОСТЕЙ.</span><h1>Хорошие идеи<br />начинаются<br />с одной заявки.</h1><p>Расскажите, что можно упростить.<br />Все задачи и их состояние будут в одном месте.</p><div className="story-categories"><span>Боты</span><span>Интеграции</span><span>Отчёты</span></div></div><span className="story-foot">Рабочее пространство LD LATTE</span></aside>
    <main className="auth-main"><div className="auth-card"><div className="auth-mobile-brand"><Brand /></div><span className="eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span><h2>{title}</h2><p className="muted">{recovery ? 'Придумайте новый пароль для вашего аккаунта.' : mode === 'reset' ? 'Отправим защищённую ссылку на вашу почту.' : mode === 'confirm' ? `Если для ${email} доступна регистрация, придёт письмо с подтверждением. После подтверждения войдите в аккаунт.` : mode === 'login' ? 'Войдите, чтобы продолжить работу с заявками.' : 'Сохраняйте идеи и следите за их реализацией.'}</p>
      {!recovery && (mode === 'login' || mode === 'signup') && <div className="auth-tabs" aria-label="Способ входа"><button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')} disabled={busy}>Вход</button><button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')} disabled={busy}>Регистрация</button></div>}
      {!configured && <div className="notice">Подключение к Supabase ещё не настроено.</div>}
      {mode === 'confirm' && !recovery ? <div className="confirmation"><span className="confirmation-icon" aria-hidden="true">✉</span><p className="field-note" role="status">Проверьте почту и папку «Спам». Ссылка вернёт вас в приложение.</p><button className="primary auth-submit" onClick={() => switchMode('login')}>Перейти ко входу<Icon name="arrow" /></button></div> : <form onSubmit={submit} noValidate>
        {!recovery && <><label htmlFor="auth-email">Электронная почта</label><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="name@company.ru" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'email-error' : undefined} /><FieldError id="email-error">{fields.email}</FieldError></>}
        {(recovery || mode !== 'reset') && <><label htmlFor="auth-password">{recovery ? 'Новый пароль' : 'Пароль'}</label><div className="password-field"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={recovery || mode === 'signup' ? 'new-password' : 'current-password'} placeholder={recovery || mode === 'signup' ? 'Не менее 8 символов' : 'Введите пароль'} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'password-error' : undefined} /><button type="button" aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Скрыть' : 'Показать'}</button></div><FieldError id="password-error">{fields.password}</FieldError></>}
        {message && <div className="notice success" role="status">{message}</div>}{error && <div className="notice error" role="alert">{error}</div>}
        <button className="primary auth-submit" type="submit" disabled={busy || !configured}>{busy ? 'Подождите…' : recovery ? 'Сохранить новый пароль' : mode === 'reset' ? 'Отправить ссылку' : mode === 'login' ? 'Войти в аккаунт' : 'Зарегистрироваться'}{!busy && <Icon name="arrow" />}</button>
      </form>}
      {!recovery && mode !== 'confirm' && <button className="text-action auth-back" type="button" disabled={busy} onClick={() => switchMode(mode === 'reset' ? 'login' : 'reset')}>{mode === 'reset' ? '← Вернуться ко входу' : 'Не помню пароль'}</button>}
      {recovery && <button className="text-action auth-back" disabled={busy} onClick={() => onRecovered?.()}>Вернуться в приложение</button>}
      <p className="auth-note">Каждый сотрудник видит только свои заявки.</p>
    </div></main>
  </div>;
}
