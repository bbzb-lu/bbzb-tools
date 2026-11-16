import type { Rect } from '../../../model/types';

/**
 * Grösster senkrechter Streifen von `photo`, den keines der Rechtecke `covers` (Elemente darüber) bedeckt, im selben Koordinatenraum.
 * Bei gleich grossen Streifen der obere. Ist alles bedeckt, das ganze Foto.
 */
export function freeBand(photo: Rect, covers: Rect[]): { y: number; height: number } {
  const [top, bottom] = [photo.y, photo.y + photo.height];
  const spans = covers
    .filter((c) => c.x < photo.x + photo.width && c.x + c.width > photo.x)
    .map((c): [number, number] => [Math.max(top, c.y), Math.min(bottom, c.y + c.height)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let best = { y: top, height: 0 };
  let at = top;
  for (const [a, b] of [...spans, [bottom, bottom] as [number, number]]) {
    if (a - at > best.height) best = { y: at, height: a - at };
    at = Math.max(at, b);
  }
  return best.height > 0 ? best : { y: top, height: photo.height };
}
