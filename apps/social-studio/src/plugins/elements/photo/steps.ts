import type { EffectStep } from '../../../canvas/effects';
import { grainOpacity } from '../../../model/grain';
import { scrimSteps } from '../../effects/scrim';
import { adjustOf, grainOf, lookOf, type PhotoProps } from './schema';

/**
 * Effekte eines Fotos oder Videos, für Leinwand und Video-Vorschau gleich.
 * Erst Farbe (Look, dann Regler als Feinkorrektur darauf), dann Verlauf, zuletzt Korn: das Korn liegt wie in der PSD über dem
 * fertigen Bild, sonst würden Look und Kontrast es mitverändern. Verlauf vor Korn (Ruling R1, bei Golden-Abweichung tauschbar).
 */
export const photoSteps = (p: PhotoProps): EffectStep[] => [
  { id: 'look', params: { on: lookOf(p) } },
  { id: 'adjust', params: adjustOf(p) },
  ...scrimSteps(p).map((params) => ({ id: 'scrim', params })),
  { id: 'grain', params: { opacity: grainOf(p) ? grainOpacity(p.grainStrength, 'foto') : 0 } },
];
