import type { Element, Project, Rect } from './types';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Punkt (dx, dy) relativ zu (x, y), gedreht wie Konva (y nach unten, positiv = im Uhrzeigersinn). */
function rotated(el: Element, dx: number, dy: number) {
  const r = rad(el.rotation);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: el.x + c * dx - s * dy, y: el.y + s * dx + c * dy };
}

export function elementCenter(el: Element): { x: number; y: number } {
  return rotated(el, el.width / 2, el.height / 2);
}

export function elementBounds(el: Element): Rect {
  const pts = [
    rotated(el, 0, 0),
    rotated(el, el.width, 0),
    rotated(el, el.width, el.height),
    rotated(el, 0, el.height),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Liegt der Punkt (globale Koordinaten) im gedrehten Rechteck des Elements? */
export function containsPoint(el: Element, pt: { x: number; y: number }): boolean {
  const r = rad(-el.rotation);
  const dx = pt.x - el.x;
  const dy = pt.y - el.y;
  const lx = Math.cos(r) * dx - Math.sin(r) * dy;
  const ly = Math.sin(r) * dx + Math.cos(r) * dy;
  return lx >= 0 && lx <= el.width && ly >= 0 && ly <= el.height;
}

export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function slideRect(p: Project, index: number): Rect {
  const { width, height } = p.format;
  return { x: index * width, y: 0, width, height };
}

/** Slide unter der Mitte; genau auf der Naht die linke (Ruling R5: dort beginnt ein Layout über zwei Slides). */
export function slideIndexOf(p: Project, el: Element): number {
  const i = Math.ceil(elementCenter(el).x / p.format.width) - 1;
  return Math.min(Math.max(i, 0), p.slides.length - 1);
}

/** Elemente, die die Slide berühren, plus die ganz ausserhalb, deren Mitte zu ihr gehört (sonst wären sie unerreichbar). */
export function elementsOnSlide(p: Project, index: number): string[] {
  const s = slideRect(p, index);
  return p.order.filter((id) => {
    const e = p.elements[id];
    if (!e) return false;
    return intersects(elementBounds(e), s) || slideIndexOf(p, e) === index;
  });
}
