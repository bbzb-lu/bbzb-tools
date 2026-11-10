import { colors, departments, locationColors, tagBox, tagStyles, type Location } from '../../../tokens';
import { resolveColor } from '../../../model/accent';
import type { TagProps } from './schema';

/** Angezeigter Text: immer Versalien (tagStyles.uppercase). */
export function tagLabel(p: Pick<TagProps, 'variant' | 'text'>): string {
  const t = p.variant === 'schul' && p.text !== 'BBZB' ? `BBZB ${p.text}` : p.text;
  return tagStyles[p.variant === 'cta' ? 'cta' : 'tag'].uppercase ? t.toUpperCase() : t;
}

/** Zweite Zeile des Schul-Tags: Fachbereich, nur wenn der Standort ihn führt. */
export function tagDeptLabel(p: Pick<TagProps, 'variant' | 'text' | 'dept'>): string | undefined {
  if (p.variant !== 'schul' || !p.dept || !Object.hasOwn(departments, p.text)) return undefined;
  return departments[p.text as Exclude<Location, 'BBZB'>].includes(p.dept) ? p.dept.toUpperCase() : undefined;
}

export const tagHeightOf = (p: Pick<TagProps, 'variant' | 'text' | 'dept'>): number =>
  p.variant === 'schul' && tagDeptLabel(p) ? tagBox.schulDept.height : tagBox[p.variant].height;

// BBZB ist kein Tag-Füllwert (tagFills), auch nicht bei Altdaten von Hand
const isLocation = (c: unknown): c is Exclude<Location, 'BBZB'> => typeof c === 'string' && c !== 'BBZB' && Object.hasOwn(locationColors, c);

/** Füllung (Hex) des Tags; `accent` ist die Akzentfarbe des Elements. */
export function tagFillOf(p: Pick<TagProps, 'variant' | 'color'>, accent: string): string {
  if (p.variant === 'fach') return isLocation(p.color) ? locationColors[p.color].fill : colors.orange;
  if (p.variant !== 'frei') return resolveColor(tagBox[p.variant].fill, accent);
  if (p.color === 'akzent') return accent;
  if (isLocation(p.color)) return locationColors[p.color].fill;
  return colors[p.color ?? 'blau'];
}

/** Breite der Box bei gegebener Textbreite (bei zwei Zeilen übergibt der Aufrufer die der längeren, siehe measureLabel). */
export function tagBoxWidth(p: Pick<TagProps, 'variant'>, textWidth: number): number {
  if (p.variant === 'ort') return tagBox.ort.textX + textWidth + tagBox.ort.paddingRight;
  const b = tagBox[p.variant];
  return b.paddingLeft + textWidth + b.paddingRight;
}

export const tagTextX = (v: TagProps['variant']): number => (v === 'ort' ? tagBox.ort.textX : v === 'cta' ? tagBox.cta.paddingLeft : tagBox.schul.paddingLeft);
export const tagStyleOf = (v: TagProps['variant']) => tagStyles[v === 'cta' ? 'cta' : 'tag'];
