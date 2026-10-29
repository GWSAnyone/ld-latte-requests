import { supabase } from './supabase';

export const imageBucket = 'request-images';
export interface PendingImage { id: string; blob: Blob; name: string; preview: string; path: string; caption?: string }

export async function uploadImages(images: PendingImage[], progress: (value: string) => void): Promise<void> {
  for (let i = 0; i < images.length; i++) {
    progress(`Загружаем изображение ${i + 1} из ${images.length}…`);
    const image = images[i];
    const { error } = await supabase!.storage.from(imageBucket).upload(image.path, image.blob, { contentType: 'image/webp', upsert: false });
    // Immutable random paths make a duplicate safe after a lost upload response.
    if (error && !['409', 'Duplicate'].includes(String(error.statusCode || error.name))) throw error;
  }
}

export async function removeImages(paths: string[]): Promise<boolean> {
  if (!paths.length) return true;
  try { const { error } = await supabase!.storage.from(imageBucket).remove(paths); return !error; }
  catch { return false; }
}

export async function signedImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase!.storage.from(imageBucket).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
