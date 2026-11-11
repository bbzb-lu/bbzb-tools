import { elementBounds } from '../model/geometry';
import type { Project, Rect } from '../model/types';
import { margin, safeZones } from '../tokens';

/** Einrasten ab diesem Abstand in Bildschirm-px, unabhängig vom Zoom. */
export const SNAP_PX = 6;

/** Kandidaten in globalen Koordinaten: senkrechte Linien (x) und waagrechte (y). */
export interface SnapLines {
  x: number[];
  y: number[];
}
export interface Guides {
  x: number | null;
  y: number | null;
}
type Point = { x: number; y: number };
/** zones: Sicherheitszonen sind eingeblendet (nur dann rasten ihre Ränder ein: unsichtbare Linien würden verwirren). */
export interface SnapOptions {
  zones: boolean;
}
export type SnapSource = (p: Project, movingIds: string[], o: SnapOptions) => SnapLines;

function slideLines(p: Project): SnapLines {
  const { width: w, height: h } = p.format;
  const x: number[] = [];
  for (let i = 0; i <= p.slides.length; i++) x.push(i * w); // Ränder und Nähte
  for (let i = 0; i < p.slides.length; i++) x.push(i * w + margin, i * w + w / 2, (i + 1) * w - margin);
  return { x, y: [0, margin, h / 2, h - margin, h] };
}

function elementLines(p: Project, movingIds: string[]): SnapLines {
  const lines: SnapLines = { x: [], y: [] };
  for (const id of p.order) {
    const e = p.elements[id];
    if (!e || movingIds.includes(id) || !e.visible) continue;
    const b = elementBounds(e);
    lines.x.push(b.x, b.x + b.width / 2, b.x + b.width);
    lines.y.push(b.y, b.y + b.height / 2, b.y + b.height);
  }
  return lines;
}

function zoneLines(p: Project, _movingIds: string[], o: SnapOptions): SnapLines {
  const z = safeZones[p.format.id];
  const lines: SnapLines = { x: [], y: [] };
  if (!o.zones || !z) return lines;
  const { width: w, height: h } = p.format;
  for (let i = 0; i < p.slides.length; i++) {
    if (z.left) lines.x.push(i * w + z.left);
    if (z.right) lines.x.push((i + 1) * w - z.right);
  }
  if (z.top) lines.y.push(z.top);
  if (z.bottom) lines.y.push(h - z.bottom);
  return lines;
}

/** Erweiterbar: weitere Quellen hier anhängen. */
export const snapSources: SnapSource[] = [slideLines, elementLines, zoneLines];

/** Einmal pro Geste berechnen, nicht pro Mausbewegung. */
export function snapLines(p: Project, movingIds: string[], o: SnapOptions = { zones: false }): SnapLines {
  const all: SnapLines = { x: [], y: [] };
  for (const source of snapSources) {
    const l = source(p, movingIds, o);
    all.x.push(...l.x);
    all.y.push(...l.y);
  }
  return all;
}

/** Nächste Linie zu einem der Werte, höchstens t entfernt. */
function nearest(values: number[], lines: number[], t: number): { d: number; line: number } | null {
  let best: { d: number; line: number } | null = null;
  for (const v of values)
    for (const line of lines) {
      const d = line - v;
      if (Math.abs(d) <= t && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line };
    }
  return best;
}

/** Ziehen: Versatz, damit Kante oder Mitte der (gedrehten) Hülle auf einer Linie liegt. scale = Bildschirm-px pro Welt-px. */
export function snapMove(box: Rect, lines: SnapLines, scale: number): { dx: number; dy: number; guides: Guides } {
  const t = SNAP_PX / scale;
  const sx = nearest([box.x, box.x + box.width / 2, box.x + box.width], lines.x, t);
  const sy = nearest([box.y, box.y + box.height / 2, box.y + box.height], lines.y, t);
  return { dx: sx?.d ?? 0, dy: sy?.d ?? 0, guides: { x: sx?.line ?? null, y: sy?.line ?? null } };
}

const onEdge = (v: number, start: number, size: number) => Math.abs(v - start) < 1e-3 || Math.abs(v - start - size) < 1e-3;

/**
 * Skalieren: neue Position eines Anfassers. Eingerastet wird nur in den Achsen, in denen der Anfasser (from) auf der
 * gedrehten Hülle bbox liegt. Mit festem Punkt (Seitenverhältnis) bleibt er auf der Geraden fixed → from.
 */
export function snapAnchor(from: Point, to: Point, bbox: Rect, fixed: Point | null, lines: SnapLines, scale: number): { point: Point; guides: Guides } {
  const t = SNAP_PX / scale;
  const onX = onEdge(from.x, bbox.x, bbox.width);
  const onY = onEdge(from.y, bbox.y, bbox.height);
  if (!fixed) {
    const sx = onX ? nearest([to.x], lines.x, t) : null;
    const sy = onY ? nearest([to.y], lines.y, t) : null;
    return { point: { x: to.x + (sx?.d ?? 0), y: to.y + (sy?.d ?? 0) }, guides: { x: sx?.line ?? null, y: sy?.line ?? null } };
  }
  const u = { x: from.x - fixed.x, y: from.y - fixed.y };
  const len2 = u.x * u.x + u.y * u.y;
  if (len2 === 0) return { point: to, guides: { x: null, y: null } };
  const k = ((to.x - fixed.x) * u.x + (to.y - fixed.y) * u.y) / len2;
  const pt = { x: fixed.x + k * u.x, y: fixed.y + k * u.y };
  const sx = onX && u.x !== 0 ? nearest([pt.x], lines.x, t) : null;
  const sy = onY && u.y !== 0 ? nearest([pt.y], lines.y, t) : null;
  if (sx && (!sy || Math.abs(sx.d) <= Math.abs(sy.d))) {
    const m = sx.d / u.x;
    return { point: { x: pt.x + m * u.x, y: pt.y + m * u.y }, guides: { x: sx.line, y: null } };
  }
  if (sy) {
    const m = sy.d / u.y;
    return { point: { x: pt.x + m * u.x, y: pt.y + m * u.y }, guides: { x: null, y: sy.line } };
  }
  return { point: pt, guides: { x: null, y: null } };
}
