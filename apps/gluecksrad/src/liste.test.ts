import { afterEach, expect, it, vi } from 'vitest';
import { ladeListe, speichereListe } from './liste';

afterEach(() => vi.unstubAllGlobals());

function fake() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

it('speichert und lädt die Liste unter gluecksrad-liste', () => {
  const ls = fake();
  vi.stubGlobal('localStorage', ls);
  speichereListe('A\nB');
  expect(ls.getItem('gluecksrad-liste')).toBe('A\nB');
  expect(ladeListe()).toBe('A\nB');
});

it('liefert leer, wenn localStorage wirft', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } });
  expect(ladeListe()).toBe('');
  expect(() => speichereListe('A')).not.toThrow();
});
