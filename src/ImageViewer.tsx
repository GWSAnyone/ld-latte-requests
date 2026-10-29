import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui';

export interface ViewedImage { url: string; name: string; caption?: string }

export function ImageViewer({ image, onClose }: { image: ViewedImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return createPortal(<dialog ref={dialog} className="image-lightbox" aria-label="Просмотр изображения" onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <header className="lightbox-header"><div><strong>{image.name}</strong><span>Изображение заявки</span></div><div><button type="button" className="lightbox-action" onClick={() => setZoom(!zoom)} aria-pressed={zoom}>{zoom ? 'Вписать в окно' : 'Увеличить'}</button><button type="button" className="icon-button" aria-label="Закрыть изображение" onClick={onClose} autoFocus><Icon name="close" /></button></div></header>
    <div className={`lightbox-canvas ${zoom ? 'is-zoomed' : ''}`}><img src={image.url} alt={image.caption || image.name} onClick={() => setZoom(!zoom)} /></div>
    {image.caption && <p className="lightbox-caption">{image.caption}</p>}
  </dialog>, document.body);
}
