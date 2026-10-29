import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { checklistSummary, errorMessage, filterRequests, formatDate, priorities, statuses } from './domain';
import type { Priority, RequestItem, Status } from './domain';
import { listRequests, supabase, updateChecklist } from './supabase';
import { PriorityTag } from './Priority';
import { RequestEditor } from './RequestEditor';
import { usePrivateImage } from './images';
import { Icon, readPreference, writePreference } from './ui';

function Cover({ path }: { path: string }) {
  const { url } = usePrivateImage(path);
  return url ? <img src={url} alt="" loading="lazy" /> : <span className="image-placeholder"><Icon name="image" /></span>;
}
function RequestPreview({ item, cards, onOpen, onToggle, busy }: { item: RequestItem; cards: boolean; onOpen: () => void; onToggle: (id: string, done: boolean) => void; busy: boolean }) {
  const summary = <span className="request-summary">{Boolean(item.images?.length) && <span className="checklist-summary"><Icon name="image" />{item.images!.length} изображ.</span>}</span>;
  const badge = <span className={`status-badge status-${statuses.indexOf(item.status)}`}><span className="status-dot" />{item.status}</span>;
  return <li className={`request-entry${cards ? ' card-entry' : ''}`}><button type="button" className={`request-row ${cards ? 'request-card' : ''}`} aria-label={`Открыть заявку: ${item.title}`} onClick={onOpen} disabled={busy}>
    {cards ? <>
      <span className="card-top"><span className="card-category">{item.category}</span><span className="card-badges"><PriorityTag value={item.priority} />{badge}</span></span>
      {item.images?.[0] && <span className="card-cover"><Cover path={item.images[0].path} /></span>}
      <span className="card-content"><strong className="card-title">{item.title}</strong><span className="card-description">{item.description}</span>{summary}</span>
    </> : <>
      <span className="request-name"><span><span className="request-title"><strong>{item.title}</strong><PriorityTag value={item.priority} /></span><small>{item.description}</small>{Boolean(item.images?.length) && <span className="request-summary"><span className="checklist-summary"><Icon name="image" />{item.images!.length} изображ.</span></span>}</span></span><span className="category-label">{item.category}</span><time dateTime={item.created_at}>{formatDate(item.created_at)}</time>{badge}<Icon name="arrow" />
    </>}
  </button>{Boolean(item.checklist?.length) && <div className={cards ? 'list-checklist card-checklist' : 'list-checklist row-checklist'} aria-label={`План заявки: ${item.title}`}>
    {item.checklist!.slice(0, cards ? 2 : 3).map(entry => <label key={entry.id}><input type="checkbox" checked={entry.done} disabled={busy} onChange={event => onToggle(entry.id, event.target.checked)} /><span>{entry.text}</span></label>)}
    <span className="checklist-summary">{checklistSummary(item.checklist)} выполнено{item.checklist!.length > (cards ? 2 : 3) ? ' · остальные в заявке' : ''}</span>
  </div>}{cards && <div className="card-bottom card-entry-bottom"><time dateTime={item.created_at}>{formatDate(item.created_at)}</time><button type="button" className="card-open" onClick={onOpen} disabled={busy}>Открыть заявку<Icon name="arrow" /></button></div>}</li>;
}

export function Workspace({ session }: { session: Session }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [view, setView] = useState(() => readPreference('ld-latte-view', 'cards') === 'list' ? 'list' : 'cards');
  const [editor, setEditor] = useState<{ item: RequestItem | null } | null>(null);
  const [notice, setNotice] = useState('');
  const [warning, setWarning] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutLock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const visible = useMemo(() => filterRequests(items, search, status, priority), [items, search, status, priority]);
  const trigger = useRef<HTMLElement | null>(null);
  function open(item: RequestItem | null) { trigger.current = document.activeElement as HTMLElement; setNotice(''); setWarning(''); setEditor({ item }); }
  function close() { setEditor(null); requestAnimationFrame(() => trigger.current?.focus()); }
  async function load() {
    const current = ++generation.current; setLoading(true); setLoadError('');
    try { const data = await listRequests(); if (mounted.current && generation.current === current) setItems(data); }
    catch (cause) { if (mounted.current && generation.current === current) setLoadError(errorMessage(cause)); }
    finally { if (mounted.current && generation.current === current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; generation.current++; }; }, []);
  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true; setLogoutBusy(true); setLogoutError('');
    try {
      const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) throw error;
      try { sessionStorage.removeItem('ld-latte-request-count'); } catch { /* Storage may be blocked. */ }
    } catch (cause) { setLogoutError(errorMessage(cause)); }
    finally { logoutLock.current = false; setLogoutBusy(false); }
  }
  const checklistLocks = useRef(new Set<string>());
  const [checklistBusy, setChecklistBusy] = useState<Set<string>>(new Set());
  async function toggleChecklist(item: RequestItem, id: string, done: boolean) {
    if (checklistLocks.current.has(item.id)) return;
    checklistLocks.current.add(item.id); setChecklistBusy(new Set(checklistLocks.current)); setWarning(''); setNotice('');
    try {
      const updated = await updateChecklist(item, (item.checklist || []).map(entry => entry.id === id ? { ...entry, done } : entry));
      generation.current++; setItems(current => current.map(entry => entry.id === item.id ? updated : entry));
    } catch (cause) { setWarning(errorMessage(cause)); }
    finally { checklistLocks.current.delete(item.id); if (mounted.current) setChecklistBusy(new Set(checklistLocks.current)); }
  }
  function saved(item: RequestItem, cleanupWarning?: string) {
    generation.current++;
    setItems(current => [item, ...current.filter(entry => entry.id !== item.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setLoading(false); setLoadError(''); setSearch(''); setStatus(''); setPriority('');
    setNotice(editor?.item ? 'Изменения сохранены.' : 'Заявка создана.'); setWarning(cleanupWarning || ''); close();
  }
  function deleted(id: string, cleanupWarning?: string) {
    generation.current++;
    setItems(current => current.filter(item => item.id !== id));
    setNotice('Заявка удалена.'); setWarning(cleanupWarning || ''); close();
  }
  return <div className="app-layout">
    <aside className="sidebar ld-sidebar">{createElement('ld-navigation', { section: 'requests', count: loading ? undefined : items.length })}<div className="sidebar-user"><div className="avatar" aria-hidden="true">{session.user.email?.[0].toUpperCase() || 'U'}</div><div><strong>Ваш аккаунт</strong><span title={session.user.email}>{session.user.email}</span></div></div><button type="button" className="logout" aria-label={logoutBusy ? 'Выходим из аккаунта' : 'Выйти из аккаунта'} title="Выйти из аккаунта" onClick={logout} disabled={logoutBusy}><Icon name="logout" /><span>{logoutBusy ? 'Выходим…' : 'Выйти из аккаунта'}</span></button>{logoutError && <p className="sidebar-error" role="alert">{logoutError}</p>}</aside>
    <main className="workspace" id="requests"><header className="workspace-header"><div><span className="eyebrow">АВТОМАТИЗАЦИЯ</span><h1>Мои заявки<span className="heading-count">{items.length}</span></h1><p className="muted">Освободите время для важного. Начните с одной идеи.</p></div><button type="button" className="primary" aria-label="Новая заявка" onClick={() => open(null)} disabled={loading || Boolean(loadError)}><Icon name="plus" /><span className="new-request-label">Новая заявка</span><span className="new-request-short" aria-hidden="true">Новая</span></button></header>
      <section className="request-controls" aria-label="Поиск и фильтры"><div className="filter-bar"><div className="search-field"><Icon name="search" /><input aria-label="Поиск по заявкам" type="search" placeholder="Найти заявку…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" className="icon-button" aria-label="Очистить поиск" onClick={() => setSearch('')}><Icon name="close" /></button>}</div><div className="view-toggle" aria-label="Вид заявок">{(['cards', 'list'] as const).map(value => <button key={value} type="button" aria-label={value === 'cards' ? 'Карточки' : 'Список'} aria-pressed={view === value} onClick={() => { setView(value); writePreference('ld-latte-view', value); }}><Icon name={value === 'cards' ? 'grid' : 'list'} /></button>)}</div></div>
      <div className="filter-bottom"><div className="status-tabs" role="group" aria-label="Фильтр по статусу">{(['', ...statuses] as const).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{value || 'Все'}<span>{value ? items.filter(item => item.status === value).length : items.length}</span></button>)}</div><select className="priority-filter" aria-label="Фильтр по срочности" value={priority} onChange={event => setPriority(event.target.value as Priority | '')}><option value="">Любая срочность</option>{priorities.map(value => <option key={value}>{value}</option>)}</select><span className="results-count" aria-live="polite">{visible.length} из {items.length}</span></div></section>
      {notice && <div className="notice success save-notice" role="status"><Icon name="check" />{notice}<button className="icon-button" type="button" aria-label="Скрыть уведомление" onClick={() => setNotice('')}><Icon name="close" /></button></div>}{warning && <div className="notice" role="status">{warning}</div>}
      <section className="requests-results" aria-label="Список заявок" aria-busy={loading}>
      {loading ? <div className="skeleton-list" role="status" aria-label="Загружаем заявки">{[0, 1, 2].map(i => <div className="skeleton-card" key={i}><i /><i /><i /></div>)}</div> : loadError ? <div className="empty-state"><h2>Не удалось загрузить заявки</h2><p role="alert">{loadError}</p><button className="secondary" type="button" onClick={() => void load()}>Повторить</button></div> : visible.length ? <div className={`request-table ${view === 'cards' ? 'cards-view' : 'list-view'}`}><div className="table-head" aria-hidden="true"><span>Заявка</span><span>Категория</span><span>Дата создания</span><span>Статус</span><span /></div><ul>{visible.map(item => <RequestPreview key={item.id} item={item} cards={view === 'cards'} onOpen={() => open(item)} busy={checklistBusy.has(item.id)} onToggle={(id, done) => void toggleChecklist(item, id, done)} />)}</ul></div> : <div className="empty-state"><span className={`empty-symbol ${!items.length ? 'stacked' : ''}`} aria-hidden="true"><Icon name={items.length ? 'search' : 'plus'} /></span><h2>{items.length ? 'Ничего не найдено' : 'Место для вашей первой идеи'}</h2><p>{items.length ? 'Попробуйте другой запрос или измените фильтры.' : 'Бот, интеграция или отчёт — расскажите, что сделает вашу работу проще.'}</p>{items.length ? <button className="secondary" onClick={() => { setSearch(''); setStatus(''); setPriority(''); }}>Сбросить фильтры</button> : <button className="primary" onClick={() => open(null)}><Icon name="plus" />Создать заявку</button>}</div>}
      <footer className="panel-footer"><span>Только ваши заявки. Все изменения сохраняются в Supabase.</span><span>LD LATTE</span></footer></section>
    </main>{editor && <RequestEditor item={editor.item} userId={session.user.id} onClose={close} onSaved={saved} onDeleted={deleted} />}
  </div>;
}
