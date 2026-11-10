const GAP = 6;
const EDGE = 4;

/** Tooltip unter dem Anker, passt er unten nicht ins Fenster, darüber; x bleibt 4 px vom Rand. */
export function placeTooltip(
  anchor: DOMRect,
  tip: { width: number; height: number },
  view: { width: number; height: number },
): { x: number; y: number; side: 'below' | 'above' } {
  const below = anchor.bottom + GAP + tip.height <= view.height - EDGE;
  const y = below ? anchor.bottom + GAP : Math.max(EDGE, anchor.top - GAP - tip.height);
  const x = Math.max(EDGE, Math.min(anchor.left + anchor.width / 2 - tip.width / 2, view.width - EDGE - tip.width));
  return { x, y, side: below ? 'below' : 'above' };
}
