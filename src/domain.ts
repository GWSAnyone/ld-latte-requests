export const categories = ['Бот', 'Интеграция', 'Отчёт', 'Другое'] as const;
export const priorities = ['Срочно', 'Важно', 'Не срочно'] as const;
export type Priority = typeof priorities[number];
export const defaultPriority: Priority = 'Не срочно';
export const statuses = ['Новая', 'В работе', 'Завершена'] as const;
export type Category = typeof categories[number];
export type Status = typeof statuses[number];

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface RequestImage { id: string; path: string; name: string; caption?: string }
export const maxImages = 3;
export const maxImageBytes = 5 * 1024 * 1024;

export interface RequestItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  created_at: string;
  updated_at: string;
  priority?: Priority;
  checklist?: ChecklistItem[];
  images?: RequestImage[];
}

export interface Draft {
  title: string;
  description: string;
  category: Category | '';
  priority: Priority;
  status: Status;
  checklist: ChecklistItem[];
  images: RequestImage[];
}

export const emptyDraft = (): Draft => ({ title: '', description: '', category: '', priority: defaultPriority, status: 'Новая', checklist: [], images: [] });
export const itemDraft = (item: RequestItem): Draft => ({ title: item.title, description: item.description, category: item.category, priority: item.priority || defaultPriority, status: item.status, checklist: (item.checklist || []).map(entry => ({ ...entry })), images: (item.images || []).map(image => ({ ...image })) });
export const checklistSummary = (entries: ChecklistItem[] = []) => `${entries.filter(entry => entry.done).length} из ${entries.length}`;

export function draftFieldErrors(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = 'Укажите название заявки.';
  else if (draft.title.trim().length > 160) errors.title = 'Название должно быть не длиннее 160 символов.';
  if (!draft.description.trim()) errors.description = 'Опишите задачу.';
  else if (draft.description.trim().length > 10000) errors.description = 'Описание должно быть не длиннее 10 000 символов.';
  if (!categories.includes(draft.category as Category)) errors.category = 'Выберите категорию.';
  if (!priorities.includes(draft.priority)) errors.priority = 'Выберите срочность из списка.';
  if (!statuses.includes(draft.status)) errors.status = 'Выберите статус из списка.';
  return errors;
}

export function cleanChecklist(entries: ChecklistItem[]): ChecklistItem[] {
  return entries.filter(entry => entry.text.trim()).map(entry => ({ ...entry, text: entry.text.trim() }));
}

export function validateDraft(draft: Draft): string | null {
  const fieldError = Object.values(draftFieldErrors(draft))[0];
  if (fieldError) return fieldError;
  const checklist = cleanChecklist(draft.checklist);
  if (checklist.length > 30 || checklist.some(entry => entry.text.length > 300)) return 'В чек-листе допускается до 30 пунктов по 300 символов.';
  if (draft.images.length > maxImages) return 'Можно прикрепить до трёх изображений.';
  if (draft.images.some(image => (image.caption || '').length > 500)) return 'Подпись изображения должна быть не длиннее 500 символов.';
  return null;
}

export function filterRequests(items: RequestItem[], search: string, status: Status | '', priority: Priority | '' = ''): RequestItem[] {
  const query = search.trim().toLocaleLowerCase('ru');
  return items.filter(item => (!status || item.status === status) && (!priority || (item.priority || defaultPriority) === priority)
    && [item.title, item.description, ...(item.checklist || []).map(entry => entry.text)].some(text => text.toLocaleLowerCase('ru').includes(query)));
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'UserError') return error.message;
  const value = error as { code?: string; message?: string; status?: number } | null;
  const code = value?.code;
  if (code === 'same_password') return 'Новый пароль должен отличаться от прежнего.';
  if (code === 'otp_expired') return 'Ссылка истекла. Запросите новое письмо для восстановления.';
  if (code === 'invalid_credentials') return 'Неверная почта или пароль.';
  if (code === 'email_not_confirmed') return 'Подтвердите почту по ссылке из письма, затем войдите.';
  if (code === 'user_already_exists') return 'Аккаунт с этой почтой уже существует. Попробуйте войти.';
  if (code === 'weak_password') return 'Пароль слишком простой. Используйте не менее 8 символов.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || value?.status === 429) return 'Слишком много попыток. Подождите немного и повторите.';
  if (code === '23514' || code === '23502' || code === '22P02') return 'Проверьте обязательные поля, категорию и статус.';
  if (code === '42501') return 'Нет доступа к заявке. Проверьте вход в аккаунт.';
  if (code === 'PGRST205' || code === '42P01') return 'Таблица заявок ещё не настроена. Обратитесь к администратору.';
  if (code === 'PGRST116') return 'Заявка недоступна. Обновите список и попробуйте снова.';
  if (code === 'refresh_token_not_found' || code === 'session_not_found' || value?.status === 401) return 'Сессия истекла. Выйдите и войдите снова.';
  if (/fetch|network|load failed|timeout/i.test(value?.message || '')) return 'Не удалось связаться с сервером. Проверьте интернет и повторите.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
}
