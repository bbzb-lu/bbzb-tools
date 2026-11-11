/** Reine Rechnung für Knob und RangeSlider (ohne React). */

/** Auf `step` runden (über den Kehrwert, wegen 0.1-Resten) und in [min, max] halten. */
export function snap(v: number, min: number, max: number, step = 1): number {
  const r = Math.round(v * (1 / step)) / (1 / step);
  return Math.min(max, Math.max(min, r));
}

/** Wert nach einer Taste, null bei fremden Tasten. Pfeile = ein Schritt, Bild auf/ab = zehn, Pos1/Ende = Rand. */
export function keyValue(key: string, v: number, min: number, max: number, step = 1): number | null {
  const d: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
  if (key === 'Home') return min;
  if (key === 'End') return max;
  return key in d ? snap(v + d[key]! * step, min, max, step) : null;
}

/** Drehregler: senkrechtes Ziehen. `px` Pixel über den ganzen Bereich; nach oben = grösser. */
export function dragValue(startValue: number, dy: number, min: number, max: number, step = 1, px = 150): number {
  return snap(startValue - (dy / px) * (max - min), min, max, step);
}

/** Zeigerwinkel des Drehreglers in Grad: min = −135°, max = +135°. */
export function knobAngle(v: number, min: number, max: number): number {
  return max > min ? -135 + (270 * (Math.min(max, Math.max(min, v)) - min)) / (max - min) : -135;
}

/** Neuer Bereich, wenn ein Griff auf `v` wandert: Start bleibt mindestens einen Schritt vor Ende. */
export function moveHandle(which: 'start' | 'end', v: number, start: number, end: number, min: number, max: number, step = 1): [number, number] {
  if (which === 'start') return [snap(Math.min(v, end - step), min, max, step), end];
  return [start, snap(Math.max(v, start + step), min, max, step)];
}
