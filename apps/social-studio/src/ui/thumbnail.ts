import { akzent, colors, type PaletteColor } from '../tokens';

/** Breite der Vorschau in px; reicht für die Kachel auch bei 150 % Windows-Skalierung. */
const SIZE = 160;
// shortcut: Object-URLs der Vorschauen werden nie freigegeben (wenige kB je Bild); bei vielen Sticker-Paketen aufräumen
const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/**
 * Bild mit höchstens SIZE px Breite. Gebündelte Dateien (gleicher Ursprung) dekodiert und verkleinert der Browser
 * neben dem Hauptthread, sonst ruckelt das Ziehen auf schwachen Geräten (Scribbles über 2000 px). SVGs laufen über ein
 * Image: createImageBitmap kann SVG-Blobs nicht dekodieren, und kleine SVGs sind data:-URIs, die connect-src 'self'
 * nicht holen darf. Vektoren sind ohnehin billig.
 */
async function smallImage(url: string): Promise<ImageBitmap | HTMLCanvasElement> {
  if (!url.startsWith('data:') && !/\.svg([?#]|$)/i.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Vorschau ${res.status}`);
    return createImageBitmap(await res.blob(), { resizeWidth: SIZE, resizeQuality: 'high' });
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  const f = SIZE / Math.max(img.naturalWidth, 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * f));
  c.height = Math.max(1, Math.round(img.naturalHeight * f));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * Kleine Vorschau in der Tokenfarbe als Object-URL («akzent» in Orange, wie der Modus «fix»). Nacheinander gerechnet, damit auf schwachen Geräten nie mehrere
 * grosse Scribbles gleichzeitig dekodiert im Speicher liegen; das grosse Bild bleibt danach nicht im Cache.
 */
export function thumbnail(url: string, color: PaletteColor): Promise<string> {
  const key = `${color} ${url}`;
  let p = cache.get(key);
  if (!p) {
    // Vektoren sind billig und warten nicht auf die PNG-Warteschlange (sonst brauchen 120 Treffer hinter 18 Scribbles Sekunden).
    const vector = url.startsWith('data:') || /\.svg([?#]|$)/i.test(url);
    const work = (vector ? Promise.resolve() : queue).then(async () => {
      const src = await smallImage(url);
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      if (src instanceof ImageBitmap) src.close();
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color === akzent ? colors.orange : colors[color];
      ctx.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r));
      if (!blob) throw new Error('Vorschau leer');
      return URL.createObjectURL(blob);
    });
    if (!vector) queue = work.catch(() => {});
    work.catch(() => cache.get(key) === work && cache.delete(key));
    cache.set(key, (p = work));
  }
  return p;
}
