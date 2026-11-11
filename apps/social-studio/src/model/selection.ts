import { elementBounds, elementsOnSlide, intersects } from './geometry';
import type { Element, Project, Rect } from './types';

/** Sichtbar und nicht gesperrt: was ein Aufziehrahmen oder «Alles auswählen» erfasst. */
export function selectableOnSlide(p: Project, slide: number): string[] {
  return elementsOnSlide(p, slide).filter((id) => !p.elements[id]!.locked && p.elements[id]!.visible);
}

/** Gesperrte oder ausgeblendete Elemente der Slide (auch hereinragende), oberstes zuerst: per Klick auf der Leinwand nicht erreichbar, daher im Rechtsklickmenü. */
export function lockedOrHiddenOnSlide(p: Project, slide: number): Element[] {
  return elementsOnSlide(p, slide)
    .map((id) => p.elements[id]!)
    .filter((e) => e.locked || !e.visible)
    .reverse();
}

export function idsInRect(p: Project, slide: number, rect: Rect): string[] {
  return selectableOnSlide(p, slide).filter((id) => intersects(elementBounds(p.elements[id]!), rect));
}

export function unionBounds(els: Element[]): Rect {
  const bs = els.map(elementBounds);
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
}
