import { addElement } from './elements';
import { slideRect } from './geometry';
import { unionBounds } from './selection';
import { clone } from './slides';
import type { Element, Project } from './types';

/** Tiefe Kopien in Ablagereihenfolge (Gesperrte mit). Unbekannte Ids fallen weg. */
export function copyElements(p: Project, ids: string[]): Element[] {
  const set = new Set(ids);
  return p.order.filter((id) => set.has(id)).map((id) => clone(p.elements[id]!));
}

/**
 * Fügt auf `slide` ein, mit gleichem Abstand zur Slide-Ecke wie am Ursprung (Slide der Gruppen-Box) plus `step × 40`.
 * Neue Ids; Rolle, Sperre und «… Kopie»-Name wie bei duplicateElement.
 */
export function pasteElements(p: Project, entries: Element[], slide: number, step: number): string[] {
  if (!entries.length) return [];
  const box = unionBounds(entries);
  const { width } = p.format;
  const origin = Math.max(0, Math.ceil((box.x + box.width / 2) / width) - 1); // wie slideIndexOf: Naht gehört nach links
  const target = Math.min(Math.max(slide, 0), p.slides.length - 1);
  const dx = slideRect(p, target).x - slideRect(p, origin).x + step * 40;
  return entries.map((src) => {
    const copy = clone({ ...src, id: crypto.randomUUID(), x: src.x + dx, y: src.y + step * 40, name: `${src.name} Kopie` });
    addElement(p, copy);
    return copy.id;
  });
}
