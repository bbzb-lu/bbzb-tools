import { accentFor, resolveColor } from '../model/accent';
import type { Element } from '../model/types';
import { useDoc } from '../store/document';
import { akzent, colors, type PaletteColor } from '../tokens';

/**
 * Akzentfarbe (Hex) für ein Element, live aus dem Dokument: ändert sich mit Modus, Schul-Tag und Lage (nach dem Loslassen,
 * nie pro Mausbewegung). Ein String: rendert nur neu, wenn sich die Farbe ändert.
 */
export function useAccent({ x, width }: Pick<Element, 'x' | 'width'>): string {
  return useDoc((s) => (s.project ? accentFor(s.project, { x, width }) : colors.orange));
}

/** Hexwert der Elementfarbe; nur «akzent» schaut ins Dokument. */
export function useColor(token: PaletteColor, { x, width }: Pick<Element, 'x' | 'width'>): string {
  return useDoc((s) => resolveColor(token, token === akzent && s.project ? accentFor(s.project, { x, width }) : colors.orange));
}

/** Hexwert für die Kachel «Akzent» in der Farbwahl; nur im standortabhängigen Projekt, sonst `undefined` (keine Kachel). */
export function useAccentTile({ x, width }: Pick<Element, 'x' | 'width'>): string | undefined {
  return useDoc((s) => (s.project?.accentMode === 'standort' ? accentFor(s.project, { x, width }) : undefined));
}
