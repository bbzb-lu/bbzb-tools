import type { Effect } from '../../core/types';
import { bildlook, imageAdjust } from '../../tokens';

export type Adjust = { brightness: number; contrast: number; saturation: number; warmth: number };
export const NEUTRAL: Adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };

const lumOf = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
/** Sättigung um den Faktor k (1 = gleich) relativ zur Luminanz; schreibt in d (Uint8ClampedArray begrenzt auf 0..255). */
function saturate(d: Uint8ClampedArray, i: number, r: number, g: number, b: number, k: number) {
  const l = lumOf(r, g, b);
  d[i] = l + (r - l) * k;
  d[i + 1] = l + (g - l) * k;
  d[i + 2] = l + (b - l) * k;
}

/**
 * BBZB-Look aus den Tokens, Annäherung an Photoshop: Fotofilter als Farbfilter (multiplizieren mit Dichte, Schwarz bleibt
 * Schwarz), Luminanz wiederherstellen, dann Dynamik (wirkt stärker auf wenig gesättigte Farben) und Sättigung.
 */
export function lookPixels(d: Uint8ClampedArray): void {
  const { color, density, preserveLuminosity } = bildlook.photoFilter;
  const f = [1, 3, 5].map((i) => 1 - density + (density * parseInt(color.slice(i, i + 2), 16)) / 255);
  const vib = bildlook.vibrance / 100;
  const sat = 1 + bildlook.saturation / 100;
  for (let i = 0; i < d.length; i += 4) {
    const l0 = lumOf(d[i]!, d[i + 1]!, d[i + 2]!);
    let r = d[i]! * f[0]!, g = d[i + 1]! * f[1]!, b = d[i + 2]! * f[2]!;
    if (preserveLuminosity) {
      const dl = l0 - lumOf(r, g, b);
      r += dl;
      g += dl;
      b += dl;
    }
    const s = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    saturate(d, i, r, g, b, (1 + vib * (1 - s)) * sat);
  }
}

/** Bildregler, je −50..+50; Wirkung am Anschlag aus `imageAdjust.strength`. */
export function adjustPixels(d: Uint8ClampedArray, a: Adjust): void {
  const k = (v: number, s: number) => (v / imageAdjust.max) * s;
  const { strength } = imageAdjust;
  const bright = 1 + k(a.brightness, strength.brightness), contrast = 1 + k(a.contrast, strength.contrast);
  const sat = 1 + k(a.saturation, strength.saturation);
  const warmR = 1 + k(a.warmth, strength.warmth), warmB = 1 - k(a.warmth, strength.warmth);
  const tone = (v: number) => (v * bright - 128) * contrast + 128;
  for (let i = 0; i < d.length; i += 4) {
    saturate(d, i, tone(d[i]!) * warmR, tone(d[i + 1]!), tone(d[i + 2]!) * warmB, sat);
  }
}

/** Pixel der ganzen Canvas bearbeiten (einmal je Eingabe, nie pro Frame). */
function onPixels(ctx: CanvasRenderingContext2D, fn: (d: Uint8ClampedArray) => void) {
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  fn(img.data);
  ctx.putImageData(img, 0, 0);
}

export const lookEffect: Effect<{ on: boolean }> = {
  id: 'look',
  label: 'BBZB-Look',
  active: (p) => p.on,
  apply: (ctx) => onPixels(ctx, lookPixels),
};

export const adjustEffect: Effect<Adjust> = {
  id: 'adjust',
  label: 'Bildregler',
  active: (p) => Object.values(p).some((v) => v !== 0),
  apply: (ctx, p) => onPixels(ctx, (d) => adjustPixels(d, p)),
};
