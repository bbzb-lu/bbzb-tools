import type { Crop, Rect } from './types';

type Size = { width: number; height: number };

export function coverCrop(frame: Size, img: Size): Crop {
  const scale = Math.max(frame.width / img.width, frame.height / img.height);
  return { x: (frame.width - img.width * scale) / 2, y: (frame.height - img.height * scale) / 2, scale };
}

/** Rahmen fürs Einfügen: Bild im Originalformat, so breit wie die Slide (höchstens so hoch), zentriert. */
export function insertFrame(slide: Rect, img: Size): Rect {
  let w = slide.width;
  let h = (slide.width * img.height) / img.width;
  if (h > slide.height) {
    h = slide.height;
    w = (slide.height * img.width) / img.height;
  }
  return { x: slide.x + (slide.width - w) / 2, y: slide.y + (slide.height - h) / 2, width: w, height: h };
}

/** Ausschnitt `c` einer Box als Rechteck im Bild; `kx`, `ky` rechnen von Asset-Pixeln auf ein kleineres Bild um (Videobild). */
export const sourceRect = (c: Crop, box: Size, kx = 1, ky = kx) => ({
  x: (-c.x / c.scale) * kx,
  y: (-c.y / c.scale) * ky,
  width: (box.width / c.scale) * kx,
  height: (box.height / c.scale) * ky,
});

export function clampCrop(frame: Size, img: Size, crop: Crop): Crop {
  const scale = Math.max(crop.scale, coverCrop(frame, img).scale);
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    x: clamp(crop.x, frame.width - img.width * scale),
    y: clamp(crop.y, frame.height - img.height * scale),
    scale,
  };
}

/** Box proportional skaliert (Ecke)? Rundung bis 1e-3 zählt mit. */
export const proportional = (prev: Size, next: Size) => Math.abs(next.width / prev.width - next.height / prev.height) <= 1e-3;

/**
 * Ecke ziehen (proportional): Inhalt wächst mit, Ausschnitt bleibt gleich. Frei: Zoom bleibt (mindestens deckend), Bild bleibt zentriert.
 * `keep`: die Geste war proportional, auch wenn der Bildbereich es nicht ist (alter Innenrahmen: feste Ränder um das Bild).
 */
export function resizeCrop(prev: Size, next: Size, img: Size, crop: Crop, keep = proportional(prev, next)): Crop {
  if (!keep) {
    const scale = Math.max(crop.scale, coverCrop(next, img).scale);
    return { x: (next.width - img.width * scale) / 2, y: (next.height - img.height * scale) / 2, scale };
  }
  // erst multiplizieren, dann teilen: 0.6 × 1500 / 1000 ergibt genau 0.9, 0.6 × 1.5 nicht
  const s = (v: number) => (v * next.width) / prev.width;
  return clampCrop(next, img, { x: s(crop.x), y: s(crop.y), scale: s(crop.scale) });
}
