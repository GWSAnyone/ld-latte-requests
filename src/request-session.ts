import type { Draft, RequestItem } from './domain';
import { getRequest, saveRequest } from './supabase';
import { removeImages, uploadImages } from './storage';
import type { PendingImage } from './storage';

const gateway = { getRequest, removeImages, saveRequest, uploadImages };

// A session owns immutable upload paths and a stable request ID across all retries.
export class RequestSaveSession {
  readonly id: string;
  private uploaded = new Set<string>();
  private detached = new Set<string>();
  private attempted = false;
  constructor(private original: RequestItem | null, private api = gateway) { this.id = original?.id || crypto.randomUUID(); }

  async removePending(image: PendingImage): Promise<boolean> {
    if (this.uploaded.has(image.path)) {
      if (this.attempted) this.detached.add(image.path);
      else if (!await this.api.removeImages([image.path])) return false;
    }
    if (!this.attempted) this.uploaded.delete(image.path);
    return true;
  }
  temporaryPaths(): string[] { return [...this.uploaded]; }


  async save(draft: Draft, pending: PendingImage[], progress: (value: string) => void) {
    // Track attempted uploads too: a failed response does not imply the server rejected the file.
    pending.forEach(image => this.uploaded.add(image.path));
    await this.api.uploadImages(pending, progress);
    const images = [...draft.images, ...pending.map(({ id, path, name, caption }) => ({ id, path, name, caption: caption?.trim() || '' }))];
    progress('Сохраняем заявку…'); this.attempted = true;
    const item = await this.api.saveRequest(this.id, { ...draft, images }, Boolean(this.original));
    const removed = (this.original?.images || []).filter(image => !images.some(entry => entry.path === image.path));
    const cleaned = await this.api.removeImages([...removed.map(image => image.path), ...this.detached]);
    return { item, warning: cleaned ? undefined : 'Заявка сохранена. Старые файлы не удалось удалить из хранилища; они больше не прикреплены к заявке.' };
  }

  async discard(): Promise<{ item: RequestItem | null; warning?: string }> {
    const persisted = this.attempted ? await this.api.getRequest(this.id) : null;
    const references = new Set((persisted?.images || []).map(image => image.path));
    const cleaned = await this.api.removeImages([...this.uploaded].filter(path => !references.has(path)));
    if (!cleaned) throw new Error('Could not clean temporary images');
    return { item: persisted, warning: persisted ? 'Показана последняя сохранённая версия заявки.' : undefined };
  }
}
