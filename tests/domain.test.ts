import { describe, expect, test } from 'bun:test';
import { emptyDraft, cleanChecklist, errorMessage, filterRequests, itemDraft, checklistSummary, validateDraft } from '../src/domain';
import type { RequestItem } from '../src/domain';

const item = (title: string, status: RequestItem['status']): RequestItem => ({ id: title, user_id: 'user', title, status, description: 'Описание', category: 'Бот', created_at: '2026-10-29T10:00:00Z', updated_at: '2026-10-29T10:00:00Z' });
const valid = { ...emptyDraft(), title: 'Заявка', description: 'Описание', category: 'Бот' as const };

describe('request validation', () => {
  test('requires all fields and rejects whitespace', () => {
    expect(validateDraft(emptyDraft())).not.toBeNull();
    expect(validateDraft({ ...valid, title: '   ' })).not.toBeNull();
    expect(validateDraft({ ...valid, description: '\n ' })).not.toBeNull();
    expect(validateDraft({ ...valid, category: '' })).not.toBeNull();
  });
  test('accepts valid draft and limits text', () => {
    expect(validateDraft(valid)).toBeNull();
    expect(validateDraft({ ...valid, title: 'a'.repeat(161) })).not.toBeNull();
    expect(validateDraft({ ...valid, description: 'a'.repeat(10001) })).not.toBeNull();
  });
  test('new request starts as New', () => expect(emptyDraft().status).toBe('Новая'));
});

describe('filters', () => {
  const items = [item('Отчёт по продажам', 'Новая'), item('Бот для заказов', 'В работе'), item('Отчёт по складу', 'Завершена')];
  test('case insensitive title search', () => expect(filterRequests(items, '  ОТЧЁТ ', '')).toHaveLength(2));
  test('combines title and status', () => expect(filterRequests(items, 'отчёт', 'Завершена').map(item => item.title)).toEqual(['Отчёт по складу']));
  test('searches description and checklist with combined filters', () => {
    const rows: RequestItem[] = [{ ...item('Отчёт', 'В работе'), description: 'Проверить источники', checklist: [{ id: '1', text: 'Согласовать данные', done: false }] }, item('Другая заявка', 'Новая')];
    expect(filterRequests(rows, 'ИСТОЧНИКИ', 'В работе')).toHaveLength(1);
    expect(filterRequests(rows, 'данные', 'В работе')).toHaveLength(1);
    expect(filterRequests(rows, 'данные', 'Новая')).toHaveLength(0);
  });
  test('empty and unmatched queries', () => {
    expect(filterRequests(items, '', '')).toHaveLength(3);
    expect(filterRequests(items, 'не существует', '')).toHaveLength(0);
  });
});

test('checklist limits and draft isolation', () => {
  const entry = { id: crypto.randomUUID(), text: 'Step', done: false };
  expect(validateDraft({ ...valid, checklist: [{ ...entry, text: ' ' }] })).toBeNull();
  expect(cleanChecklist([{ ...entry, text: ' \n ' }, { ...entry, id: 'filled', text: ' Step ', done: true }])).toEqual([{ ...entry, id: 'filled', text: 'Step', done: true }]);
  expect(cleanChecklist([{ ...entry, text: '' }])).toEqual([]);
  expect(validateDraft({ ...valid, checklist: Array.from({ length: 31 }, () => ({ ...entry })) })).not.toBeNull();
  expect(validateDraft({ ...valid, images: Array.from({ length: 4 }, () => ({ id: 'x', path: 'x', name: 'x' })) })).not.toBeNull();
  expect(validateDraft({ ...valid, images: [{ id: 'x', path: 'x', name: 'x', caption: 'x'.repeat(501) }] })).not.toBeNull();
  expect(validateDraft({ ...valid, images: [{ id: 'x', path: 'x', name: 'x', caption: 'Подпись' }] })).toBeNull();
  expect(checklistSummary([entry, { ...entry, done: true }])).toBe('1 из 2');
  const saved = { ...item('Test', 'Новая'), checklist: [entry] };
  const draft = itemDraft(saved); draft.checklist[0].done = true;
  expect(saved.checklist[0].done).toBe(false);
});

test('priority defaults, validation and combined filters', () => {
  expect(emptyDraft().priority).toBe('Не срочно');
  expect(itemDraft(item('Legacy', 'Новая')).priority).toBe('Не срочно');
  expect(validateDraft({ ...valid, priority: 'invalid' as never })).not.toBeNull();
  const rows: RequestItem[] = [{ ...item('Отчёт срочный', 'Новая'), priority: 'Срочно' }, { ...item('Отчёт важный', 'В работе'), priority: 'Важно' }, item('Отчёт обычный', 'Новая')];
  expect(filterRequests(rows, 'отчёт', 'Новая', 'Срочно').map(row => row.title)).toEqual(['Отчёт срочный']);
  expect(filterRequests(rows, '', 'В работе', 'Срочно')).toHaveLength(0);
  expect(filterRequests(rows, '', '', 'Не срочно')).toHaveLength(1);
});

test('errors have readable messages without leaking backend details', () => {
  expect(errorMessage({ code: 'invalid_credentials' })).toBe('Неверная почта или пароль.');
  expect(errorMessage({ message: 'Failed to fetch' })).toContain('интернет');
  expect(errorMessage({ message: 'sensitive backend detail' })).not.toContain('sensitive');
});
