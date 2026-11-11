import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltipPosition';

const view = { width: 1280, height: 720 };
const tip = { width: 120, height: 30 };
const rect = (x: number, y: number, w = 40, h = 40) => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }) as DOMRect;

describe('placeTooltip', () => {
  it('Anker oben links: unten, x >= 4', () => {
    const p = placeTooltip(rect(0, 0), tip, view);
    expect(p.side).toBe('below');
    expect(p.x).toBeGreaterThanOrEqual(4);
    expect(p.y).toBeGreaterThanOrEqual(40 + 6);
  });
  it('Anker unten am Fenster: oben, ohne den Anker zu überdecken', () => {
    const p = placeTooltip(rect(600, 680), tip, view);
    expect(p.side).toBe('above');
    expect(p.y + tip.height).toBeLessThanOrEqual(680);
  });
  it('Anker am rechten Rand: x + Breite <= Fenster - 4', () => {
    const p = placeTooltip(rect(1240, 10), tip, view);
    expect(p.x + tip.width).toBeLessThanOrEqual(view.width - 4);
  });
});
