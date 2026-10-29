import type { RequestImage } from './domain';
import { usePrivateImage } from './images';
import { Icon } from './ui';
import type { ViewedImage } from './ImageViewer';

export function ImageAttachment({ image, preview, onCaption, onRemove, onOpen }: { image: RequestImage; preview?: string; onCaption: (caption: string) => void; onRemove: () => void; onOpen: (image: ViewedImage) => void }) {
  const remote = usePrivateImage(preview ? undefined : image.path);
  const url = preview || remote.url;
  return <div className="attachment">
    <div className="attachment-preview">{url ? <button type="button" onClick={() => onOpen({ url, name: image.name, caption: image.caption })} aria-label={`Открыть изображение: ${image.name}`}><img src={url} alt={image.caption || image.name} loading="lazy" /><span className="attachment-enlarge"><Icon name="search" />Увеличить</span></button> : remote.failed ? <button type="button" className="image-retry" onClick={remote.retry}>Повторить загрузку</button> : <span className="image-placeholder" aria-label="Загрузка изображения"><Icon name="image" /></span>}</div>
    <div className="attachment-heading"><span title={image.name}>{image.name}</span><button className="icon-button" type="button" aria-label={`Удалить изображение: ${image.name}`} onClick={onRemove}><Icon name="close" /></button></div>
    <label htmlFor={`caption-${image.id}`}>Подпись изображения</label><textarea id={`caption-${image.id}`} aria-label={`Подпись: ${image.name}`} maxLength={500} rows={2} placeholder="Что показано на изображении?" value={image.caption || ''} onChange={event => onCaption(event.target.value)} />
  </div>;
}
