import { slots, type Slot } from '../tokens';

/** Passt Inhalt der Grösse w×h in den Platz ein (contain, zentriert). Nie vergrössern über den Platz hinaus. */
export function fitRect(w: number, h: number, slot: Slot) {
  const s = slots[slot];
  const k = Math.min(s.w / w, s.h / h);
  const dw = w * k;
  const dh = h * k;
  return { x: s.cx - dw / 2, y: s.cy - dh / 2, w: dw, h: dh };
}
