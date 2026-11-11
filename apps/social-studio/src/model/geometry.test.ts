import { describe, expect, it } from 'vitest';
import { containsPoint, elementBounds, elementCenter, elementsOnSlide, slideIndexOf, slideRect } from './geometry';
import { el, project } from './fixtures';

const p = project(3, [
  el({ id: 'a', x: 900, y: 100, width: 400, height: 200 }), // Mitte 1100 → Slide 1, ragt in 0
  el({ id: 'bisNaht', x: 0, y: 0, width: 1080, height: 100 }), // endet genau an der Naht
  el({ id: 'b', x: 2300, y: 0, width: 100, height: 100 }),
  el({ id: 'unten', x: 1200, y: 1350, width: 100, height: 100 }), // unterhalb der Slide
]);

describe('geometry', () => {
  it('containsPoint: Rand inklusive, gedreht im lokalen System', () => {
    const r = el({ x: 100, y: 100, width: 200, height: 100 });
    expect(containsPoint(r, { x: 100, y: 200 })).toBe(true);
    expect(containsPoint(r, { x: 301, y: 150 })).toBe(false);
    const g = el({ x: 0, y: 0, width: 200, height: 100, rotation: 90 }); // liegt bei x -100..0, y 0..200
    expect(containsPoint(g, { x: -50, y: 150 })).toBe(true);
    expect(containsPoint(g, { x: 50, y: 50 })).toBe(false);
  });
  it('Mittelpunkt ohne Drehung', () => {
    expect(elementCenter(el({ x: 10, y: 20, width: 200, height: 100 }))).toEqual({ x: 110, y: 70 });
  });
  it('Mittelpunkt mit Drehung 90°', () => {
    const c = elementCenter(el({ x: 0, y: 0, width: 200, height: 100, rotation: 90 }));
    expect(c.x).toBeCloseTo(-50);
    expect(c.y).toBeCloseTo(100);
  });
  it('Hülle ohne Drehung ist das Rechteck selbst', () => {
    expect(elementBounds(el({ x: 5, y: 6, width: 20, height: 10 }))).toEqual({ x: 5, y: 6, width: 20, height: 10 });
  });
  it('Hülle mit Drehung 90° (Konva: im Uhrzeigersinn um x/y)', () => {
    const b = elementBounds(el({ x: 0, y: 0, width: 200, height: 100, rotation: 90 }));
    expect(b.x).toBeCloseTo(-100);
    expect(b.y).toBeCloseTo(0);
    expect(b.width).toBeCloseTo(100);
    expect(b.height).toBeCloseTo(200);
  });
  it('Hülle mit Drehung 45° wird grösser', () => {
    const b = elementBounds(el({ x: 0, y: 0, width: 100, height: 100, rotation: 45 }));
    expect(b.width).toBeCloseTo(141.42, 1);
    expect(b.height).toBeCloseTo(141.42, 1);
  });
  it('slideRect liegt bei index × Breite', () => {
    expect(slideRect(p, 2)).toEqual({ x: 2160, y: 0, width: 1080, height: 1350 });
  });
  it('Element über der Naht gehört zur Slide seines Mittelpunkts', () => {
    expect(slideIndexOf(p, el({ x: 700, width: 600 }))).toBe(0); // Mitte 1000
    expect(slideIndexOf(p, el({ x: 900, width: 600 }))).toBe(1); // Mitte 1200
    expect(slideIndexOf(p, el({ x: 5000, width: 10 }))).toBe(2); // ausserhalb → letzte
  });
  it('Mitte genau auf der Naht gehört zur linken Slide (Ruling R5: dort beginnt das Layout)', () => {
    expect(slideIndexOf(p, el({ x: 0, width: 2160 }))).toBe(0); // Panorama über Slide 1 und 2
    expect(slideIndexOf(p, el({ x: 1080, width: 2160 }))).toBe(1);
    expect(slideIndexOf(p, el({ x: 1080, width: 0.5 }))).toBe(1); // knapp rechts der Naht
    expect(slideIndexOf(p, el({ x: -100, width: 200 }))).toBe(0); // Mitte genau bei 0
  });
  it('links ausserhalb zählt zur ersten Slide', () => {
    expect(slideIndexOf(p, el({ x: -500, width: 10 }))).toBe(0);
  });
  it('hineinragende Elemente zählen zur Slide', () => {
    expect(elementsOnSlide(p, 0)).toEqual(['a', 'bisNaht']);
    expect(elementsOnSlide(p, 1)).toEqual(['a', 'unten']);
    expect(elementsOnSlide(p, 2)).toEqual(['b']);
  });
  it('Kante an Kante zählt nicht', () => {
    expect(elementsOnSlide(p, 1)).not.toContain('bisNaht');
  });
  it('Element ganz ausserhalb aller Slides gehört zur Slide unter seiner Mitte (bleibt erreichbar)', () => {
    expect(elementsOnSlide(p, 1)).toContain('unten');
    expect(elementsOnSlide(p, 0)).not.toContain('unten');
    expect(elementsOnSlide(p, 2)).not.toContain('unten');
    const weit = project(2, [el({ id: 'weit', x: 9000 })]); // rechts hinter der letzten Slide
    expect(elementsOnSlide(weit, 1)).toEqual(['weit']);
  });
});
