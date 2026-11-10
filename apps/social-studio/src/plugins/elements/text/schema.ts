import { z } from 'zod';
import { paletteColors, textAdjust } from '../../../tokens';

/** Elementfarbe: Palettenfarbe oder «akzent» (Phase 2.5, aufgelöst beim Zeichnen). */
export const colorTokenSchema = z.enum(paletteColors);

export const textPropsSchema = z.object({
  text: z.string().max(2000),
  style: z.enum(['titel', 'kommentar']),
  color: colorTokenSchema,
  fontSize: z.number().min(8).max(600),
  align: z.enum(['left', 'center', 'right']),
  // Feineinstellung, fehlt in Projekten bis Phase 1.2: dann gilt der Stilwert (kein schemaVersion-Wechsel, Ruling R7).
  lineHeight: z.number().int().min(textAdjust.lineHeight.min).max(textAdjust.lineHeight.max).optional(),
  tracking: z.number().int().min(textAdjust.tracking.min).max(textAdjust.tracking.max).optional(),
});
export type TextProps = z.infer<typeof textPropsSchema>;
