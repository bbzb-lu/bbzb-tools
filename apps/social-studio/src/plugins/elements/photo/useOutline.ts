import Konva from 'konva';
import { useEffect, useState } from 'react';
import { effectFailed } from '../../../canvas/effects';
import { photoFrame } from '../../../tokens';
import { hasTransparentEdge, paintOutline } from '../../effects/outline';

/** Rahmen aussen: Rechteck (deckender Rand) oder Kontur-Canvas, Lage in Box-Koordinaten (ragt um die Rahmenbreite hinaus). */
export type Ring = { rect: true } | { rect: false; canvas: HTMLCanvasElement; x: number; y: number; width: number; height: number };
export const RECT_RING: Ring = { rect: true };

// Längste Seite der Rechen-Canvas (Bildbereich in Slide-Pixeln): eine Slide ist höchstens 1920 px, grössere Boxen rechnen verkleinert.
const MAX = 2048;

/** Einmal je Schlüssel: Inhalt zeichnen, Rand prüfen, bei Freistellern die Kontur rechnen. */
function computeRing(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Ring {
  const s = Math.min(1, MAX / Math.max(width, height));
  const src = document.createElement('canvas');
  src.width = Math.max(1, Math.round(width * s));
  src.height = Math.max(1, Math.round(height * s));
  try {
    const ctx = src.getContext('2d', { willReadFrequently: true })!;
    draw(ctx);
    const data = ctx.getImageData(0, 0, src.width, src.height);
    if (!hasTransparentEdge(data)) return RECT_RING;
    const w = photoFrame.inset.left * s;
    const canvas = paintOutline(data, w);
    const p = Math.ceil(w);
    const sx = src.width / width;
    const sy = src.height / height;
    return { rect: false, canvas, x: -p / sx, y: -p / sy, width: canvas.width / sx, height: canvas.height / sy };
  } finally {
    Konva.Util.releaseCanvas(src);
  }
}

/**
 * Rahmen-Kontur eines Fotos, gerechnet nur bei neuem `key` (Bild, Ausschnitt, Spiegeln, Box), nie pro Frame; der Export wartet,
 * solange `pending`. `hold` (Ausschnittmodus): nicht neu rechnen, die letzte Kontur bleibt stehen. `key` null: kein Rahmen aussen.
 */
export function useOutline(key: string | null, hold: boolean, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const [state, setState] = useState<{ key: string; ring: Ring }>();
  const current = state?.key === key;
  useEffect(() => {
    if (current || hold || (key === null && !state)) return;
    let live = true;
    // ein Bild abwarten: mehrere Änderungen im selben Bild rechnen nur einmal
    const frame = requestAnimationFrame(() => {
      if (key === null) return setState(undefined);
      let ring = RECT_RING;
      try {
        ring = computeRing(width, height, draw);
      } catch (e) {
        // Rechteck statt Kontur: sichtbar falsch, aber nichts fehlt; die Meldung kommt einmal
        console.error(e);
        effectFailed();
      }
      if (live) setState({ key, ring });
      else if (!ring.rect) Konva.Util.releaseCanvas(ring.canvas);
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
    // `key` enthält alle Eingaben von draw, width und height
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current, hold]);
  // Ersetzte oder verworfene Kontur freigeben (bis 2048² × 4 B)
  useEffect(() => {
    const ring = state?.ring;
    return () => void (ring && !ring.rect && Konva.Util.releaseCanvas(ring.canvas));
  }, [state]);
  // Bis die neue Kontur da ist, bleibt die alte stehen (kein Aufblitzen); der Export wartet trotzdem.
  return { ring: key === null ? undefined : state?.ring, pending: key !== null && !hold && !current };
}
