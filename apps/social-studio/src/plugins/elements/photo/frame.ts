import { resizeCrop } from '../../../model/crop';
import type { Element } from '../../../model/types';
import { apply } from '../../../store/document';
import { frameOf, imageArea, type PhotoProps } from './schema';

/**
 * Rahmen an/aus, ein apply = ein Undo-Schritt. Aus löscht `frame` und `frameOutside` (auch beim Altprojekt mit Innenrahmen),
 * an setzt immer den Rahmen aussen (R8). Ändert sich der Bildbereich (nur beim alten Innenrahmen), bleibt der Ausschnitt deckend.
 */
export const toggleFrame = (id: string) =>
  apply((d) => {
    const el = d.elements[id] as Element<PhotoProps>;
    const before = imageArea(el.props, el);
    if (frameOf(el.props)) {
      delete el.props.frame;
      delete el.props.frameOutside;
    } else {
      el.props.frame = true;
      el.props.frameOutside = true;
    }
    const img = el.props.assetId === undefined ? undefined : d.assets[el.props.assetId];
    if (img) el.props.crop = resizeCrop(before, imageArea(el.props, el), img, el.props.crop);
  });
