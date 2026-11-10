import { describe, expect, it } from 'vitest';
import { el, project } from './fixtures';
import { idsInRect, selectableOnSlide, unionBounds } from './selection';

describe('selection', () => {
  it('selectableOnSlide lässt gesperrte und ausgeblendete Elemente weg', () => {
    const p = project(1, [el({ id: 'a' }), el({ id: 'l', locked: true }), el({ id: 'h', visible: false })]);
    expect(selectableOnSlide(p, 0)).toEqual(['a']);
  });

  it('idsInRect nimmt ein Element über der Naht auf beiden Slides mit', () => {
    const p = project(2, [el({ id: 'naht', x: 1000, width: 200 }), el({ id: 'weit', x: 0, y: 500 })]);
    const r = { x: 1000, y: 0, width: 200, height: 100 };
    expect(idsInRect(p, 0, r)).toEqual(['naht']);
    expect(idsInRect(p, 1, r)).toEqual(['naht']);
  });

  it('unionBounds von zwei Elementen', () => {
    expect(unionBounds([el({ x: 10, y: 20 }), el({ x: 200, y: 50, width: 50, height: 50 })])).toEqual({ x: 10, y: 20, width: 240, height: 100 });
  });
});
