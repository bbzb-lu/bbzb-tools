import { z } from 'zod';
import { scrim } from '../tokens';

export const SCRIM_SIDES = ['oben', 'unten', 'links', 'rechts', 'obenLinks', 'obenRechts', 'untenLinks', 'untenRechts'] as const;
export type ScrimSide = (typeof SCRIM_SIDES)[number];

/** Verlauf an einer Kante oder Ecke (Foto: Bildbereich, Slide: ganze Slide); `reach` in %, `light` = aufhellen. */
export const scrimSchema = z.object({
  side: z.enum(SCRIM_SIDES),
  strength: z.enum(['leicht', 'mittel', 'stark']),
  reach: z.number().int().min(scrim.reach.min).max(scrim.reach.max).optional(),
  light: z.boolean().optional(),
});
export type Scrim = z.infer<typeof scrimSchema>;

/** Liste der Verläufe (Foto und Slide), höchstens `scrim.max`. */
export const scrimsSchema = z.array(scrimSchema).max(scrim.max);

/** Parameter des Effekts «scrim» (registriert vom Plugin, im Kern nur über die Id angesprochen). */
export type ScrimParams = { side: ScrimSide; strength: Scrim['strength']; reach: number; light: boolean } | null;

/** Effektwerte eines Verlaufs mit Vorgaben; `side` weicht beim gespiegelten Foto ab. */
export const scrimParams = (s: Scrim, side: ScrimSide = s.side): ScrimParams => ({
  side,
  strength: s.strength,
  reach: s.reach ?? scrim.reach.default,
  light: s.light ?? false,
});
