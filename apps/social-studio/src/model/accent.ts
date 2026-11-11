import { akzent, colors, locationColors, tagBox, type PaletteColor } from '../tokens';
import { groupOf } from './slides';
import type { Element, Project } from './types';

/** Slide unter der waagrechten Mitte (ohne Drehung), genau auf der Naht die linke, ausserhalb die nächste. */
function slideAt(p: Project, el: Pick<Element, 'x' | 'width'>): number {
  const i = Math.ceil((el.x + el.width / 2) / p.format.width) - 1;
  return Math.min(Math.max(i, 0), p.slides.length - 1);
}

const fillOf = (location: unknown): string =>
  typeof location === 'string' && Object.hasOwn(locationColors, location)
    ? locationColors[location as keyof typeof locationColors].fill
    : colors.orange;

/**
 * Akzentfarbe (Hex) für ein Element. Modus «fix» (oder fehlt): Orange. «standort»: Standort des ersten sichtbaren Schul-Tags
 * (Ebenenreihenfolge unten → oben) auf der Slide des Elements, bei verknüpften Slides auf der ersten Slide der Gruppe (ein
 * Schul-Tag auf einer späteren Slide der Gruppe zählt nicht); ohne
 * Schul-Tag `lastTagLocation`; unbekannter Standort oder nichts davon: Orange.
 */
export function accentFor(p: Project, el: Pick<Element, 'x' | 'width'>): string {
  if (p.accentMode !== 'standort') return colors.orange;
  const [slide] = groupOf(p, slideAt(p, el));
  for (const id of p.order) {
    const e = p.elements[id];
    if (!e || e.type !== 'tag' || !e.visible) continue;
    const props = e.props as { variant?: unknown; text?: unknown };
    if (props.variant === 'schul' && slideAt(p, e) === slide) return fillOf(props.text);
  }
  return fillOf(p.lastTagLocation);
}

/** Hexwert einer Elementfarbe; «akzent» wird zu `accent` (aus `accentFor`). */
export const resolveColor = (token: PaletteColor, accent: string): string => (token === akzent ? accent : colors[token]);

/** Vorschaufarbe einer Tag-Variante (Bibliothek, Layoutkachel); fach/frei zeigen ihren Einfüge-Standard, nicht den Akzent-Platzhalter. */
export function tagPreviewFill(variant: string, accent: string): string | undefined {
  if (variant === 'fach') return locationColors.Bahnhof.fill;
  if (variant === 'frei') return colors.blau;
  const box = (tagBox as Record<string, { fill?: PaletteColor }>)[variant];
  return box?.fill && resolveColor(box.fill, accent);
}
