import { describe, expect, it, vi } from 'vitest';
import { measureLabel } from './measure';

// Kein Canvas in Node: Konva.Text misst Zeichen × Schriftgrösse × 0.6 plus Laufweite je Zeichen
vi.mock('konva', () => ({
  default: {
    Text: class {
      constructor(private c: { text: string; fontSize: number; letterSpacing: number }) {}
      width = () => this.c.text.length * (this.c.fontSize * 0.6 + this.c.letterSpacing);
    },
  },
}));

describe('measureLabel', () => {
  it('nimmt die längere Zeile: langer Fachbereich breiter als «BBZB BAHNHOF»', () => {
    const plain = measureLabel({ variant: 'schul', text: 'Bahnhof' });
    expect(measureLabel({ variant: 'schul', text: 'Bahnhof', dept: 'Fahrzeugbau und Strassentransport' })).toBeGreaterThan(plain);
    expect(measureLabel({ variant: 'schul', text: 'Bahnhof', dept: 'Zimmerleute' })).toBe(plain);
  });
});
