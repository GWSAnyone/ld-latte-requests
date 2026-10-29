import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { categories, checklistSummary, draftFieldErrors, emptyDraft, errorMessage, formatDate, itemDraft, maxImages, statuses, validateDraft } from './domain';
import type { Draft, RequestItem, Status } from './domain';
import { RequestDeleteSession } from './delete-request';
import { RequestSaveSession } from './request-session';
import type { PendingImage } from './storage';
import { prepareImage } from './images';
import { ImageAttachment } from './ImageAttachment';
import { ImageViewer } from './ImageViewer';
import type { ViewedImage } from './ImageViewer';
import { PriorityPicker } from './Priority';
import { FieldError, Icon } from './ui';

export function RequestEditor({ item, userId, onClose, onSaved, onDeleted }: { item: RequestItem | null; userId: string; onClose: () => void; onSaved: (item: RequestItem, warning?: string) => void; onDeleted: (id: string, warning?: string) => void }) {
  const initial = useRef(item ? itemDraft(item) : emptyDraft());
  const [draft, setDraft] = useState<Draft>(initial.current);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [stage, setStage] = useState('');
  const [viewer, setViewer] = useState<ViewedImage | null>(null);
  const [discard, setDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteSession = useRef<RequestDeleteSession | null>(null);
  if (item && !deleteSession.current) deleteSession.current = new RequestDeleteSession(item);
  const saveSession = useRef<RequestSaveSession | null>(null);
  if (!saveSession.current) saveSession.current = new RequestSaveSession(item);
  const id = saveSession.current.id;
  const lock = useRef(false);
  const imageLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const overlayFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (discard || confirmDelete) {
      overlayFocus.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>(confirmDelete ? '.delete-confirm button' : '.drawer-confirm button')?.focus());
    } else overlayFocus.current?.focus();
  }, [discard, confirmDelete]);
  const checklistRefs = useRef(new Map<string, HTMLInputElement>());
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current) || pending.length > 0;

  useEffect(() => {
    const element = dialog.current!; element.showModal();
    return () => { element.close(); pendingRef.current.forEach(image => URL.revokeObjectURL(image.preview)); };
  }, []);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  function close() { if (!lock.current && !imageLock.current) { if (dirty) setDiscard(true); else onClose(); } }
  async function abandon() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await saveSession.current!.discard();
      if (result.item) onSaved(result.item, result.warning);
      else onClose();
    } catch { setError('Не удалось проверить сохранение или удалить временные изображения. Проверьте соединение и повторите закрытие.'); setDiscard(false); lock.current = false; setBusy(false); }
  }
  function addTask() {
    if (draft.checklist.length >= 30) return;
    const entry = { id: crypto.randomUUID(), text: '', done: false };
    setDraft(current => ({ ...current, checklist: [...current.checklist, entry] }));
    requestAnimationFrame(() => checklistRefs.current.get(entry.id)?.focus());
  }
  async function addImages(files: File[]) {
    if (imageLock.current || lock.current || !files.length) return;
    const count = draft.images.length + pending.length;
    if (count + files.length > maxImages) { setError('Можно прикрепить до трёх изображений.'); return; }
    imageLock.current = true; setPreparing(true); setError('');
    const prepared: PendingImage[] = [];
    try {
      for (const file of files) {
        const blob = await prepareImage(file); const imageId = crypto.randomUUID();
        prepared.push({ id: imageId, blob, name: file.name.slice(0, 160), preview: URL.createObjectURL(blob), path: `${userId}/${id}/${imageId}.webp` });
      }
      setPending(current => [...current, ...prepared]);
    } catch (cause) { prepared.forEach(image => URL.revokeObjectURL(image.preview)); setError(errorMessage(cause)); }
    finally { imageLock.current = false; setPreparing(false); if (imageInput.current) imageInput.current.value = ''; }
  }
  async function removePending(image: PendingImage) {
    if (lock.current || imageLock.current) return;
    imageLock.current = true; setPreparing(true);
    try {
      if (!await saveSession.current!.removePending(image)) { setError('Не удалось удалить изображение. Повторите попытку.'); return; }
      URL.revokeObjectURL(image.preview);
      setPending(current => current.filter(entry => entry.id !== image.id));
    } finally { imageLock.current = false; setPreparing(false); }
  }
  async function remove() {
    if (!item || !deleteSession.current || lock.current || imageLock.current) return;
    lock.current = true; setBusy(true); setDeleteError(''); setStage('Удаляем заявку…');
    try {
      const warning = await deleteSession.current.remove(saveSession.current!.temporaryPaths());
      onDeleted(item.id, warning);
    } catch (cause) { setDeleteError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); setStage(''); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || imageLock.current) return;
    const validation = draftFieldErrors(draft);
    setFields(validation);
    const message = validateDraft({ ...draft, images: [...draft.images, ...pending.map(({ id, path, name, caption }) => ({ id, path, name, caption }))] });
    if (message) { setError(Object.keys(validation).length ? '' : message); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const { item: saved, warning } = await saveSession.current!.save(draft, pending, setStage);
      onSaved(saved, warning);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); setStage(''); }
  }

  return <dialog className="editor drawer" ref={dialog} aria-labelledby="editor-title" onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); if (lock.current) return; if (confirmDelete) setConfirmDelete(false); else if (discard) setDiscard(false); else close(); }}>
    <header className="editor-header" inert={discard || confirmDelete || Boolean(viewer)}><div><span className="eyebrow">{item ? 'ВАША ЗАЯВКА' : 'НОВАЯ ИДЕЯ'}</span><h2 id="editor-title">{item ? 'Заявка на автоматизацию' : 'Новая заявка'}</h2></div><button type="button" className="icon-button" aria-label="Закрыть форму" onClick={close} disabled={busy || preparing}><Icon name="close" /></button></header>
    <form onSubmit={submit} noValidate inert={discard || confirmDelete || Boolean(viewer)}><div className="editor-body"><fieldset disabled={busy || preparing}>
      <label htmlFor="request-title"><span>Название<span className="required-mark" aria-hidden="true"> *</span></span><span className="field-hint">{draft.title.length} / 160</span></label><input id="request-title" name="title" required autoFocus maxLength={160} placeholder="Например, отчёт о продажах за неделю" value={draft.title} onChange={event => { setDraft({ ...draft, title: event.target.value }); if (event.target.value.trim()) setFields(current => ({ ...current, title: '' })); }} aria-invalid={Boolean(fields.title)} aria-describedby={fields.title ? 'title-error' : undefined} /><FieldError id="title-error">{fields.title}</FieldError>
      <label id="category-label"><span>Категория<span className="required-mark" aria-hidden="true"> *</span></span></label><div className={`category-picker${fields.category ? ' has-error' : ''}`} role="group" aria-labelledby="category-label" aria-describedby={fields.category ? 'category-error' : undefined}>{categories.map(category => <button type="button" key={category} aria-pressed={draft.category === category} onClick={() => { setDraft({ ...draft, category }); setFields(current => ({ ...current, category: '' })); }}>{category}</button>)}</div><FieldError id="category-error">{fields.category}</FieldError>
      <label>Срочность</label><PriorityPicker value={draft.priority} onChange={priority => setDraft(current => ({ ...current, priority }))} /><FieldError id="priority-error">{fields.priority}</FieldError>
      <label htmlFor="request-description"><span>Описание задачи<span className="required-mark" aria-hidden="true"> *</span></span></label><textarea id="request-description" name="description" required rows={5} maxLength={10000} placeholder="Как устроен процесс сейчас и какой результат нужен?" value={draft.description} onChange={event => { setDraft({ ...draft, description: event.target.value }); if (event.target.value.trim()) setFields(current => ({ ...current, description: '' })); }} aria-invalid={Boolean(fields.description)} aria-describedby={fields.description ? 'description-error' : undefined} /><FieldError id="description-error">{fields.description}</FieldError>
      <div className="editor-section-head"><h3>План выполнения</h3><span>{draft.checklist.length ? checklistSummary(draft.checklist) : 'Необязательно'}</span></div>
      <div className="checklist">{draft.checklist.map((entry, index) => <div className={`checklist-row ${entry.done ? 'is-done' : ''}`} key={entry.id}><input type="checkbox" aria-label={`Выполнить пункт ${index + 1}`} checked={entry.done} onChange={event => setDraft({ ...draft, checklist: draft.checklist.map(task => task.id === entry.id ? { ...task, done: event.target.checked } : task) })} /><input ref={node => { if (node) checklistRefs.current.set(entry.id, node); else checklistRefs.current.delete(entry.id); }} aria-label={`Пункт ${index + 1}`} value={entry.text} maxLength={300} placeholder="Что нужно сделать?" onChange={event => setDraft({ ...draft, checklist: draft.checklist.map(task => task.id === entry.id ? { ...task, text: event.target.value } : task) })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTask(); } }} /><button type="button" className="icon-button" aria-label={`Удалить пункт ${index + 1}`} onClick={() => setDraft({ ...draft, checklist: draft.checklist.filter(task => task.id !== entry.id) })}><Icon name="close" /></button></div>)}</div>
      <button type="button" className="text-action add-task" onClick={addTask} disabled={draft.checklist.length >= 30}><Icon name="plus" />Добавить пункт</button>
      {item && draft.checklist.length > 0 && draft.checklist.every(entry => entry.done) && draft.status !== 'Завершена' && <button type="button" className="completion-hint" onClick={() => setDraft({ ...draft, status: 'Завершена' })}>Все пункты выполнены. Завершить заявку?</button>}
      <div className="editor-section-head"><h3>Изображения</h3><span>{draft.images.length + pending.length} / 3</span></div>
      <div className="image-grid">{draft.images.map(image => <ImageAttachment key={image.id} image={image} onOpen={setViewer} onCaption={caption => setDraft(current => ({ ...current, images: current.images.map(entry => entry.id === image.id ? { ...entry, caption } : entry) }))} onRemove={() => { if (window.confirm('Убрать изображение из заявки?')) setDraft(current => ({ ...current, images: current.images.filter(entry => entry.id !== image.id) })); }} />)}{pending.map(image => <ImageAttachment key={image.id} image={image} preview={image.preview} onOpen={setViewer} onCaption={caption => setPending(current => current.map(entry => entry.id === image.id ? { ...entry, caption } : entry))} onRemove={() => { if (window.confirm('Убрать изображение?')) void removePending(image); }} />)}</div>
      {draft.images.length + pending.length < maxImages && <div className="image-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void addImages(Array.from(event.dataTransfer.files)); }}><input ref={imageInput} className="sr-only" id="image-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void addImages(Array.from(event.target.files || []))} /><button type="button" className="image-upload-button" onClick={() => imageInput.current?.click()}><Icon name="image" /><strong>Добавить изображения</strong><span>Перетащите сюда или выберите файл · до 5 МБ</span></button></div>}
      <p className="field-note">JPG, PNG, WebP. Изображения доступны только вам. При загрузке уменьшаются до 1600 px.</p>
      <label htmlFor="request-status">Статус</label><select id="request-status" name="status" disabled={!item} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Status })}>{statuses.map(status => <option key={status}>{status}</option>)}</select>
      <p className="field-note">{item ? `Создана ${formatDate(item.created_at)}` : 'Новая заявка автоматически получит статус «Новая».'}</p>
      {item && <section className="delete-section" aria-label="Удаление заявки"><div><h3>Удаление заявки</h3><p>Заявка, чек-лист и изображения будут удалены без возможности восстановления.</p></div><button className="danger-secondary" type="button" onClick={() => { setDeleteError(''); setConfirmDelete(true); }}>Удалить заявку</button></section>}
    </fieldset>{preparing && <p className="field-note" role="status">Подготавливаем изображения…</p>}{error && <div className="notice error" role="alert">{error}</div>}</div>
    <footer className="editor-footer"><span className="draft-state" role="status">{busy ? stage : dirty ? 'Есть несохранённые изменения' : item ? 'Все изменения сохранены' : 'Новая заявка'}</span><button type="button" className="secondary" onClick={close} disabled={busy || preparing}>Отмена</button><button type="submit" className="primary" disabled={busy || preparing}>{busy ? 'Сохраняем…' : item ? 'Сохранить изменения' : 'Создать заявку'}{!busy && <Icon name="check" />}</button></footer></form>
    {discard && <div className="drawer-confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title"><h3 id="discard-title">Закрыть без сохранения?</h3><p>Изменения в заявке будут потеряны.</p><div><button type="button" className="secondary" autoFocus onClick={() => setDiscard(false)}>Продолжить редактирование</button><button type="button" className="primary" disabled={busy} onClick={() => void abandon()}>Не сохранять</button></div></div>}
    {confirmDelete && <div className="drawer-confirm delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><h3 id="delete-title">Удалить заявку?</h3><strong className="delete-request-name">{item?.title}</strong><p id="delete-description">Это действие нельзя отменить. Заявка, её чек-лист и изображения будут удалены. Несохранённые изменения не сохранятся.</p>{deleteError && <div className="notice error" role="alert">{deleteError}</div>}<div><button type="button" className="secondary" autoFocus disabled={busy} onClick={() => setConfirmDelete(false)}>Не удалять</button><button type="button" className="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Удаляем…' : 'Удалить навсегда'}</button></div></div>}
    {viewer && <ImageViewer image={viewer} onClose={() => setViewer(null)} />}
  </dialog>;
}
