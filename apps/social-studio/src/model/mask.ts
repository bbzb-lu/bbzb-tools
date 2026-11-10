import { mask as maskTokens } from '../tokens';
import { maskIdOf } from './elements';
import type { Crop, Project, Rect } from './types';

/**
 * Arbeitskopie einer Maske: ein Byte je Pixel, 255 = Foto sichtbar, 0 = ausgeblendet. Liegt im Pixelraum des Fotos
 * (auf `maskSize` verkleinert), darum gelten Ausschnitt, Spiegeln und Skalieren für Foto und Maske gleich.
 */
export interface Mask {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

type Size = { width: number; height: number };
type Point = { x: number; y: number };

export interface Brush {
  /** In Maskenpixeln (`maskScale` rechnet von Leinwandeinheiten um). */
  radius: number;
  /** 0 = weich bis in die Mitte, 1 = hart. */
  hardness: number;
  mode: 'hide' | 'show';
  /** Sichtbarer Ausschnitt in Maskenpixeln: nur Pixel, die ihn berühren, ändern sich (weggeschnittene Bildteile bleiben unberührt). */
  clip?: Rect;
}

/** Pixelgrenzen [x0, x1) × [y0, y1): Maske, geschnitten mit `clip` (angeschnittene Randpixel zählen mit). */
function limits(m: Size, clip?: Rect) {
  return {
    x0: Math.max(0, clip ? Math.floor(clip.x) : 0),
    y0: Math.max(0, clip ? Math.floor(clip.y) : 0),
    x1: Math.min(m.width, clip ? Math.ceil(clip.x + clip.width) : m.width),
    y1: Math.min(m.height, clip ? Math.ceil(clip.y + clip.height) : m.height),
  };
}

/** Auflösung der Maske für ein Foto: gleiches Seitenverhältnis, lange Seite höchstens `mask.maxSize`. */
export function maskSize(img: Size): Size {
  const f = Math.min(1, maskTokens.maxSize / Math.max(img.width, img.height));
  return { width: Math.max(1, Math.round(img.width * f)), height: Math.max(1, Math.round(img.height * f)) };
}

/** Alles sichtbar. */
export const newMask = (width: number, height: number): Mask => ({ width, height, data: new Uint8ClampedArray(width * height).fill(255) });

export function invertMask(m: Mask): void {
  for (let i = 0; i < m.data.length; i++) m.data[i] = 255 - m.data[i]!;
}

function stamp(m: Mask, cx: number, cy: number, b: Brush): void {
  const { radius: r, hardness: h } = b;
  const inner = r * Math.min(Math.max(h, 0), 1);
  const l = limits(m, b.clip);
  const x0 = Math.max(l.x0, Math.floor(cx - r));
  const x1 = Math.min(l.x1 - 1, Math.ceil(cx + r));
  const y0 = Math.max(l.y0, Math.floor(cy - r));
  const y1 = Math.min(l.y1 - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      const cov = d <= inner ? 1 : (r - d) / (r - inner);
      const i = y * m.width + x;
      // min/max statt Mischen: überlappende Stempel desselben Strichs summieren sich nicht auf
      m.data[i] = b.mode === 'hide' ? Math.min(m.data[i]!, Math.round(255 * (1 - cov))) : Math.max(m.data[i]!, Math.round(255 * cov));
    }
}

/** Strich entlang `points` (Maskenpixel, auch ausserhalb des Bildes): verändert nur Pixel im Bild und im Radius. */
export function paintStroke(m: Mask, points: Point[], b: Brush): void {
  if (!(b.radius > 0)) return;
  const step = Math.max(0.5, b.radius * maskTokens.spacing);
  points.forEach((p, i) => {
    stamp(m, p.x, p.y, b);
    const q = points[i + 1];
    if (!q) return;
    const n = Math.floor(Math.hypot(q.x - p.x, q.y - p.y) / step);
    for (let k = 1; k <= n; k++) stamp(m, p.x + ((q.x - p.x) * k) / (n + 1), p.y + ((q.y - p.y) * k) / (n + 1), b);
  });
}

/** Rechteck (Maskenpixel), in dem `paintStroke` mit diesen Punkten Pixel ändern kann, an Rand und `clip` begrenzt; null, wenn keines. */
export function strokeBounds(m: Mask, points: Point[], radius: number, clip?: Rect): Rect | null {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const l = limits(m, clip);
  const x0 = Math.max(l.x0, Math.floor(Math.min(...xs) - radius));
  const y0 = Math.max(l.y0, Math.floor(Math.min(...ys) - radius));
  const x1 = Math.min(l.x1, Math.ceil(Math.max(...xs) + radius) + 1);
  const y1 = Math.min(l.y1, Math.ceil(Math.max(...ys) + radius) + 1);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Kanten weich zeichnen: Boxfilter mit Radius `radius` (Pixel), Ränder zählen als fortgesetzt. Flächen bleiben, wie sie sind. */
export function softenMask(m: Mask, radius: number): void {
  const r = Math.round(radius);
  if (r < 1) return;
  const { width: w, height: h, data } = m;
  const tmp = new Float32Array(w * h);
  const pass = (src: ArrayLike<number>, dst: Float32Array | Uint8ClampedArray, len: number, count: number, stride: number, lineStride: number) => {
    for (let l = 0; l < count; l++) {
      const o = l * lineStride;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[o + Math.min(Math.max(k, 0), len - 1) * stride]!;
      for (let i = 0; i < len; i++) {
        dst[o + i * stride] = sum / (2 * r + 1);
        sum += src[o + Math.min(i + r + 1, len - 1) * stride]! - src[o + Math.max(i - r, 0) * stride]!;
      }
    }
  };
  pass(data, tmp, w, h, 1, w);
  pass(tmp, data, h, w, w, 1);
}

/** Maskenpixel je Leinwandeinheit (für Pinselradius): Maske zu Bild, Bild zu Box (`crop.scale`). */
export const maskScale = (img: Size, m: Size, crop: Crop): number => m.width / img.width / crop.scale;

/**
 * Leinwandpunkt (globale Koordinaten) in Maskenpixel. Spiegelt `PhotoNode`: Drehung um (x, y), Bildbereich `area`
 * in der Box, bei `flip.x` läuft die Bildachse von rechts, bei `flip.y` von unten, Bild an `crop.x/y` mit `crop.scale`.
 */
export function canvasToMask(box: Rect & { rotation: number }, area: Rect, crop: Crop, flip: { x: boolean; y: boolean }, img: Size, m: Size, pt: Point): Point {
  const r = (-box.rotation * Math.PI) / 180;
  const dx = pt.x - box.x;
  const dy = pt.y - box.y;
  const lx = Math.cos(r) * dx - Math.sin(r) * dy - area.x;
  const ly = Math.sin(r) * dx + Math.cos(r) * dy - area.y;
  const ax = flip.x ? area.width - lx : lx;
  const ay = flip.y ? area.height - ly : ly;
  const k = m.width / img.width;
  return { x: ((ax - crop.x) / crop.scale) * k, y: ((ay - crop.y) / crop.scale) * (m.height / img.height) };
}

/** Maskendateien, auf die Elemente des Projekts zeigen. */
export const maskIdsOf = (p: Project): Set<string> =>
  new Set(Object.values(p.elements).map(maskIdOf).filter((id): id is string => id !== undefined));
