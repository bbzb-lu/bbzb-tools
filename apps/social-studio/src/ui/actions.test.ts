import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addElement, removeElement } from '../model/elements';
import { el, project } from '../model/fixtures';
import { addSlide, removeSlide } from '../model/slides';
import { apply, beginWrite, endWrite, load, undo, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { duplicate, duplicateMany, installSelectionSync, undoFromHint, nudge, patchElement, patchMany, removeMany, restackMany, tryApply } from './actions';

let stop: () => void;
beforeEach(() => {
  load(project(2, [el({ id: 'a' }), el({ id: 'b', x: 1200 })]));
  useUi.setState({ notice: null, selectedIds: [], selectedId: null, currentSlide: 0 });
  stop = installSelectionSync();
});
afterEach(() => stop());

describe('actions', () => {
  it('Löschen setzt den Rückgängig-Hinweis auf den Stand danach; ohne Hinweis (Ausschneiden) und bei Gesperrtem nicht', () => {
    useUi.setState({ undoHint: null });
    removeMany(['a', 'b']);
    expect(useUi.getState().undoHint).toMatchObject({ text: '2 Elemente gelöscht', project: useDoc.getState().project });
    undo();
    useUi.setState({ undoHint: null });
    removeMany(['a'], { hint: false });
    expect(useUi.getState().undoHint).toBeNull();
    undo();
    apply((d) => void (d.elements.a!.locked = true));
    removeMany(['a']);
    expect(useUi.getState().undoHint).toBeNull();
  });

  it('«Rückgängig» aus dem Hinweis: wirkungslos, solange ein Schreiben aussteht, dann bleibt der Hinweis; sonst ein Schritt zurück und weg', () => {
    removeMany(['a']);
    const hint = useUi.getState().undoHint;
    beginWrite();
    undoFromHint();
    expect(useUi.getState().undoHint).toBe(hint);
    expect(useDoc.getState().project!.elements.a).toBeUndefined();
    endWrite();
    undoFromHint();
    expect(useUi.getState().undoHint).toBeNull();
    expect(useDoc.getState().project!.elements.a).toBeDefined();
  });

  it('tryApply: ModelError wird Meldung, Projekt bleibt', () => {
    const before = useDoc.getState().project;
    apply((d) => removeSlide(d, 1));
    const one = useDoc.getState().project;
    expect(tryApply((d) => removeSlide(d, 0))).toBe(false);
    expect(useDoc.getState().project).toBe(one);
    expect(useUi.getState().notice).toEqual({ kind: 'error', text: 'Ein Projekt braucht mindestens eine Slide.' });
    expect(before).not.toBe(one);
  });

  it('Auswahl setzt die aktuelle Slide', () => {
    useUi.getState().setSelectedId('b');
    expect(useUi.getState().currentSlide).toBe(1);
  });

  it('Slide-Wechsel hebt eine Auswahl auf, die nicht auf der neuen Slide liegt', () => {
    useUi.setState({ selectedIds: ['b'], selectedId: 'b', cropEditId: 'b', textEditId: 'b', currentSlide: 1 });
    useUi.getState().setCurrentSlide(0);
    expect(useUi.getState()).toMatchObject({ currentSlide: 0, selectedId: null, cropEditId: null, textEditId: null });
  });

  it('Element über der Naht bleibt beim Wechsel auf die andere Slide gewählt', () => {
    apply((d) => addElement(d, el({ id: 'naht', x: 1000, width: 200 })));
    useUi.getState().setSelectedId('naht');
    useUi.getState().setCurrentSlide(1);
    useUi.getState().setCurrentSlide(0);
    expect(useUi.getState().selectedId).toBe('naht');
  });

  it('nach Undo verschwundenes Element: Auswahl und Modi weg', () => {
    apply((d) => addElement(d, el({ id: 'c' })));
    useUi.setState({ selectedIds: ['c'], selectedId: 'c', cropEditId: 'c' });
    undo();
    expect(useUi.getState()).toMatchObject({ selectedId: null, cropEditId: null, textEditId: null });
    useUi.getState().setSelectedId('a');
    apply((d) => removeElement(d, 'a'));
    expect(useUi.getState().selectedId).toBeNull();
  });

  it('setSelectedIds leitet selectedId ab: genau eine Id, sonst null', () => {
    useUi.getState().setSelectedIds(['a', 'b']);
    expect(useUi.getState().selectedId).toBeNull();
    useUi.getState().setSelectedIds(['a']);
    expect(useUi.getState().selectedId).toBe('a');
  });

  it('Löschen eines gewählten Elements lässt die übrigen gewählt', () => {
    apply((d) => addElement(d, el({ id: 'c', x: 300 })));
    useUi.getState().setSelectedIds(['a', 'c']);
    apply((d) => removeElement(d, 'c'));
    expect(useUi.getState().selectedIds).toEqual(['a']);
    expect(useUi.getState().selectedId).toBe('a');
  });

  it('Slidewechsel entfernt Ids, die nicht auf der neuen Slide liegen', () => {
    useUi.getState().setSelectedIds(['a', 'b']);
    useUi.getState().setCurrentSlide(1);
    expect(useUi.getState().selectedIds).toEqual(['b']);
  });

  it('patchElement ohne Änderung erzeugt keinen Undo-Schritt', () => {
    const past = () => useDoc.temporal.getState().pastStates.length;
    patchElement('a', { x: 0, width: 100 });
    expect(past()).toBe(0);
    patchElement('a', { x: 5 });
    expect(past()).toBe(1);
  });

  it('Undo entfernt die aktuelle Slide: aktuelle Slide wird die letzte', () => {
    apply((d) => void addSlide(d, 2));
    useUi.getState().setCurrentSlide(2);
    undo();
    expect(useUi.getState().currentSlide).toBe(1);
  });

  it('Element ganz unterhalb der Slides bleibt gewählt', () => {
    apply((d) => addElement(d, el({ id: 'weg', x: 1200, y: 5000 })));
    useUi.getState().setSelectedId('weg');
    expect(useUi.getState()).toMatchObject({ selectedId: 'weg', currentSlide: 1 });
  });

  describe('Mehrfach', () => {
    beforeEach(() => {
      load(project(1, [el({ id: 'a' }), el({ id: 'b', locked: true }), el({ id: 'c' })]));
    });
    const els = () => useDoc.getState().project!.elements;

    it('removeMany: gesperrte bleiben, ein Undo bringt alles zurück', () => {
      removeMany(['a', 'b', 'c']);
      expect(Object.keys(els())).toEqual(['b']);
      undo();
      expect(Object.keys(els())).toEqual(['a', 'b', 'c']);
    });

    it('duplicateMany wählt die Kopien', () => {
      duplicateMany(['a', 'c']);
      const sel = useUi.getState().selectedIds;
      expect(sel).toHaveLength(2);
      expect(sel.every((id) => els()[id])).toBe(true);
      expect(Object.keys(els())).toHaveLength(5);
    });

    it('duplicateMany inPlace: gleiche Boxen, Kopien gewählt, ein Undo-Schritt', () => {
      nudge(['a', 'c'], 3, 4);
      duplicateMany(['a', 'c'], { inPlace: true });
      const sel = useUi.getState().selectedIds;
      expect(sel).toHaveLength(2);
      for (const [i, id] of ['a', 'c'].entries()) {
        const { x, y, width, height, rotation } = els()[id]!;
        expect(els()[sel[i]!]).toMatchObject({ x, y, width, height, rotation });
      }
      undo();
      expect(Object.keys(els())).toHaveLength(3);
    });

    it('duplicate: Standard versetzt um 40, inPlace nicht, Auswahl auf der Kopie', () => {
      duplicate('a');
      expect(els()[useUi.getState().selectedId!]).toMatchObject({ x: 40, y: 40 });
      duplicate('a', { inPlace: true });
      expect(els()[useUi.getState().selectedId!]).toMatchObject({ x: 0, y: 0 });
      expect(Object.keys(els())).toHaveLength(5);
    });

    it('nudge: gesperrte bleiben', () => {
      nudge(['a', 'b'], 1, 2);
      expect(els().a).toMatchObject({ x: 1, y: 2 });
      expect(els().b).toMatchObject({ x: 0, y: 0 });
    });

    it('nudge: ausgeblendete bleiben', () => {
      patchMany(['a'], { visible: false });
      nudge(['a'], 1, 2);
      expect(els().a).toMatchObject({ x: 0, y: 0 });
    });

    it('patchMany ändert auch locked eines gesperrten', () => {
      patchMany(['b'], { locked: false });
      expect(els().b!.locked).toBe(false);
    });

    it('patchMany: Wirkungsloses Patchen ist kein Undo-Schritt, Mehrfach ein Schritt', () => {
      patchMany(['a', 'c'], { visible: false });
      patchMany(['a', 'c'], { visible: false });
      undo();
      expect(els().a!.visible).toBe(true);
      expect(els().c!.visible).toBe(true);
    });

    it('duplicateMany und nudge: je ein Undo-Schritt', () => {
      nudge(['a', 'c'], 1, 2);
      duplicateMany(['a', 'c']);
      undo();
      expect(Object.keys(els())).toHaveLength(3);
      expect(els().a).toMatchObject({ x: 1, y: 2 });
      undo();
      expect(els().a).toMatchObject({ x: 0, y: 0 });
      expect(els().c).toMatchObject({ x: 0, y: 0 });
    });
  });
});

describe('restackMany', () => {
  const order = () => useDoc.getState().project!.order;
  const setup = (els: Parameters<typeof el>[0][]) => load(project(1, els.map((e) => el(e))));
  const undoDepth = () => useDoc.temporal.getState().pastStates.length;

  it('überlappendes gewähltes Paar, oberstes schon vorne: Reihenfolge bleibt (kein Vertauschen)', () => {
    setup([{ id: 'a' }, { id: 'b' }]);
    restackMany(['a', 'b'], 1);
    expect(order()).toEqual(['a', 'b']);
  });

  it('vorwärts: beide über das nächste überlappende Nicht-Gewählte, Reihenfolge erhalten, ein Undo-Schritt', () => {
    setup([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'far', x: 900 }]);
    const n = undoDepth();
    restackMany(['a', 'b'], 1);
    expect(order()).toEqual(['c', 'a', 'b', 'far']);
    expect(undoDepth()).toBe(n + 1);
    undo();
    expect(order()).toEqual(['a', 'b', 'c', 'far']);
  });

  it('rückwärts spiegelbildlich', () => {
    setup([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    restackMany(['a', 'b'], -1);
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('nicht überlappender Nachbar wird übersprungen', () => {
    setup([{ id: 'a' }, { id: 'far', x: 900 }, { id: 'c' }]);
    restackMany(['a'], 1);
    expect(order()).toEqual(['far', 'c', 'a']);
  });
});
