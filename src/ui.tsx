import type { ReactNode } from 'react';

export function Icon({ name }: { name: 'plus' | 'search' | 'arrow' | 'logout' | 'close' | 'check' | 'grid' | 'list' | 'image' }) {
  const paths = {
    plus: 'M12 5v14M5 12h14', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow: 'M5 12h14m-6-6 6 6-6 6', logout: 'M9 4H4v16h5m5-13 5 5-5 5M8 12h11',
    close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', image: 'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01',
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">L</span><div>LD LATTE<small>Автоматизация процессов</small></div></div>;
}

export function FieldError({ children, id }: { children?: ReactNode; id: string }) {
  return children ? <p className="field-error" id={id} role="alert">{children}</p> : null;
}

export function readPreference(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
export function writePreference(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ } }
