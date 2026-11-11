import Konva from 'konva';
import type { TagProps } from './schema';
import { tagBox } from '../../../tokens';
import { tagDeptLabel, tagLabel, tagStyleOf } from './layout';

/** Konva-Einstellungen des Tag-Textes, gemeinsam für Darstellung und Messung. */
export function tagTextConfig(p: TagProps) {
  const s = tagStyleOf(p.variant);
  return { text: tagLabel(p), fontFamily: s.family, fontSize: s.size, letterSpacing: s.letterSpacingEm * s.size } as const;
}

/** Fachbereich-Zeile des Schul-Tags (kleinere Schrift), sonst undefined. */
export function tagDeptConfig(p: TagProps) {
  const text = tagDeptLabel(p);
  if (!text) return undefined;
  const s = tagStyleOf(p.variant);
  return { text, fontFamily: s.family, fontSize: tagBox.schulDept.size, letterSpacing: s.letterSpacingEm * tagBox.schulDept.size } as const;
}

/** Textbreite ohne die Laufweite hinter dem letzten Zeichen (Konva hängt sie an), damit das rechte Polster stimmt. */
export function measureLabel(p: TagProps): number {
  const width = (c: { letterSpacing: number }) => new Konva.Text(c).width() - c.letterSpacing;
  const d = tagDeptConfig(p);
  return Math.max(width(tagTextConfig(p)), d ? width(d) : 0);
}
