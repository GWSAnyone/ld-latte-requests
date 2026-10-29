import { useEffect, useState } from 'react';
import { signedImageUrl } from './storage';
import { maxImageBytes } from './domain';

export function userError(message: string): Error { return Object.assign(new Error(message), { name: 'UserError' }); }

export async function prepareImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw userError('Выберите JPG, PNG или WebP.');
  if (file.size > maxImageBytes) throw userError('Размер изображения должен быть не больше 5 МБ.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw userError('Не удалось открыть изображение. Выберите другой файл.'); }
  try {
    if (bitmap.width * bitmap.height > 32000000) throw userError('Изображение слишком большое. Максимум 32 мегапикселя.');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob?.type === 'image/webp' && blob.size <= maxImageBytes ? resolve(blob) : reject(userError('Не удалось подготовить изображение.')), 'image/webp', .86));
  } finally { bitmap.close(); }
}

export function usePrivateImage(path?: string) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setUrl(''); setFailed(false);
    if (!path) return;
    async function refresh() {
      try {
        const signedUrl = await signedImageUrl(path!);
        if (active) { setFailed(false); setUrl(signedUrl); }
      } catch { if (active) setFailed(true); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 240000);
    return () => { active = false; clearInterval(timer); };
  }, [path, revision]);
  return { url, failed, retry: () => setRevision(value => value + 1) };
}
