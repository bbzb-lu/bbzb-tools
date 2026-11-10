import { expect, it } from 'vitest';
import type { ContextBarState } from '../../core/types';
import { pickBar } from './pick';

const s = (id: string, rank: number, on: boolean): ContextBarState => ({ id, rank, active: () => on, Bar: () => null });

it('zeigt die aktive Leiste mit dem kleinsten Rang, unabhängig von der Reihenfolge der Registrierung', () => {
  expect(pickBar([s('video', 60, true), s('ai', 40, true), s('crop', 10, false)])?.id).toBe('ai');
  expect(pickBar([s('undo', 80, true), s('crop', 10, true)])?.id).toBe('crop');
  expect(pickBar([s('ai', 40, false)])).toBeUndefined();
});
