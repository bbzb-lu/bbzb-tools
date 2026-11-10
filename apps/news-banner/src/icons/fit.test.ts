import { describe, expect, it } from 'vitest';
import { slots, zones } from '../tokens';
import { fitRect } from './fit';

describe('fitRect', () => {
  it('begrenzt durch die Breite und zentriert', () => {
    const r = fitRect(680, 262, 'left');
    expect(r.w).toBeCloseTo(340);
    expect(r.h).toBeCloseTo(131);
    expect(r.x + r.w / 2).toBeCloseTo(slots.left.cx);
    expect(r.y + r.h / 2).toBeCloseTo(slots.left.cy);
  });
  it('begrenzt durch die Höhe', () => {
    const r = fitRect(100, 524, 'right');
    expect(r.h).toBeCloseTo(262);
    expect(r.w).toBeCloseTo(50);
  });
  it('skaliert kleine Inhalte hoch bis zum Platz', () => {
    expect(fitRect(10, 10, 'left').h).toBeCloseTo(262);
  });
  it('alle Plätze liegen in der Banner-Zone und ausserhalb der Sperrzonen', () => {
    const b = zones.banner;
    for (const s of Object.values(slots)) {
      expect(s.cy - s.h / 2).toBeGreaterThanOrEqual(b.y);
      expect(s.cy + s.h / 2).toBeLessThanOrEqual(b.y + b.h);
      for (const z of zones.blocked) expect(s.cx + s.w / 2 <= z.x || s.cx - s.w / 2 >= z.x + z.w || s.cx - s.w / 2 > z.x + z.w || s.cx + s.w / 2 < z.x).toBe(true);
    }
  });
});
