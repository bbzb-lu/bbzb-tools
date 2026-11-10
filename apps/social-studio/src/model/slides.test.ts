import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { el, project } from './fixtures';
import type { Project } from './types';
import { LIMIT_TEXT, MAX_SLIDES, ModelError, addSlide, createProject, duplicateSlide, groupOf, moveSlide, removeSlide } from './slides';

const fmt = { id: 'post', label: 'Post', width: 1080, height: 1350 };

describe('slides', () => {
  it('createProject: eine warmweisse Slide', () => {
    const p = createProject({ name: 'T', format: fmt, now: 5 });
    expect(p.slides).toHaveLength(1);
    expect(p.slides[0]!.background).toBe('warmweiss');
    expect(p.format).toEqual({ id: 'post', width: 1080, height: 1350 });
    expect(p.createdAt).toBe(5);
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('moveSlide nimmt nahtübergreifendes Element mit seiner Mittelpunkt-Slide mit', () => {
    const p = project(3, [el({ id: 'e', x: 700, width: 600 }), el({ id: 'f', x: 2200 })]);
    const r = produce(p, (d) => moveSlide(d, 0, 2));
    expect(r.slides.map((s) => s.id)).toEqual(['s1', 's2', 's0']);
    expect(r.elements.e!.x).toBe(700 + 2160);
    expect(r.elements.f!.x).toBe(2200 - 1080);
  });

  it('moveSlide nach vorne verschiebt jedes Element genau einmal', () => {
    const p = project(3, [el({ id: 'a', x: 100 }), el({ id: 'b', x: 1200 }), el({ id: 'c', x: 2300 })]);
    const r = produce(p, (d) => moveSlide(d, 2, 0));
    expect(r.slides.map((s) => s.id)).toEqual(['s2', 's0', 's1']);
    expect([r.elements.a!.x, r.elements.b!.x, r.elements.c!.x]).toEqual([100 + 1080, 1200 + 1080, 2300 - 2160]);
  });

  it('removeSlide löscht Elemente der Slide und schiebt spätere nach links', () => {
    const p = project(3, [el({ id: 'a', x: 100 }), el({ id: 'b', x: 1200 }), el({ id: 'c', x: 2300 })]);
    const r = produce(p, (d) => removeSlide(d, 1));
    expect(r.slides.map((s) => s.id)).toEqual(['s0', 's2']);
    expect(Object.keys(r.elements).sort()).toEqual(['a', 'c']);
    expect(r.order).toEqual(['a', 'c']);
    expect(r.elements.c!.x).toBe(2300 - 1080);
    expect(r.elements.a!.x).toBe(100);
  });

  it('removeSlide auf letzter Slide wirft', () => {
    const p = project(1, [el({ id: 'a' })]);
    expect(() => produce(p, (d) => removeSlide(d, 0))).toThrow(ModelError);
    expect(() => produce(p, (d) => removeSlide(d, 0))).toThrow('Ein Projekt braucht mindestens eine Slide.');
  });

  it('addSlide bei 20 Slides wirft ModelError', () => {
    const p = project(MAX_SLIDES);
    expect(() =>
      produce(p, (d) => {
        addSlide(d, 0);
      }),
    ).toThrow('Instagram erlaubt höchstens 20 Slides.');
  });

  it('addSlide in der Mitte schiebt spätere Elemente um W nach rechts', () => {
    const p = project(3, [el({ id: 'a', x: 100 }), el({ id: 'b', x: 1200 }), el({ id: 'c', x: 2300 })]);
    const r = produce(p, (d) => {
      const id = addSlide(d, 1);
      expect(d.slides[1]!.id).toBe(id);
    });
    expect(r.slides).toHaveLength(4);
    expect(r.slides[1]!.background).toBe('warmweiss');
    expect([r.elements.a!.x, r.elements.b!.x, r.elements.c!.x]).toEqual([100, 1200 + 1080, 2300 + 1080]);
  });

  it('duplicateSlide kopiert nur Elemente mit Mittelpunkt auf der Slide, mit neuen IDs', () => {
    const p = project(3, [
      el({ id: 'a', x: 100, props: { t: { n: 1 } } }),
      el({ id: 'b', x: 1200 }),
      el({ id: 'c', x: 2300 }),
      el({ id: 'd', x: 200 }),
    ]);
    let newId = '';
    const r = produce(p, (d) => {
      newId = duplicateSlide(d, 0);
    });
    expect(r.slides.map((s) => s.id)).toEqual(['s0', newId, 's1', 's2']);
    expect(Object.keys(r.elements)).toHaveLength(6);
    const copies = r.order.filter((id) => !['a', 'b', 'c', 'd'].includes(id));
    expect(copies).toHaveLength(2);
    expect(copies.map((id) => r.elements[id]!.x)).toEqual([100 + 1080, 200 + 1080]);
    // direkt über den Originalen (über dem obersten, 'd'), Reihenfolge bleibt
    expect(r.order.slice(0, 4)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.order.slice(4)).toEqual(copies);
    // spätere Elemente verschoben
    expect(r.elements.b!.x).toBe(1200 + 1080);
    expect(r.elements.c!.x).toBe(2300 + 1080);
    // Props tief kopiert
    expect(r.elements[copies[0]!]!.props).toEqual({ t: { n: 1 } });
    expect(r.elements[copies[0]!]!.props).not.toBe(r.elements.a!.props);
  });

  it('Fehler lassen das Projekt unverändert', () => {
    const full = project(MAX_SLIDES, [el({ id: 'a', x: 100 })]);
    const one = project(1, [el({ id: 'a', x: 100 })]);
    const three = project(3, [el({ id: 'a', x: 100 })]);
    const snap = structuredClone([full, one, three]);
    expect(() =>
      produce(full, (d) => {
        addSlide(d, 0);
      }),
    ).toThrow(ModelError);
    expect(() =>
      produce(full, (d) => {
        duplicateSlide(d, 0);
      }),
    ).toThrow(ModelError);
    expect(() => produce(one, (d) => removeSlide(d, 0))).toThrow(ModelError);
    for (const [f, t2] of [
      [3, 0],
      [-1, 0],
      [0, 3],
      [0, 1.5],
    ] as const)
      expect(() => produce(three, (d) => moveSlide(d, f, t2))).toThrow(ModelError);
    expect(() => produce(three, (d) => removeSlide(d, -1))).toThrow(ModelError);
    expect(() =>
      produce(three, (d) => {
        duplicateSlide(d, 3);
      }),
    ).toThrow(ModelError);
    expect(() =>
      produce(three, (d) => {
        addSlide(d, 4);
      }),
    ).toThrow(ModelError);
    expect([full, one, three]).toEqual(snap);
  });

  it('moveSlide from === to ändert nichts', () => {
    const p = project(3, [el({ id: 'a', x: 1200 })]);
    expect(produce(p, (d) => moveSlide(d, 1, 1))).toEqual(p);
  });

  it('removeSlide mit Seam-Element: Mittelpunkt entscheidet', () => {
    const p = project(3, [el({ id: 'e', x: 900, width: 600 })]); // Mitte 1200 auf Slide 1
    expect(produce(p, (d) => removeSlide(d, 0)).elements.e!.x).toBe(900 - 1080);
    expect(produce(p, (d) => removeSlide(d, 1)).order).toEqual([]);
    expect(produce(p, (d) => removeSlide(d, 2)).elements.e!.x).toBe(900);
  });

  it('duplicateSlide kopiert Seam-Element um W versetzt', () => {
    const p = project(2, [el({ id: 'e', x: 700, width: 600 })]); // Mitte 1000 auf Slide 0
    let copy = '';
    const r = produce(p, (d) => {
      duplicateSlide(d, 0);
      copy = d.order[1]!;
    });
    expect(r.elements[copy]!.x).toBe(1780);
    expect(r.elements.e!.x).toBe(700);
  });

  describe('Panorama-Foto mit der Mitte genau auf der Naht gehört zur linken Slide (R5)', () => {
    const pano = () => project(3, [el({ id: 'pano', x: 0, width: 2160 }), el({ id: 'r', x: 1500 })]);
    it('löschen', () => {
      expect(produce(pano(), (d) => removeSlide(d, 0)).order).toEqual(['r']);
      const r = produce(pano(), (d) => removeSlide(d, 1));
      expect(r.order).toEqual(['pano']);
      expect(r.elements.pano!.x).toBe(0);
    });
    it('verschieben', () => {
      const r = produce(pano(), (d) => moveSlide(d, 0, 2));
      expect(r.elements.pano!.x).toBe(2160);
      expect(r.elements.r!.x).toBe(1500 - 1080);
    });
    it('duplizieren und davor einfügen', () => {
      const r = produce(pano(), (d) => void duplicateSlide(d, 0));
      expect(r.order).toHaveLength(3);
      expect(r.elements[r.order[1]!]!.x).toBe(1080);
      expect(produce(pano(), (d) => void duplicateSlide(d, 1)).order).toHaveLength(3); // kopiert nur «r»
      expect(produce(pano(), (d) => void addSlide(d, 1)).elements.pano!.x).toBe(0);
      expect(produce(pano(), (d) => void addSlide(d, 0)).elements.pano!.x).toBe(1080);
    });
  });

  it('duplicateSlide übernimmt Hintergrund, Verläufe und Layout der Slide', () => {
    const p = project(1);
    p.slides[0] = { id: 's0', background: 'blau', layout: 'titel', scrims: [{ side: 'oben', strength: 'leicht' }] };
    const r = produce(p, (d) => void duplicateSlide(d, 0));
    expect(r.slides[1]).toMatchObject({ background: 'blau', layout: 'titel', scrims: [{ side: 'oben', strength: 'leicht' }] });
    expect(r.slides[1]!.id).not.toBe('s0');
  });

  it('duplicateSlide bei 20 Slides wirft', () => {
    expect(() =>
      produce(project(MAX_SLIDES), (d) => {
        duplicateSlide(d, 0);
      }),
    ).toThrow(ModelError);
  });

  describe('verknüpfte Slides (Slide.link)', () => {
    /** Slides mit den gegebenen link-Ids (undefined = einzeln), je ein Element «e<i>» auf jeder Slide. */
    const linked = (links: (string | undefined)[], extra: Parameters<typeof el>[0][] = []): Project =>
      produce(project(links.length, [...links.map((_, i) => el({ id: `e${i}`, x: i * 1080 + 100 })), ...extra.map((o) => el(o))]), (d) =>
        links.forEach((l, i) => void (l && (d.slides[i]!.link = l))),
      );
    const ids = (p: Project) => p.slides.map((s) => s.id);
    const xs = (p: Project) => Object.fromEntries(p.order.map((id) => [id, p.elements[id]!.x]));

    it('groupOf: ohne link die Slide selbst, mit link die zusammenhängende Gruppe', () => {
      const p = linked([undefined, 'a', 'a', 'b', 'b', undefined]);
      expect([0, 1, 2, 3, 4, 5].map((i) => groupOf(p, i))).toEqual([[0, 0], [1, 2], [1, 2], [3, 4], [3, 4], [5, 5]]);
      expect(groupOf(linked(['a']), 0)).toEqual([0, 0]);
    });

    it('moveSlide verschiebt die ganze Gruppe nach rechts und links, Panorama-Foto bleibt nahtlos', () => {
      const p = linked(['a', 'a', undefined], [{ id: 'pano', x: 0, width: 2160 }]);
      const r = produce(p, (d) => moveSlide(d, 1, 1)); // rechte Hälfte, erste Slide der Gruppe nach 1
      expect(ids(r)).toEqual(['s2', 's0', 's1']);
      expect(xs(r)).toMatchObject({ pano: 1080, e0: 1180, e1: 2260, e2: 100 });
      const back = produce(r, (d) => moveSlide(d, 2, 0));
      expect(back).toEqual(p);
    });

    it('einzelne Slide springt über eine Gruppe hinweg, nie zwischen die Hälften', () => {
      const p = linked([undefined, 'a', 'a', undefined]);
      const right = produce(p, (d) => moveSlide(d, 0, 1));
      expect(ids(right)).toEqual(['s1', 's2', 's0', 's3']);
      expect(xs(right)).toMatchObject({ e0: 2260, e1: 100, e2: 1180 });
      const left = produce(p, (d) => moveSlide(d, 3, 2));
      expect(ids(left)).toEqual(['s0', 's3', 's1', 's2']);
      // Gruppe über eine andere Gruppe hinweg
      const two = linked(['a', 'a', 'b', 'b']);
      expect(ids(produce(two, (d) => moveSlide(d, 0, 1)))).toEqual(['s2', 's3', 's0', 's1']);
      expect(ids(produce(two, (d) => moveSlide(d, 3, 1)))).toEqual(['s2', 's3', 's0', 's1']);
    });

    it('removeSlide auf einer Hälfte entfernt die ganze Gruppe', () => {
      for (const i of [1, 2]) {
        const r = produce(linked([undefined, 'a', 'a', undefined]), (d) => removeSlide(d, i));
        expect(ids(r)).toEqual(['s0', 's3']);
        expect(xs(r)).toEqual({ e0: 100, e3: 1180 });
      }
      expect(() => produce(linked(['a', 'a']), (d) => removeSlide(d, 1))).toThrow('Ein Projekt braucht mindestens eine Slide.');
    });

    it('duplicateSlide legt eine eigene Gruppe mit neuer link-Id direkt dahinter an', () => {
      let first = '';
      const r = produce(linked([undefined, 'a', 'a', undefined], [{ id: 'pano', x: 1080, width: 2160 }]), (d) => {
        first = duplicateSlide(d, 2);
      });
      expect(r.slides).toHaveLength(6);
      expect(r.slides[3]!.id).toBe(first);
      const link = r.slides[3]!.link;
      expect(link).toBeDefined();
      expect(link).not.toBe('a');
      expect(r.slides.map((s) => s.link)).toEqual([undefined, 'a', 'a', link, link, undefined]);
      expect(r.order).toHaveLength(4 + 1 + 3); // e0..e3, pano, Kopien von e1, e2, pano
      const copyPano = r.order.find((id) => id !== 'pano' && r.elements[id]!.width === 2160)!;
      expect(r.elements[copyPano]!.x).toBe(1080 + 2160);
      expect(r.elements.e3!.x).toBe(3 * 1080 + 100 + 2160);
      // Einzelne Slide bekommt keine link-Id
      expect(produce(linked([undefined]), (d) => void duplicateSlide(d, 0)).slides[1]!.link).toBeUndefined();
    });

    it('duplicateSlide: 20-Slide-Limit gilt für die ganze Gruppe, nichts geändert', () => {
      const p = linked([...Array<undefined>(MAX_SLIDES - 3).fill(undefined), 'a', 'a']);
      expect(p.slides).toHaveLength(MAX_SLIDES - 1);
      expect(() => produce(p, (d) => void duplicateSlide(d, MAX_SLIDES - 2))).toThrow(LIMIT_TEXT);
      expect(produce(p, (d) => void duplicateSlide(d, 0)).slides).toHaveLength(MAX_SLIDES);
    });
  });
});
