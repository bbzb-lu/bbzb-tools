import { describe, expect, it } from 'vitest';
import { canvasLayout, clampZoom, MAX_ZOOM, MIN_ZOOM, PAD, zoomAround, zoomStep } from './zoom';

describe('zoom', () => {
  it('clampZoom hält 0.25 bis 8 ein', () => {
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([0.25, 8]);
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(20)).toBe(8);
    expect(clampZoom(2)).toBe(2);
  });

  it('zoomStep: Rad hoch vergrössert, Rad runter verkleinert, Pinch in kleinen Schritten', () => {
    expect(zoomStep(1, -100)).toBeGreaterThan(1);
    expect(zoomStep(1, 100)).toBeLessThan(1);
    expect(zoomStep(1, -100)).toBeCloseTo(Math.exp(0.15), 10);
    const pinch = zoomStep(1, -3.5);
    expect(pinch).toBeGreaterThan(1);
    expect(pinch).toBeLessThan(1.01);
    expect(zoomStep(8, -100)).toBe(8);
    expect(zoomStep(0.25, 100)).toBe(0.25);
  });

  it('zoomAround: Weltpunkt unter dem Zeiger bleibt stehen, auch wenn sich der Ursprung verschiebt', () => {
    const scroll = { left: 300, top: 40 };
    const pointer = { x: 250, y: 180 };
    const world = (s: { left: number; top: number }, scale: number, o: { x: number; y: number }) => [
      (s.left + pointer.x - o.x) / scale,
      (s.top + pointer.y - o.y) / scale,
    ];
    const a = { x: PAD, y: PAD };
    const b = { x: 495, y: 300 };
    for (const [s0, s1, o0, o1] of [[0.5, 1.5, a, a], [1.5, 0.4, b, a], [2, 2, a, b], [0.4, 1.2, { x: 339.75, y: PAD }, b]] as const) {
      const next = zoomAround(scroll, pointer, s0, s1, o0, o1);
      const [x0, y0] = world(scroll, s0, o0);
      const [x1, y1] = world(next, s1, o1);
      expect(x1).toBeCloseTo(x0!, 9);
      expect(y1).toBeCloseTo(y0!, 9);
    }
  });

  describe('canvasLayout', () => {
    const view = { width: 990, height: 600 };
    it('eine Story-Slide bei Zoom 1: waagrecht mittig, kein Scroll-Raum', () => {
      const s = (600 - 2 * PAD) / 1920;
      expect(canvasLayout(view, { width: 1080 * s, height: 1920 * s }, 1)).toEqual({
        originX: (990 - 1080 * s) / 2,
        originY: PAD,
        width: 990,
        height: '100%',
      });
    });
    it('verkleinert: auch senkrecht mittig', () => {
      expect(canvasLayout(view, { width: 200, height: 300 }, 0.5)).toEqual({ originX: 395, originY: 150, width: 990, height: '100%' });
    });
    it('zehn Slides breiter als die Ansicht: Rand PAD links und rechts', () => {
      const s = (600 - 2 * PAD) / 1350;
      expect(canvasLayout(view, { width: 10 * 1080 * s, height: 1350 * s }, 1)).toEqual({
        originX: PAD,
        originY: PAD,
        width: 10 * 1080 * s + 2 * PAD,
        height: '100%',
      });
    });
    it('Zoom 2: halbe Ansicht als Rand in alle Richtungen', () => {
      expect(canvasLayout(view, { width: 2000, height: 1104 }, 2)).toEqual({ originX: 495, originY: 300, width: 2990, height: 1704 });
    });
  });
});
