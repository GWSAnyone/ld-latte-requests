import { expect, test } from 'bun:test';
import { RequestDeleteSession } from '../src/delete-request';
import type { RequestItem } from '../src/domain';

const item: RequestItem = { id: 'request', user_id: 'owner', title: 'Test', description: 'Test', category: 'Бот', status: 'Новая', created_at: '', updated_at: '', images: [{ id: 'image', path: 'owner/request/image.webp', name: 'image.webp' }] };

test('deletes row before cleaning its files including latest and temporary uploads', async () => {
  const calls: string[] = []; let removed: string[] = [];
  const latest = { ...item, images: [...item.images!, { id: 'new', path: 'owner/request/new.webp', name: 'new.webp' }] };
  const session = new RequestDeleteSession(item, {
    getRequest: async () => latest,
    deleteRequest: async () => { calls.push('delete'); return latest; },
    removeImages: async paths => { calls.push('files'); removed = paths; return true; },
  });
  expect(await session.remove(['owner/request/temp.webp'])).toBeUndefined();
  expect(calls).toEqual(['delete', 'files']);
  expect(removed).toHaveLength(3);
});

test('lost delete response retains paths and retry cleans files without recreating row', async () => {
  let persisted: RequestItem | null = item; let first = true; let cleaned: string[] = [];
  const session = new RequestDeleteSession(item, {
    getRequest: async () => persisted,
    deleteRequest: async () => { persisted = null; if (first) { first = false; throw new Error('network'); } return null; },
    removeImages: async paths => { cleaned = paths; return true; },
  });
  await expect(session.remove()).rejects.toThrow('network');
  expect(cleaned).toHaveLength(0);
  expect(await session.remove()).toBeUndefined();
  expect(cleaned).toEqual([item.images![0].path]);
});

test('failed delete never removes files', async () => {
  let cleaned = false;
  const session = new RequestDeleteSession(item, {
    getRequest: async () => item, deleteRequest: async () => { throw new Error('denied'); },
    removeImages: async () => { cleaned = true; return true; },
  });
  await expect(session.remove()).rejects.toThrow('denied'); expect(cleaned).toBe(false);
});

test('unconfirmed deletion is an error; file cleanup failure after deletion is a warning', async () => {
  const blocked = new RequestDeleteSession(item, { getRequest: async () => item, deleteRequest: async () => null, removeImages: async () => true });
  await expect(blocked.remove()).rejects.toThrow('not confirmed');
  const session = new RequestDeleteSession(item, { getRequest: async () => item, deleteRequest: async () => item, removeImages: async () => false });
  expect(await session.remove()).toContain('Заявка удалена');
});
