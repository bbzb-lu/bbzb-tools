import { describe, expect, it } from 'vitest';
import { colorTokens } from '../../../tokens';
import { baseOf, hintColor, hintContrast } from './hint';

describe('Platzhalter-Hinweis', () => {
  it.each(colorTokens.flatMap((bg) => [[bg, false], [bg, true]] as const))('ist auf Hintergrund %s, Rahmen %s lesbar (≥ 4.5:1)', (bg, framed) => {
    const under = baseOf(bg, framed);
    expect(hintContrast(hintColor(under), under)).toBeGreaterThanOrEqual(4.5);
  });
  it('mit Rahmen bleibt der Hinweis dunkel, auch auf dunklem Slide (Rahmen ist warmweiss)', () => {
    expect(hintColor(baseOf('blauschwarz', true))).toBe('blauschwarz');
  });
  it('wird auf Blauschwarz hell, auf Warmweiss dunkel', () => {
    expect(hintColor('blauschwarz')).toBe('warmweiss');
    expect(hintColor('warmweiss')).toBe('blauschwarz');
  });
});
