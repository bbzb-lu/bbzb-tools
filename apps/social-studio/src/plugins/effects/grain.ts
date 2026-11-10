import { loadUrlImage } from '../../canvas/images';
import { assetPacks } from '../../core/registries';
import type { Effect } from '../../core/types';
import { filmkorn } from '../../tokens';

const R = 8; // Radius des lokalen Mittels: trennt feines Korn (1 bis 2 px) von groben Flecken

/**
 * Auf Mittelgrau normalisieren: Graustufen mit Mittelwert 128, im Modus «overlay» neutral (keine Farbverschiebung, Helligkeit
 * bleibt im Mittel). Das feine Korn (Abweichung vom lokalen Mittel) wird um `gain` verstärkt, die groben Flecken bleiben.
 */
export function toMidGrey(data: Uint8ClampedArray, width: number, height: number, gain: number): void {
  const n = width * height;
  const lum = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += lum[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  // Summenfeld für das Kastenmittel in O(n)
  const w1 = width + 1;
  const sat = new Float64Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) sat[(y + 1) * w1 + x + 1] = sat[y * w1 + x + 1]! + (row += lum[y * width + x]!);
  }
  const shift = 128 - sum / n;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(height, y + R + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(width, x + R + 1);
      const local = (sat[y1 * w1 + x1]! - sat[y0 * w1 + x1]! - sat[y1 * w1 + x0]! + sat[y0 * w1 + x0]!) / ((y1 - y0) * (x1 - x0));
      const v = lum[y * width + x]!;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = local + gain * (v - local) + shift;
      data[i + 3] = 255;
    }
  }
}

let texture: Promise<HTMLCanvasElement> | undefined;
/** Einmal je Sitzung: Textur aus dem Markenpaket laden und normalisieren. */
function grainTexture(): Promise<HTMLCanvasElement> {
  if (!texture) {
    const url = assetPacks.all().flatMap((p) => p.assets).find((a) => a.id === filmkorn.textureId)?.url;
    texture = (url ? loadUrlImage(url) : Promise.reject(new Error(`Markenbild «${filmkorn.textureId}» fehlt`))).then((img) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      toMidGrey(data.data, c.width, c.height, filmkorn.contrast);
      ctx.putImageData(data, 0, 0);
      return c;
    });
    texture.catch(() => (texture = undefined));
  }
  return texture;
}

/** Filmkorn: Textur 1:1 in Slide-Pixeln gekachelt, Modus «overlay», nur auf dieser Canvas (also nur auf dem Element). */
export const grainEffect: Effect<{ opacity: number }> = {
  id: 'grain',
  label: 'Korn',
  active: (p) => p.opacity > 0,
  async apply(ctx, { opacity }, scale) {
    const pattern = ctx.createPattern(await grainTexture(), 'repeat')!;
    pattern.setTransform(new DOMMatrix().scale(scale));
    ctx.save();
    ctx.globalCompositeOperation = filmkorn.blend;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  },
};
