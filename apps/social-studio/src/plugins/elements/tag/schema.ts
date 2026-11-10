import { z } from 'zod';
import { locations as tokenLocations, tagFills } from '../../../tokens';

export const tagVariants = ['schul', 'fach', 'frei', 'ort', 'cta'] as const;

/** Standorte des Schul-Tags (Entscheid Phase 2a); stehen seit Phase 2.5 mit ihren Farben in tokens.ts. */
export const locations = tokenLocations;

export const tagPropsSchema = z.object({
  variant: z.enum(tagVariants),
  /** Schul-Tag: der Standort (angezeigt als «BBZB Standort»), fach/frei/ort/cta: der Freitext (fach: Fachbereich). */
  text: z.string().min(1).max(60),
  /** Nur Schul-Tag: Fachbereich als zweite Zeile. */
  dept: z.string().max(60).optional(),
  /** frei: Füllung. fach: Standort des Fachbereichs (Bautechnik gibt es an zwei Standorten). */
  color: z.enum(tagFills).optional(),
});
export type TagProps = z.infer<typeof tagPropsSchema>;
