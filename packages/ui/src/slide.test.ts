import { describe, expect, it } from 'vitest';
import { boxIn, frameOnce, sameBox } from './slide';

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height }) as DOMRect;

describe('boxIn', () => {
  it('rechnet Rahmen und Skalierung heraus', () => {
    expect(boxIn(rect(110, 52, 40, 20), rect(100, 50, 200, 24), 1, { left: 1, top: 1 })).toEqual({ x: 9, y: 1, w: 40, h: 20 });
    expect(boxIn(rect(120, 60, 80, 40), rect(100, 50, 400, 48), 2, { left: 0, top: 0 })).toEqual({ x: 10, y: 5, w: 40, h: 20 });
  });
  it('Skalierung 0 gilt als 1', () => expect(boxIn(rect(5, 0, 10, 10), rect(0, 0, 0, 0), 0, { left: 0, top: 0 }).w).toBe(10));
});

describe('sameBox / frameOnce', () => {
  it('Unterschiede unter einem Viertelpixel sind gleich', () => {
    expect(sameBox({ x: 0, y: 0, w: 10, h: 5 }, { x: 0.1, y: 0, w: 10, h: 5 })).toBe(true);
    expect(sameBox({ x: 0, y: 0, w: 10, h: 5 }, { x: 1, y: 0, w: 10, h: 5 })).toBe(false);
  });
  it('frameOnce: viele Aufrufe je Bild ergeben einen Start', () => {
    const q: (() => void)[] = [];
    let n = 0;
    const f = frameOnce(() => n++, (cb) => q.push(cb));
    for (let i = 0; i < 200; i++) f();
    expect(q.length).toBe(1);
    q.shift()!();
    expect(n).toBe(1);
    f();
    expect(q.length).toBe(1);
  });
});
