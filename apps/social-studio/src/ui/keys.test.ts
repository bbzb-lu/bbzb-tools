import { describe, expect, it } from 'vitest';
import { KEYS, keysAttr } from './keys';

describe('KEYS', () => {
  it('keysAttr trennt mit «+»', () => expect(keysAttr(KEYS.undo)).toBe('Strg+Z'));
  it('jede Taste ist nicht leer', () => {
    for (const k of Object.values(KEYS)) for (const part of k) expect(part.trim()).not.toBe('');
  });
  it('kein Kürzel doppelt belegt', () => {
    const all = Object.values(KEYS).map(keysAttr);
    expect(new Set(all).size).toBe(all.length);
  });
});
