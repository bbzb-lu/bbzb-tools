import { loadUrlImage } from '../../../canvas/images';

// shortcut: längste Seite 1024 px reicht für Scribbles bis Slide-Breite; bei unscharfen Riesen-Scribbles erhöhen (Speicher!)
const MAX = 1024;
const cache = new Map<string, Promise<HTMLCanvasElement>>();

/**
 * Vollflächig in der Farbe `hex` (aufgelöste Palettenfarbe), die Transparenz der Quelle bleibt. Einmal je Bild und Farbe gerechnet;
 * Editor und Export (Klon der Ebene) zeichnen denselben Canvas, also sehen beide gleich aus.
 */
export function tinted(url: string, hex: string): Promise<HTMLCanvasElement> {
  const key = `${hex} ${url}`;
  let p = cache.get(key);
  if (!p) {
    const work = loadUrlImage(url).then((img) => {
      const f = MAX / Math.max(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * f));
      c.height = Math.max(1, Math.round(img.naturalHeight * f));
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, c.width, c.height);
      return c;
    });
    work.catch(() => cache.get(key) === work && cache.delete(key));
    cache.set(key, (p = work));
  }
  return p;
}
