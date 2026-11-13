import { iconStyle } from '../tokens';
import { iconSvg, type IconRef } from './catalog';

/** Icon auf Inhaltsgrösse zugeschnitten, bereit zum Einpassen. `effects`: Schein und Relief gelten für Strichicons und Bilder mit durchsichtigen Flächen, nicht für deckende Fotos. */
export type Prepared = { src: CanvasImageSource; w: number; h: number; effects: boolean };

export class ImageError extends Error {}

const cache = new Map<string, Promise<Prepared>>();

function trim(c: HTMLCanvasElement, effects: boolean): Prepared {
  const { width: W, height: H } = c;
  const d = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]! > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new ImageError('Das Icon ist leer.');
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { src: out, w: out.width, h: out.height, effects };
}

/** Mindestens 1 % der Pixel mit Alpha unter 250. */
export function hasTransparentPixels(d: Uint8ClampedArray): boolean {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]! < 250) n++;
  return n > 0 && n * 100 >= d.length / 4;
}

/** Auf höchstens 256 px verkleinert prüfen. */
export function hasTransparency(src: CanvasImageSource, w: number, h: number): boolean {
  const k = Math.min(1, 256 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, 0, 0, c.width, c.height);
  return hasTransparentPixels(x.getImageData(0, 0, c.width, c.height).data);
}

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Icon konnte nicht gezeichnet werden.'));
    i.src = src;
  });
}

export function prepareIcon(ref: IconRef, color: string): Promise<Prepared> {
  if (ref.kind === 'image') {
    const { bitmap: b } = ref;
    if (!hasTransparency(b, b.width, b.height)) return Promise.resolve({ src: b, w: b.width, h: b.height, effects: false });
    const c = document.createElement('canvas');
    c.width = b.width;
    c.height = b.height;
    c.getContext('2d')!.drawImage(b, 0, 0);
    return Promise.resolve(trim(c, true));
  }
  const key = `${ref.kind}:${ref.name}:${color}`;
  let p = cache.get(key);
  if (!p) {
    p = load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(ref, color, iconStyle.raster))}`).then((img) => {
      const c = document.createElement('canvas');
      c.width = c.height = iconStyle.raster;
      c.getContext('2d')!.drawImage(img, 0, 0, iconStyle.raster, iconStyle.raster);
      return trim(c, true);
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** SVG: createImageBitmap kann in Chromium keine SVG-Blobs, darum über ein Bild in 1024 px zeichnen (Vektor, bleibt scharf). */
async function svgBitmap(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 300;
    const h = img.naturalHeight || 150;
    const k = 1024 / Math.max(w, h);
    const c = new OffscreenCanvas(Math.round(w * k), Math.round(h * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await createImageBitmap(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Eigenes Bild einlesen (bleibt im Browser). Wirft ImageError mit Text für die Anzeige. */
export async function readImage(file: File): Promise<ImageBitmap> {
  if (!IMAGE_TYPES.includes(file.type)) throw new ImageError('Dieses Format geht nicht. Nimm PNG, JPG, WebP oder SVG.');
  try {
    const bmp = file.type === 'image/svg+xml' ? await svgBitmap(file) : await createImageBitmap(file);
    const k = Math.min(1, iconStyle.maxImage / Math.max(bmp.width, bmp.height));
    if (k === 1) return bmp;
    const out = await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * k), resizeHeight: Math.round(bmp.height * k), resizeQuality: 'high' });
    bmp.close();
    return out;
  } catch {
    throw new ImageError('Das Bild liess sich nicht öffnen. Versuche eine andere Datei.');
  }
}
