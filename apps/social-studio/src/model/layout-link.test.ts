import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { project } from './fixtures';
import { addLayoutSlides, layoutOnSlide, slideAfter } from './layout';
import { panorama, rules, voll } from './layout-fixtures';
import type { Project } from './types';

describe('Slide.link (verknüpfte Slides)', () => {
  const links = (p: Project) => p.slides.map((s) => s.link);

  it('Layout mit zwei Slides verknüpft beide mit einer neuen Id, je Panorama eine eigene', () => {
    const r = produce(project(1), (d) => {
      addLayoutSlides(d, panorama, 1, rules);
      addLayoutSlides(d, panorama, 3, rules);
    });
    const [, a, a2, b, b2] = links(r);
    expect(a).toBeDefined();
    expect([a2, b2]).toEqual([a, b]);
    expect(b).not.toBe(a);
    expect(links(r)[0]).toBeUndefined();
    expect(links(produce(project(1), (d) => void addLayoutSlides(d, voll, 1, rules)))).toEqual([undefined, undefined]);
  });

  it('Layout mit einer Slide auf einer verknüpften Slide löst die ganze Gruppe', () => {
    const p = produce(project(1), (d) => void addLayoutSlides(d, panorama, 1, rules));
    for (const i of [1, 2]) {
      const r = produce(p, (d) => void layoutOnSlide(d, voll, i, rules));
      expect(links(r)).toEqual([undefined, undefined, undefined]);
      // die andere Hälfte ist kein Panorama mehr, sonst hiesse sie weiter so
      expect(r.slides.map((s) => s.layout)).toEqual([undefined, i === 1 ? voll.id : undefined, i === 2 ? voll.id : undefined]);
    }
  });

  it('Panorama auf der rechten Hälfte eines Panoramas: alte Gruppe gelöst, neue Gruppe verknüpft', () => {
    const p = produce(project(1), (d) => void addLayoutSlides(d, panorama, 0, rules));
    const r = produce(p, (d) => void layoutOnSlide(d, panorama, 1, rules));
    expect(r.slides).toHaveLength(4); // Panorama, leere Slide; rechts der alten rechten Hälfte eine Slide dazu
    expect(r.slides[0]!.link).toBeUndefined();
    expect(r.slides[0]!.layout).toBeUndefined();
    expect(r.slides[1]!.link).toBeDefined();
    expect(r.slides[2]!.link).toBe(r.slides[1]!.link);
  });

  it('slideAfter folgt link; eine einzelne Slide mit gleichem Layout davor gehört nicht dazu', () => {
    const p = produce(project(4), (d) => {
      d.slides.forEach((s) => void (s.layout = 'panorama'));
      d.slides[1]!.link = d.slides[2]!.link = 'k';
    });
    expect([0, 1, 2, 3].map((i) => slideAfter(p, i, rules.layout))).toEqual([1, 3, 3, 4]);
  });
});
