import { describe, expect, it } from 'vitest';
import { freeBand } from './freeBand';

const photo = { x: 0, y: 0, width: 1080, height: 1350 };
const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('freeBand', () => {
  it('ohne Überdeckung das ganze Foto', () => expect(freeBand(photo, [])).toEqual({ y: 0, height: 1350 }));
  it('Titel-Layout: der Streifen unter dem Titel (y 161 bis 830)', () => expect(freeBand(photo, [r(59, 161, 949, 669)])).toEqual({ y: 830, height: 520 }));
  it('nimmt den grössten Streifen, auch über dem Element', () => expect(freeBand(photo, [r(0, 900, 1080, 100)])).toEqual({ y: 0, height: 900 }));
  it('Lücke zwischen zwei Elementen, überlappende zählen einmal', () =>
    expect(freeBand(photo, [r(0, 0, 1080, 300), r(0, 250, 1080, 150), r(0, 1000, 1080, 350)])).toEqual({ y: 400, height: 600 }));
  it('Elemente neben dem Foto oder ausserhalb zählen nicht', () => expect(freeBand(photo, [r(1100, 100, 200, 800), r(0, 1400, 100, 50)])).toEqual({ y: 0, height: 1350 }));
  it('alles bedeckt: das ganze Foto, damit der Hinweis nicht verschwindet', () => expect(freeBand(photo, [r(0, 0, 1080, 1350)])).toEqual({ y: 0, height: 1350 }));
});
