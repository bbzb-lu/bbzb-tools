import Konva from 'konva';
import { photoFrame } from '../../../tokens';
import { paintOutline } from '../../effects/outline';
import type { Ring } from './useOutline';

/** Name der Kontur-Bildfläche (Rahmen aussen um Freisteller): PhotoNode richtet sie beim Skalieren live neu aus. */
export const RING_IMAGE = 'photo-ring';

/** Längste Seite der Live-Rechen-Canvas: klein genug, dass jede Mausbewegung die Kontur neu rechnen darf. */
const PREVIEW = 320;
/** Längste Seite der Kopie des Bildes für die Geste: die Live-Rechnung zeichnet daraus, nicht aus dem 4096-px-Original. */
const SOURCE = 640;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
type Args = { draw: Draw; box: { width: number; height: number }; sx: number; sy: number };
const live = new WeakMap<Konva.Image, { canvas: HTMLCanvasElement; at: number; cost: number; frame?: number; latest?: Args }>();

/** Verkleinerte Kopie von `img` (Foto, oder Foto mit Maske) für die Dauer einer Geste; `k` = Massstab gegenüber dem Original. Null, wenn nichts zu sparen ist. */
export function liteSource(img: HTMLImageElement | HTMLCanvasElement): { canvas: HTMLCanvasElement; k: number } | null {
  const [w, h] = img instanceof HTMLImageElement ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height];
  const k = SOURCE / Math.max(w, h);
  if (!(k < 1)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, k };
}

function paint(node: Konva.Image, { draw, box, sx, sy }: Args, final: boolean): void {
  const prev = live.get(node);
  const t0 = performance.now();
  const vis = { width: box.width * sx, height: box.height * sy }; // sichtbare Grösse in Slide-Pixeln
  const s = Math.min(1, PREVIEW / Math.max(vis.width, vis.height));
  const src = document.createElement('canvas');
  src.width = Math.max(1, Math.round(vis.width * s));
  src.height = Math.max(1, Math.round(vis.height * s));
  const ctx = src.getContext('2d', { willReadFrequently: true })!;
  draw(ctx, src.width, src.height);
  const canvas = paintOutline(ctx.getImageData(0, 0, src.width, src.height), photoFrame.inset.left * s);
  const p = (canvas.width - src.width) / 2;
  const rx = vis.width / src.width;
  const ry = vis.height / src.height;
  // Knoten noch um (sx, sy) skaliert: gegenrechnen; nach der Geste (final, Skalierung 1) in Slide-Pixeln
  const [dx, dy] = final ? [1, 1] : [sx, sy];
  node.setAttrs({
    image: canvas,
    x: (-p * rx) / dx,
    y: (-p * ry) / dy,
    width: (canvas.width * rx) / dx,
    height: (canvas.height * ry) / dy,
    shadowOffsetY: photoFrame.shadow.offsetY / dy, // Konva skaliert den Schattenversatz mit dem Knoten
  });
  Konva.Util.releaseCanvas(src);
  if (prev) Konva.Util.releaseCanvas(prev.canvas);
  live.set(node, { canvas, at: performance.now(), cost: performance.now() - t0 });
}

/**
 * Kontur in echter Breite um das skalierte Bild: Inhalt in Vorschau-Auflösung zeichnen, Kontur rechnen, auf (sx, sy) gegenrechnen.
 * Rechnet nur, wenn die letzte Rechnung länger als das Doppelte ihrer Dauer zurückliegt (höchstens ein Drittel der Zeit, auch
 * auf schwachen Geräten); eine ausgelassene Bewegung holt ein Bild später nach, damit die Kontur im Stillstand stimmt.
 * Kein Store, kein React.
 */
export function liveRing(node: Konva.Image, args: Args): void {
  const prev = live.get(node);
  if (prev && performance.now() - prev.at < prev.cost * 2) {
    prev.latest = args;
    prev.frame ??= requestAnimationFrame(function again() {
      const cur = live.get(node);
      if (!cur?.latest) return;
      if (performance.now() - cur.at < cur.cost * 2) return void (cur.frame = requestAnimationFrame(again));
      const a = cur.latest;
      cur.latest = cur.frame = undefined;
      paint(node, a, false);
    });
    return;
  }
  if (prev?.frame !== undefined) cancelAnimationFrame(prev.frame);
  paint(node, args, false);
}

/** Ende der Geste, Knoten schon auf Skalierung 1: Kontur einmal in Slide-Pixeln neu setzen, bis die gerechnete da ist. */
export function finishRing(node: Konva.Image, args: Args): void {
  const prev = live.get(node);
  if (prev?.frame !== undefined) cancelAnimationFrame(prev.frame);
  paint(node, args, true);
}

/** Knoten wird abgebaut: offene Rechnung abbrechen, Live-Canvas freigeben. */
export function cancelRing(node: Konva.Image): void {
  const prev = live.get(node);
  if (!prev) return;
  if (prev.frame !== undefined) cancelAnimationFrame(prev.frame);
  Konva.Util.releaseCanvas(prev.canvas);
  live.delete(node);
}

/** Zurück auf die gerechnete Kontur aus den Props (neue Kontur da, oder Geste ohne Änderung). */
export function resetRing(node: Konva.Image, ring: Ring | undefined): void {
  const prev = live.get(node);
  if (!prev || !ring || ring.rect) return;
  if (prev.frame !== undefined) cancelAnimationFrame(prev.frame);
  node.setAttrs({ image: ring.canvas, x: ring.x, y: ring.y, width: ring.width, height: ring.height, shadowOffsetY: photoFrame.shadow.offsetY });
  Konva.Util.releaseCanvas(prev.canvas);
  live.delete(node);
}
