import type { Effect } from '../../core/types';
import { rgba, scrim } from '../../tokens';
import { scrimParams, type ScrimParams, type ScrimSide } from '../../model/scrim';
import { flipOf, flipYOf, scrimsOf, type PhotoProps } from '../elements/photo/schema';

type Side = ScrimSide;
export type { ScrimParams };

/** Linie des Verlaufs [x0, y0, x1, y1]: von der Kante `side` bis `reach` % der Länge quer zu ihr. */
export function scrimLine(side: Side, w: number, h: number, reach: number): [number, number, number, number] {
  const k = reach / 100;
  if (side === 'oben') return [0, 0, 0, h * k];
  if (side === 'unten') return [0, h, 0, h * (1 - k)];
  if (side === 'links') return [0, 0, w * k, 0];
  if (side === 'rechts') return [w, 0, w * (1 - k), 0];
  // Ecken: diagonal von der Ecke zum Punkt, der um die Reichweite in beide Richtungen hineinliegt
  const [x0, x1] = side.endsWith('Links') ? [0, w * k] : [w, w * (1 - k)];
  const [y0, y1] = side.startsWith('oben') ? [0, h * k] : [h, h * (1 - k)];
  return [x0, y0, x1, y1];
}

const MIRROR: Record<Side, Side> = {
  oben: 'oben', unten: 'unten', links: 'rechts', rechts: 'links',
  obenLinks: 'obenRechts', obenRechts: 'obenLinks', untenLinks: 'untenRechts', untenRechts: 'untenLinks',
};

const MIRROR_Y: Record<Side, Side> = {
  oben: 'unten', unten: 'oben', links: 'links', rechts: 'rechts',
  obenLinks: 'untenLinks', obenRechts: 'untenRechts', untenLinks: 'obenLinks', untenRechts: 'obenRechts',
};

/** Effekt-Parameter je Verlauf eines Fotos, in Reihenfolge. Die Effekt-Canvas ist ungespiegelt: gespiegelt liegt die gewählte Kante auf der anderen Seite. */
export const scrimSteps = (p: PhotoProps): ScrimParams[] =>
  scrimsOf(p).map((s) => {
    const x = flipOf(p) ? MIRROR[s.side] : s.side;
    return scrimParams(s, flipYOf(p) ? MIRROR_Y[x] : x);
  });

/** Verlauf über die ganze Effekt-Canvas (= Bildbereich): Palettenfarbe → transparent, wie die Verläufe der PSD. */
export const scrimEffect: Effect<ScrimParams> = {
  id: 'scrim',
  label: 'Verlauf',
  active: (p) => p !== null,
  apply(ctx, p) {
    if (!p) return;
    const { width, height } = ctx.canvas;
    const color = scrim.color[p.light ? 'light' : 'dark'];
    const g = ctx.createLinearGradient(...scrimLine(p.side, width, height, p.reach));
    g.addColorStop(0, rgba(color, scrim.alpha[p.strength]));
    g.addColorStop(1, rgba(color, 0));
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};
