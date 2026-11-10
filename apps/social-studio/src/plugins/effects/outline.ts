import { colors, photoFrame } from '../../tokens';

type Pixels = Pick<ImageData, 'width' | 'height' | 'data'>;

/** Ab dieser Deckkraft (von 255) zählt ein Pixel als Inhalt, von dem aus die Kontur wächst. */
const SEED = 128;

/** Mittel der Alpha-Werte der vier Randpixelreihen unter 250/255: der Inhalt ist freigestellt (Kontur statt Rechteck). */
export function hasTransparentEdge({ width, height, data }: Pixels): boolean {
  let sum = 0;
  let n = 0;
  const add = (x: number, y: number) => {
    sum += data[(y * width + x) * 4 + 3]!;
    n++;
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    if (height > 1) add(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    add(0, y);
    if (width > 1) add(width - 1, y);
  }
  return sum / n < 250;
}

/**
 * Quadrierte Distanz zum nächsten Inhaltspunkt einer Zeile (Felzenszwalb/Huttenlocher, untere Hülle der Parabeln), in O(n).
 * `f` = quadrierte Distanz aus dem Spaltendurchgang, `v`/`z` sind Arbeitsspeicher.
 */
function rowDistance(f: Float32Array, n: number, d: Float32Array, v: Int32Array, z: Float32Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) ** 2 + f[v[k]!]!;
  }
}

/**
 * Deckkraft der Kontur, `w` px Rand ringsum: Ausgabe (width + 2·⌈w⌉) × (height + 2·⌈w⌉), ein Byte je Pixel.
 * Deckender Rand (`!hasTransparentEdge`): volles Rechteck mit scharfen Ecken. Sonst runde Erweiterung um `w`: exakte euklidische
 * Distanz zum Inhalt (statt versetzt gestempelter Masken: keine Lücken bei dünnen Formen, ohne Canvas prüfbar), Kante geglättet.
 */
export function outlineAlpha(src: Pixels, w: number): Uint8ClampedArray {
  const p = Math.ceil(w);
  const W = src.width + 2 * p;
  const H = src.height + 2 * p;
  const out = new Uint8ClampedArray(W * H);
  if (!hasTransparentEdge(src)) return out.fill(255);
  // Spalten: Distanz zum nächsten Inhaltspixel, gekappt (weiter weg als w + 2 ist ohnehin leer, hält die Zahlen endlich)
  const cap = p + 2;
  const g = new Float32Array(W * H);
  for (let x = 0; x < W; x++) {
    let last = -cap;
    for (let y = 0; y < H; y++) {
      const sx = x - p, sy = y - p;
      const seed = sx >= 0 && sx < src.width && sy >= 0 && sy < src.height && src.data[(sy * src.width + sx) * 4 + 3]! >= SEED;
      if (seed) last = y;
      g[y * W + x] = Math.min(cap, y - last);
    }
    last = H - 1 + cap;
    for (let y = H - 1; y >= 0; y--) {
      if (g[y * W + x] === 0) last = y;
      g[y * W + x] = Math.min(g[y * W + x]!, last - y) ** 2;
    }
  }
  // Zeilen: quadrierte euklidische Distanz, daraus die geglättete Deckkraft der Kontur
  const n = Math.max(W, H);
  const f = new Float32Array(n), d = new Float32Array(n), z = new Float32Array(n + 1), v = new Int32Array(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x]!;
    rowDistance(f, W, d, v, z);
    for (let x = 0; x < W; x++) {
      const sx = x - p, sy = y - p;
      const own = sx >= 0 && sx < src.width && sy >= 0 && sy < src.height ? src.data[(sy * src.width + sx) * 4 + 3]! : 0;
      out[y * W + x] = Math.max(own, Math.min(1, Math.max(0, w + 1 - Math.sqrt(d[x]!))) * 255);
    }
  }
  return out;
}

/** Warmweisse Silhouette von `source`, um `width` px erweitert, mit `width` px Rand ringsum (Rechteck bei deckendem Rand). */
export function outlineCanvas(source: HTMLCanvasElement, width: number): HTMLCanvasElement {
  return paintOutline(source.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, source.width, source.height), width);
}

/** Wie `outlineCanvas`, aus schon gelesenen Pixeln (der Aufrufer prüft damit vorher den Rand). */
export function paintOutline(src: ImageData, width: number): HTMLCanvasElement {
  const alpha = outlineAlpha(src, width);
  const p = Math.ceil(width);
  const c = document.createElement('canvas');
  c.width = src.width + 2 * p;
  c.height = src.height + 2 * p;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(colors[photoFrame.color].slice(i, i + 2), 16));
  const px = img.data;
  for (let i = 0, j = 0; i < alpha.length; i++, j += 4) {
    px[j] = r!;
    px[j + 1] = g!;
    px[j + 2] = b!;
    px[j + 3] = alpha[i]!;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
