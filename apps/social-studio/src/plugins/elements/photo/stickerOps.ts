import { duplicateElement, moveInOrder } from '../../../model/elements';
import { slideIndexOf } from '../../../model/geometry';
import type { Element, Project } from '../../../model/types';
import { useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { tryApply } from '../../../ui/actions';
import { isVideo, maskOf, type PhotoProps } from './schema';

export const NO_MASK = 'Erst Hintergrund entfernen';
export const NO_TITLE = 'Auf dieser Slide fehlt ein Titel';

/**
 * Titel der Slide, auf der die Mitte des Fotos liegt: das sichtbare Text-Element mit Rolle «titel» (Layouts), sonst das mit der
 * grössten Schrift (bei Gleichstand das oberste). Ohne Text: undefined.
 */
export function titleOf(p: Project | null | undefined, photoId: string): string | undefined {
  const photo = p?.elements[photoId];
  if (!p || !photo) return undefined;
  const texts = p.order
    .map((id) => p.elements[id]!)
    .filter((e) => e.type === 'text' && e.visible && slideIndexOf(p, e) === slideIndexOf(p, photo));
  const size = (e: Element) => (e.props as { fontSize: number }).fontSize;
  return (texts.find((e) => e.role === 'titel') ?? texts.reduce<Element | undefined>((m, e) => (m && size(m) > size(e) ? m : e), undefined))?.id;
}

const maskedPhoto = (id: string) => {
  const el = useDoc.getState().project?.elements[id] as Element<PhotoProps> | undefined;
  return el && el.type === 'photo' && !isVideo(el.props) && maskOf(el.props) !== undefined ? el : undefined;
};

/** Kopie des freigestellten Fotos wie «Duplizieren» (um 40 px versetzt), ganz oben und ausgewählt; ein Undo-Schritt. */
export function copyAsSticker(id: string): string | undefined {
  if (!maskedPhoto(id)) return undefined;
  let copy = '';
  const ok = tryApply((d) => {
    copy = duplicateElement(d, id);
    moveInOrder(d, copy, d.order.length - 1);
  });
  if (!ok) return undefined;
  useUi.getState().setSelectedId(copy);
  return copy;
}

/** Deckungsgleiche Kopie direkt über dem Titel der Slide (das Original bleibt, wo es ist); ein Undo-Schritt. */
export function copyBehindTitle(id: string): string | undefined {
  const head = maskedPhoto(id) && titleOf(useDoc.getState().project, id);
  if (!head) return undefined;
  let copy = '';
  const ok = tryApply((d) => {
    const o = d.elements[id]!;
    copy = duplicateElement(d, id);
    Object.assign(d.elements[copy]!, { x: o.x, y: o.y });
    moveInOrder(d, copy, d.order.filter((i) => i !== copy).indexOf(head) + 1);
  });
  if (!ok) return undefined;
  useUi.getState().setSelectedId(copy);
  return copy;
}
