import { expect, test } from 'bun:test';
import { RequestSaveSession } from '../src/request-session';
import { emptyDraft } from '../src/domain';
import type { RequestItem } from '../src/domain';
import type { PendingImage } from '../src/storage';

const row = (id: string): RequestItem => ({ id, user_id: 'owner', title: 'Test', description: 'Description', category: 'Бот', status: 'Новая', checklist: [], images: [], created_at: '2026-10-29T10:00:00Z', updated_at: '2026-10-29T10:00:00Z' });
const image: PendingImage = { id: 'image', path: 'owner/request/image.webp', name: 'image.webp', blob: new Blob(['image']), preview: 'blob:preview' };
const draft = { ...emptyDraft(), title: 'Test', description: 'Description', category: 'Бот' as const };

test('stable request ID and immutable paths survive a lost save response', async () => {
  let saved: RequestItem | null = null; let first = true; const ids: string[] = [];
  const session = new RequestSaveSession(null, {
    uploadImages: async () => {}, removeImages: async () => true,
    getRequest: async () => saved,
    saveRequest: async (id, data) => { ids.push(id); saved = { ...row(id), images: data.images }; if (first) { first = false; throw new Error('lost response'); } return saved; },
  });
  await expect(session.save(draft, [image], () => {})).rejects.toThrow('lost response');
  const result = await session.save(draft, [{ ...image, caption: '  Пример процесса  ' }], () => {});
  expect(result.item.images?.[0].caption).toBe('Пример процесса');
  expect(new Set(ids).size).toBe(1); expect(result.item.images).toHaveLength(1);
});

test('discard reconciles server state before removing uploaded files', async () => {
  let saved: RequestItem | null = null; const removed: string[][] = [];
  const session = new RequestSaveSession(null, {
    uploadImages: async () => {}, removeImages: async paths => { removed.push(paths); return true; },
    getRequest: async () => saved,
    saveRequest: async (id, data) => { saved = { ...row(id), images: data.images }; throw new Error('lost response'); },
  });
  await expect(session.save(draft, [image], () => {})).rejects.toThrow();
  const result = await session.discard();
  expect(result.item).not.toBeNull(); expect(removed.flat()).not.toContain(image.path);
});

test('partial upload failure is tracked for safe cleanup', async () => {
  const removed: string[][] = [];
  const session = new RequestSaveSession(null, {
    uploadImages: async () => { throw new Error('upload response lost'); },
    removeImages: async paths => { removed.push(paths); return true; },
    getRequest: async () => null, saveRequest: async id => row(id),
  });
  await expect(session.save(draft, [image], () => {})).rejects.toThrow();
  await session.discard(); expect(removed.flat()).toContain(image.path);
});

test('cleanup failure after successful save is a warning, not a false save error', async () => {
  const original = { ...row('request'), images: [{ id: image.id, path: image.path, name: image.name }] };
  const session = new RequestSaveSession(original, {
    uploadImages: async () => {}, removeImages: async () => false,
    getRequest: async () => original, saveRequest: async id => row(id),
  });
  const result = await session.save(draft, [], () => {});
  expect(result.item.id).toBe('request'); expect(result.warning).toContain('сохранена');
});
