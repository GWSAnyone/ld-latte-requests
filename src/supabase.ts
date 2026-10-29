import { createClient } from '@supabase/supabase-js';
import { cleanChecklist } from './domain';
import type { ChecklistItem, Draft, RequestItem } from './domain';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configured = Boolean(url && key && !url.includes('your-project') && !key.includes('your-publishable'));
export const recoveryRequested = typeof location !== 'undefined' && new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
export const supabase = configured ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export async function listRequests(): Promise<RequestItem[]> {
  const items: RequestItem[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase!.from('requests').select('*')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    items.push(...data as RequestItem[]);
    if (data.length < pageSize) return items;
  }
}

export async function updateChecklist(item: RequestItem, checklist: ChecklistItem[]): Promise<RequestItem> {
  const { data, error } = await supabase!.from('requests').update({ checklist })
    .eq('id', item.id).eq('updated_at', item.updated_at).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Заявка изменилась. Обновите список и повторите.'), { name: 'UserError' });
  return data as RequestItem;
}

export async function saveRequest(id: string, draft: Draft, editing: boolean): Promise<RequestItem> {
  const payload = { title: draft.title.trim(), description: draft.description.trim(), category: draft.category, priority: draft.priority,
    checklist: cleanChecklist(draft.checklist), images: draft.images };
  const query = editing
    ? supabase!.from('requests').update({ ...payload, status: draft.status }).eq('id', id)
    : supabase!.from('requests').insert({ ...payload, id });
  const { data, error } = await query.select('*').single();
  if (!error) return data as RequestItem;
  // A retry after a lost response must not create a second request or discard changed form data.
  if (!editing && error.code === '23505') {
    const retry = await supabase!.from('requests').update(payload).eq('id', id).select('*').single();
    if (retry.error) throw retry.error;
    return retry.data as RequestItem;
  }
  throw error;
}
export async function getRequest(id: string): Promise<RequestItem | null> {
  const { data, error } = await supabase!.from('requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as RequestItem | null;
}
export async function deleteRequest(id: string): Promise<RequestItem | null> {
  const { data, error } = await supabase!.from('requests').delete().eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data as RequestItem | null;
}
