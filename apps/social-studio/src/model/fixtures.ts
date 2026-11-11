import type { Element, Project } from './types';

export const el = (o: Partial<Element> = {}): Element => ({
  id: 'e',
  type: 'rect',
  name: 'e',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  props: {},
  ...o,
});

/** Post 1080×1350 mit n Slides und den gegebenen Elementen (Reihenfolge = order). */
export const project = (n: number, elements: Element[] = []): Project => ({
  schemaVersion: 1,
  id: 'p',
  name: 'p',
  format: { id: 'post', width: 1080, height: 1350 },
  createdAt: 0,
  updatedAt: 0,
  slides: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, background: 'warmweiss' as const })),
  elements: Object.fromEntries(elements.map((e) => [e.id, e])),
  order: elements.map((e) => e.id),
  assets: {},
});
