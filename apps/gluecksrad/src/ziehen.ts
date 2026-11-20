export const MAX_OPTIONEN = 100;

/** Eine Option pro Zeile: getrimmt, ohne Leerzeilen und Doppelte, höchstens MAX_OPTIONEN. */
export function parseOptionen(text: string): { optionen: string[]; gekuerzt: boolean } {
  const alle = [...new Set(text.replace(/^﻿/, '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean))];
  return { optionen: alle.slice(0, MAX_OPTIONEN), gekuerzt: alle.length > MAX_OPTIONEN };
}

/** Gleichverteilte Zahl in 0..max-1, ohne Modulo-Verzerrung. */
function zufallsZahl(max: number): number {
  const grenze = 2 ** 32 - (2 ** 32 % max);
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0]! >= grenze);
  return buf[0]! % max;
}

/** `anzahl` verschiedene Indizes aus 0..anzahlOptionen-1, in Ziehungsreihenfolge. */
export function ziehe(anzahlOptionen: number, anzahl: number, zufall: (max: number) => number = zufallsZahl): number[] {
  const idx = Array.from({ length: anzahlOptionen }, (_, i) => i);
  const n = Math.min(anzahl, anzahlOptionen);
  for (let i = 0; i < n; i++) {
    const j = i + zufall(anzahlOptionen - i);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, n);
}
