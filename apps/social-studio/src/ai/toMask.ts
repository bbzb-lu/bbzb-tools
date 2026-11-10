import type { Mask } from '../model/mask';
import { cutout } from '../tokens';

type Size = { width: number; height: number };

/**
 * Alphakanal eines Modells bilinear auf die Maskengrösse des Fotos bringen. x und y werden getrennt skaliert: das Seitenverhältnis
 * der Eingabe muss schon das des Fotos sein (Zuschneiden oder Letterbox ist Sache des Aufrufers).
 */
export function maskFromAlpha(a: Size & { alpha: Uint8ClampedArray }, target: Size): Mask {
  const { width: w, height: h } = target;
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max(((y + 0.5) * a.height) / h - 0.5, 0), a.height - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, a.height - 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max(((x + 0.5) * a.width) / w - 0.5, 0), a.width - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, a.width - 1);
      const tx = fx - x0;
      const top = a.alpha[y0 * a.width + x0]! * (1 - tx) + a.alpha[y0 * a.width + x1]! * tx;
      const bot = a.alpha[y1 * a.width + x0]! * (1 - tx) + a.alpha[y1 * a.width + x1]! * tx;
      data[y * w + x] = top * (1 - ty) + bot * ty;
    }
  }
  return { width: w, height: h, data };
}

/**
 * Rohausgabe des Modells (side × side, Foto gequetscht) min-max auf 0..255 bringen. Bleibt quadratisch: `maskFromAlpha` skaliert
 * x und y getrennt und stellt so das Seitenverhältnis des Fotos wieder her (nur ein Resampling). Flache Ausgabe: alles 0.
 */
export function alphaFromModel(out: ArrayLike<number>, side: number): Size & { alpha: Uint8ClampedArray } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < side * side; i++) {
    min = Math.min(min, out[i]!);
    max = Math.max(max, out[i]!);
  }
  const alpha = new Uint8ClampedArray(side * side);
  if (max > min) for (let i = 0; i < alpha.length; i++) alpha[i] = ((out[i]! - min) / (max - min)) * 255;
  return { width: side, height: side, alpha };
}

/** Falsch, wenn fast nichts oder fast alles sichtbar ist: dann hat das Modell kein Motiv gefunden. */
export function hasSubject(m: Mask): boolean {
  let sum = 0;
  for (let i = 0; i < m.data.length; i++) sum += m.data[i]!;
  const cover = sum / 255 / m.data.length;
  return cover >= cutout.minCover && cover <= cutout.maxCover;
}
