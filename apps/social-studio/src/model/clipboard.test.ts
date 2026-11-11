import { describe, expect, it } from 'vitest';
import { copyElements, pasteElements } from './clipboard';
import { duplicateElement } from './elements';
import { el, project } from './fixtures';

const base = () => project(3, [el({ id: 'a', x: 100, y: 50, name: 'A' }), el({ id: 'b', x: 300, y: 80, role: 'titel', locked: true, name: 'B' })]);

describe('clipboard model', () => {
  it('copyElements: tiefe Kopien in Ablagereihenfolge, Gesperrte mit', () => {
    const p = base();
    const out = copyElements(p, ['b', 'a']);
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);
    expect(out[1]!.locked).toBe(true);
    out[0]!.props = { x: 1 };
    expect(p.elements.a!.props).toEqual({});
  });

  it('pasteElements: auf Slide 2 genau eine Slide-Breite weiter rechts, zweites Einfügen +40', () => {
    const p = base();
    const entries = copyElements(p, ['a', 'b']);
    const first = pasteElements(p, entries, 1, 0);
    expect(first).toHaveLength(2);
    expect(first.every((id) => !['a', 'b'].includes(id))).toBe(true);
    expect(p.elements[first[0]!]).toMatchObject({ x: 100 + 1080, y: 50, name: 'A Kopie' });
    expect(p.elements[first[1]!]).toMatchObject({ x: 300 + 1080, y: 80, role: 'titel', locked: true });
    const second = pasteElements(p, entries, 1, 1);
    expect(p.elements[second[0]!]).toMatchObject({ x: 100 + 1080 + 40, y: 90 });
    expect(p.order.slice(-2)).toEqual(second);
  });

  it('pasteElements: Ursprung ist die Slide der Gruppen-Box, auch bei Ursprung auf Slide 3', () => {
    const p = project(3, [el({ id: 'c', x: 2 * 1080 + 70 })]);
    const [id] = pasteElements(p, copyElements(p, ['c']), 0, 0);
    expect(p.elements[id!]!.x).toBe(70);
  });
});

describe('Maske beim Kopieren', () => {
  const M = 'c'.repeat(64);
  const withMask = () => project(2, [el({ id: 'a', type: 'photo', props: { assetId: 'a'.repeat(64), mask: M } })]);

  it('Einfügen und Duplizieren nehmen die Maske mit', () => {
    const p = withMask();
    const [pasted] = pasteElements(p, copyElements(p, ['a']), 1, 0);
    expect((p.elements[pasted!]!.props as { mask?: string }).mask).toBe(M);
    const dup = duplicateElement(p, 'a');
    expect((p.elements[dup]!.props as { mask?: string }).mask).toBe(M);
  });
});
