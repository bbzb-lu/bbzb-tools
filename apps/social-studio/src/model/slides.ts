import type { FormatPreset } from '../core/types';
import { slideIndexOf } from './geometry';
import type { Project, Slide } from './types';

export const MAX_SLIDES = 20;

export const LIMIT_TEXT = 'Instagram erlaubt höchstens 20 Slides.';

export class ModelError extends Error {}

// shortcut: JSON clone drops undefined/NaN; fine while the document is plain JSON
/** Tiefe Kopie, auch für immer-Drafts (Dokument ist reines JSON). */
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const newSlide = (): Slide => ({ id: crypto.randomUUID(), background: 'warmweiss' });

export function createProject(opts: { name: string; format: FormatPreset; now?: number }): Project {
  const now = opts.now ?? Date.now();
  const { id, width, height } = opts.format;
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: opts.name,
    format: { id, width, height },
    createdAt: now,
    updatedAt: now,
    slides: [newSlide()],
    elements: {},
    order: [],
    assets: {},
  };
}

/** Kopie mit neuer ID; Assets bleiben dieselben (gleiche Blobs in OPFS). */
export const duplicateProject = (p: Project, now = Date.now()): Project => ({
  ...clone(p),
  id: crypto.randomUUID(),
  name: `${p.name} (Kopie)`.slice(0, 200),
  createdAt: now,
  updatedAt: now,
});

function checkIndex(p: Project, i: number, max = p.slides.length - 1) {
  if (!Number.isInteger(i) || i < 0 || i > max) throw new ModelError('Diese Slide gibt es nicht.');
}

function checkLimit(p: Project) {
  if (p.slides.length >= MAX_SLIDES) throw new ModelError(LIMIT_TEXT);
}

/** Slide-Index jedes Elements, einmal vor jeder Mutation berechnet. */
const indices = (p: Project) => p.order.map((id) => [id, slideIndexOf(p, p.elements[id]!)] as const);

function shiftFrom(p: Project, from: number) {
  for (const [id, i] of indices(p)) if (i >= from) p.elements[id]!.x += p.format.width;
}

export function addSlide(p: Project, at: number): string {
  checkIndex(p, at, p.slides.length);
  checkLimit(p);
  shiftFrom(p, at);
  const s = newSlide();
  p.slides.splice(at, 0, s);
  return s.id;
}

/** Erste und letzte Slide der Gruppe von `index`: direkt benachbarte Slides mit derselben `link`-Id, ohne `link` die Slide selbst. */
export function groupOf(p: Pick<Project, 'slides'>, index: number): [first: number, last: number] {
  const link = p.slides[index]?.link;
  let [first, last] = [index, index];
  if (link === undefined) return [first, last];
  while (p.slides[first - 1]?.link === link) first--;
  while (p.slides[last + 1]?.link === link) last++;
  return [first, last];
}

/** Dupliziert die Gruppe von `index` direkt dahinter (eine verknüpfte Gruppe bekommt eine neue `link`-Id). Liefert die Id der ersten neuen Slide. */
export function duplicateSlide(p: Project, index: number): string {
  checkIndex(p, index);
  const [first, last] = groupOf(p, index);
  const n = last - first + 1;
  if (p.slides.length + n > MAX_SLIDES) throw new ModelError(n > 1 ? `${LIMIT_TEXT} Duplizieren braucht ${n} Slides.` : LIMIT_TEXT);
  const idx = indices(p);
  const onGroup = idx.filter(([, i]) => i >= first && i <= last).map(([id]) => id);
  for (let k = 0; k < n; k++) shiftFrom(p, last + 1);
  const link = p.slides[first]!.link === undefined ? undefined : crypto.randomUUID();
  const copiesOfSlides = p.slides.slice(first, last + 1).map((s) => ({ ...s, id: crypto.randomUUID(), ...(link && { link }) }));
  p.slides.splice(last + 1, 0, ...copiesOfSlides);
  const copies = onGroup.map((id) => {
    const src = p.elements[id]!;
    const copy = clone({ ...src, id: crypto.randomUUID(), x: src.x + n * p.format.width });
    p.elements[copy.id] = copy;
    return copy.id;
  });
  const top = onGroup.length ? Math.max(...onGroup.map((id) => p.order.indexOf(id))) + 1 : p.order.length;
  p.order.splice(top, 0, ...copies);
  return copiesOfSlides[0]!.id;
}

/** Löscht die Gruppe von `index` (eine verknüpfte Gruppe ganz). */
export function removeSlide(p: Project, index: number): void {
  checkIndex(p, index);
  const [first, last] = groupOf(p, index);
  const n = last - first + 1;
  if (p.slides.length - n < 1) throw new ModelError('Ein Projekt braucht mindestens eine Slide.');
  const idx = indices(p);
  p.slides.splice(first, n);
  for (const [id, i] of idx) {
    if (i >= first && i <= last) delete p.elements[id];
    else if (i > last) p.elements[id]!.x -= n * p.format.width;
  }
  p.order = p.order.filter((id) => p.elements[id]);
}

/**
 * Verschiebt die Gruppe von `from`, sodass ihre erste Slide bei `to` steht. Läge sie damit in einer anderen Gruppe, rundet `to`
 * auf deren Grenze in Zugrichtung: nach rechts hinter die Gruppe, nach links davor. Keine Gruppe wird geteilt.
 */
export function moveSlide(p: Project, from: number, to: number): void {
  checkIndex(p, from);
  checkIndex(p, to);
  const [first, last] = groupOf(p, from);
  const n = last - first + 1;
  const rest = p.slides.map((_, i) => i).filter((i) => i < first || i > last);
  let k = Math.min(to, rest.length);
  const inside = (j: number) => j > 0 && j < rest.length && groupOf(p, rest[j]!)[0] !== rest[j];
  while (inside(k)) k += to > first ? 1 : -1;
  if (k === first) return;
  const order = [...rest.slice(0, k), ...Array.from({ length: n }, (_, j) => first + j), ...rest.slice(k)];
  const idx = indices(p);
  const old = p.slides.slice();
  p.slides.splice(0, old.length, ...order.map((i) => old[i]!));
  const newIndex = order.map((_, j) => j);
  order.forEach((i, j) => (newIndex[i] = j));
  for (const [id, i] of idx) p.elements[id]!.x += (newIndex[i]! - i) * p.format.width;
}
