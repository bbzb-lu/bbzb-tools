import type { ContextBarState } from '../../core/types';

/** Die aktive Leiste mit dem kleinsten Rang (oder keine). */
export const pickBar = (states: ContextBarState[]): ContextBarState | undefined =>
  states.reduce<ContextBarState | undefined>((top, s) => (s.active() && (!top || s.rank < top.rank) ? s : top), undefined);
