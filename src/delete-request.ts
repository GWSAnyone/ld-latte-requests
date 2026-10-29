import type { RequestItem } from './domain';
import { deleteRequest, getRequest } from './supabase';
import { removeImages } from './storage';

const gateway = { deleteRequest, getRequest, removeImages };

export class RequestDeleteSession {
  private paths: Set<string>;
  constructor(private item: RequestItem, private api = gateway) {
    this.paths = new Set((item.images || []).map(image => image.path));
  }

  async remove(temporaryPaths: string[] = []): Promise<string | undefined> {
    temporaryPaths.forEach(path => this.paths.add(path));
    // Keep paths before DELETE: its response can be lost after the row was committed.
    const latest = await this.api.getRequest(this.item.id);
    latest?.images?.forEach(image => this.paths.add(image.path));
    const deleted = await this.api.deleteRequest(this.item.id);
    deleted?.images?.forEach(image => this.paths.add(image.path));
    if (!deleted && await this.api.getRequest(this.item.id)) throw new Error('Request deletion was not confirmed');
    const cleaned = await this.api.removeImages([...this.paths]);
    return cleaned ? undefined : 'Заявка удалена. Не удалось очистить все изображения в хранилище; обратитесь к администратору.';
  }
}
