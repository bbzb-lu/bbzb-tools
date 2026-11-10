import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { addElement, duplicateElement, duplicateElements, layerStep, moveElements, moveInOrder, nextName, removeElement, removeElements, renameForStyle, updateElement, withReferencedAssets } from './elements';
import { el, project } from './fixtures';
import { ModelError } from './slides';

const base = () => project(1, [el({ id: 'a', name: 'A' }), el({ id: 'b', name: 'B' }), el({ id: 'c', name: 'C' })]);

describe('elements', () => {
  it('addElement ohne aboveId ganz oben, mit aboveId direkt darüber', () => {
    expect(produce(base(), (d) => addElement(d, el({ id: 'n' }))).order).toEqual(['a', 'b', 'c', 'n']);
    const r = produce(base(), (d) => addElement(d, el({ id: 'n' }), 'a'));
    expect(r.order).toEqual(['a', 'n', 'b', 'c']);
    expect(r.elements.n).toBeDefined();
  });

  it('addElement mit unbekannter aboveId wirft', () => {
    const p = base();
    expect(() => produce(p, (d) => addElement(d, el({ id: 'n' }), 'zz'))).toThrow(ModelError);
  });

  it('updateElement ändert Felder, nicht id/type', () => {
    const r = produce(base(), (d) => updateElement(d, 'a', { x: 5, name: 'Z' }));
    expect(r.elements.a).toMatchObject({ id: 'a', type: 'rect', x: 5, name: 'Z' });
  });

  it('updateElement und removeElement auf unbekannte ID werfen', () => {
    expect(() => produce(base(), (d) => updateElement(d, 'x', { x: 1 }))).toThrow();
    expect(() => produce(base(), (d) => removeElement(d, 'x'))).toThrow();
  });

  it('removeElement entfernt aus Map und order', () => {
    const r = produce(base(), (d) => removeElement(d, 'b'));
    expect(r.order).toEqual(['a', 'c']);
    expect(r.elements.b).toBeUndefined();
  });

  it('duplicateElement liegt direkt über dem Original', () => {
    let id = '';
    const r = produce(base(), (d) => {
      id = duplicateElement(d, 'a');
    });
    expect(r.order).toEqual(['a', id, 'b', 'c']);
    expect(r.elements[id]).toMatchObject({ x: 40, y: 40, name: 'A Kopie', type: 'rect' });
    expect(id).not.toBe('a');
  });

  it('duplicateElement mit Versatz 0 liegt deckungsgleich, Rest wie sonst', () => {
    let id = '';
    const r = produce(base(), (d) => void (id = duplicateElement(d, 'a', 0)));
    expect(r.order).toEqual(['a', id, 'b', 'c']);
    expect(r.elements[id]).toEqual({ ...r.elements.a, id, name: 'A Kopie' });
    expect(r.elements[id]!.name).toBe('A Kopie');
  });

  it('moveInOrder ordnet um, ohne IDs zu verlieren', () => {
    const r = produce(base(), (d) => moveInOrder(d, 'a', 2));
    expect(r.order).toEqual(['b', 'c', 'a']);
    expect(produce(base(), (d) => moveInOrder(d, 'c', 0)).order).toEqual(['c', 'a', 'b']);
    expect([...r.order].sort()).toEqual(['a', 'b', 'c']);
  });

  it('nextName zählt pro Typ-Label hoch', () => {
    const p = project(1, [el({ id: 'a', name: 'Foto 1' }), el({ id: 'b', name: 'Foto 3' }), el({ id: 'c', name: 'Foto 2 Kopie' })]);
    expect(nextName(p, 'Foto')).toBe('Foto 4');
    expect(nextName(p, 'Text')).toBe('Text 1');
  });

  it('renameForStyle tauscht nur automatische Stilnamen (Preset: «Titel»/«Kommentar», nextName: mit Zahl)', () => {
    expect(renameForStyle('Kommentar', 'kommentar', 'titel')).toBe('Titel');
    expect(renameForStyle('Kommentar 2', 'kommentar', 'titel')).toBe('Titel 2');
    expect(renameForStyle('Titel', 'titel', 'kommentar')).toBe('Kommentar');
    expect(renameForStyle('Titel 12', 'titel', 'kommentar')).toBe('Kommentar 12');
    expect(renameForStyle('Mein Titelblatt', 'kommentar', 'titel')).toBe('Mein Titelblatt');
    expect(renameForStyle('Kommentar rechts', 'kommentar', 'titel')).toBe('Kommentar rechts');
    expect(renameForStyle('Kommentar Kopie', 'kommentar', 'titel')).toBe('Kommentar Kopie');
    expect(renameForStyle('Text 1', 'kommentar', 'titel')).toBe('Text 1');
    expect(renameForStyle('Titel', 'kommentar', 'titel')).toBe('Titel');
    expect(renameForStyle('kommentar', 'kommentar', 'titel')).toBe('kommentar');
  });

  it('layerStep überspringt Elemente, die sich nicht überlagern', () => {
    // a und c auf Slide 1, b auf Slide 2: «Nach vorne» für a landet über c
    const p = project(2, [el({ id: 'a' }), el({ id: 'b', x: 1200 }), el({ id: 'c', x: 50 })]);
    expect(layerStep(p, 'a', 1)).toBe(2);
    expect(layerStep(p, 'c', -1)).toBe(0);
    expect(layerStep(p, 'a', -1)).toBe(-1);
    expect(layerStep(p, 'b', 1)).toBe(-1);
    expect(produce(p, (d) => moveInOrder(d, 'a', layerStep(d, 'a', 1))).order).toEqual(['b', 'c', 'a']);
  });

  it('withReferencedAssets behält nur Assets, auf die ein Element zeigt', () => {
    const meta = { mime: 'image/jpeg', width: 1, height: 1, name: 'x.jpg' };
    const p = { ...project(1, [el({ id: 'f', props: { assetId: 'a1' } }), el({ id: 't', props: { assetId: 7 } })]), assets: { a1: meta, a2: meta } };
    expect(withReferencedAssets(p).assets).toEqual({ a1: meta });
    expect(p.assets).toEqual({ a1: meta, a2: meta });
  });

  describe('Mehrfach', () => {
    const lockedB = () => project(1, [el({ id: 'a', x: 10 }), el({ id: 'b', locked: true, x: 20 }), el({ id: 'c', x: 30 })]);

    it('removeElements lässt gesperrte stehen', () => {
      const r = produce(lockedB(), (d) => removeElements(d, ['a', 'b', 'c']));
      expect(r.order).toEqual(['b']);
      expect(Object.keys(r.elements)).toEqual(['b']);
    });

    it('moveElements verschiebt, gesperrte bleiben', () => {
      const r = produce(lockedB(), (d) => moveElements(d, ['a', 'b', 'c'], 5, -3));
      expect(r.elements.a).toMatchObject({ x: 15, y: -3 });
      expect(r.elements.b).toMatchObject({ x: 20, y: 0 });
      expect(r.elements.c).toMatchObject({ x: 35, y: -3 });
    });

    it('duplicateElements: gleich viele neue Ids, Abstand bleibt, +40/+40', () => {
      let ids: string[] = [];
      const r = produce(lockedB(), (d) => void (ids = duplicateElements(d, ['a', 'c'])));
      expect(ids).toHaveLength(2);
      expect(r.elements[ids[0]!]).toMatchObject({ x: 50, y: 40 });
      expect(r.elements[ids[1]!]).toMatchObject({ x: 70, y: 40 });
      expect(r.order).toHaveLength(5);
    });

    it('duplicateElements mit Versatz 0: Positionen gleich, gesperrte Kopie bleibt gesperrt', () => {
      let ids: string[] = [];
      const r = produce(lockedB(), (d) => void (ids = duplicateElements(d, ['a', 'b'], 0)));
      expect(r.elements[ids[0]!]).toMatchObject({ x: 10, y: 0 });
      expect(r.elements[ids[1]!]).toMatchObject({ x: 20, y: 0, locked: true });
    });
  });
});
