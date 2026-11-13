import { beforeEach, describe, expect, it } from 'vitest';
import { elementTypes } from '../core/registries';
import type { MenuItem } from '../core/types';
import { el, project } from '../model/fixtures';
import { load, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { copySelection } from './clipboard';
import { menuItemsFor } from './contextMenuItems';

const textStub = { id: 'text', label: 'Text', menuItems: () => [{ id: 'edit', label: 'Text bearbeiten', run() {} }] };
const named = (items: MenuItem[]) => items.flatMap((i) => ('separator' in i ? [] : [i]));
const labels = (ids: string[]) => named(menuItemsFor(ids)).map((i) => i.label);
const item = (ids: string[], label: string) => named(menuItemsFor(ids)).find((i) => i.label === label);

beforeEach(() => {
  if (!elementTypes.has('text')) elementTypes.register(textStub as never);
  load(project(1, [el({ id: 'a', type: 'text' }), el({ id: 'b', type: 'text' }), el({ id: 'c', type: 'text', locked: true })]));
  useUi.setState({ selectedIds: [], selectedId: null, currentSlide: 0 });
});

describe('menuItemsFor', () => {
  it('ohne Auswahl nur Einfügen, ohne Trenner am Rand', () => {
    expect(labels([])).toEqual(['Einfügen']);
  });

  it('ein Element: Typ-Eintrag; zwei Elemente: keiner', () => {
    expect(labels(['a'])).toContain('Text bearbeiten');
    expect(labels(['a', 'b'])).not.toContain('Text bearbeiten');
    expect(labels(['a', 'b'])).toContain('Duplizieren');
  });

  it('Trenner stehen nie am Rand und nie doppelt', () => {
    for (const ids of [[], ['a'], ['a', 'b']]) {
      const items = menuItemsFor(ids);
      expect('separator' in items[0]!).toBe(false);
      expect('separator' in items.at(-1)!).toBe(false);
      items.forEach((it, i) => i && expect('separator' in it && 'separator' in items[i - 1]!).toBe(false));
    }
  });

  it('Sperren und Ausblenden stehen immer im Menü', () => {
    expect(labels(['a'])).toContain('Sperren');
    expect(labels(['a'])).toContain('Ausblenden');
  });

  it('gesperrt: Entsperren statt Sperren, Löschen deaktiviert mit Grund', () => {
    expect(labels(['c'])).toContain('Entsperren');
    expect(labels(['c'])).not.toContain('Sperren');
    expect(item(['c'], 'Löschen')!.disabled).toMatch(/\S/);
    expect(item(['c'], 'Ausschneiden')!.disabled).toMatch(/\S/);
    expect(item(['a'], 'Löschen')!.disabled).toBeUndefined();
    expect(item(['a', 'c'], 'Ausschneiden')!.disabled).toBeUndefined();
  });

  it('Ausblenden wird zu Einblenden, wenn alle ausgeblendet sind', () => {
    useDoc.getState().project!.elements.a!.visible = false;
    expect(labels(['a'])).toContain('Einblenden');
  });

  it('Einfügen ist immer aktiv (ohne internen Inhalt liest es die Systemablage)', () => {
    expect(item(['a'], 'Einfügen')!.disabled).toBeUndefined();
    useUi.getState().setSelectedIds(['a']);
    copySelection();
    expect(item(['a'], 'Einfügen')!.disabled).toBeUndefined();
  });

  it('Kürzel stammen aus KEYS', () => {
    expect(item(['a'], 'Kopieren')!.keys).toBe('Strg+C');
    expect(item(['a'], 'Löschen')!.keys).toBe('Entf');
  });

  describe('gesperrte und ausgeblendete Elemente der Slide', () => {
    const NAMES = ['Foto 1 entsperren', 'Foto 2 einblenden', 'Foto 3 entsperren und einblenden'];
    beforeEach(() => {
      load(
        project(2, [
          el({ id: 'n', type: 'text', name: 'Normal' }),
          el({ id: 'l', type: 'text', name: 'Foto 1', locked: true }),
          el({ id: 'h', type: 'text', name: 'Foto 2', x: 800, visible: false }),
          el({ id: 'lh', type: 'text', name: 'Foto 3', locked: true, visible: false }),
          el({ id: 'other', type: 'text', name: 'Foto 4', x: 1100, locked: true }),
        ]),
      );
    });
    const top = (slide: number, ids: string[] = []) => named(menuItemsFor(ids, slide)).map((i) => i.label);

    it('alle auf der Slide stehen oben, oberstes zuerst; Elemente anderer Slides nicht', () => {
      expect(top(0).slice(0, 3)).toEqual([...NAMES].reverse());
      expect(top(0)).not.toContain('Foto 4 entsperren');
      expect(top(1)).toEqual(['Foto 4 entsperren', 'Einfügen']);
    });

    it('auch wenn ein normales Element gewählt ist; danach ein Trenner', () => {
      const items = menuItemsFor(['n'], 0);
      expect(named(items)[3]!.label).toBe('Kopieren');
      expect('separator' in items[3]!).toBe(true);
    });

    it('Slide ohne gesperrte Elemente: Menü wie bisher', () => {
      load(project(1, [el({ id: 'a', type: 'text' })]));
      expect(top(0, ['a'])[0]).toBe('Kopieren');
    });

    it('ein Schritt: entsperrt, blendet ein und wählt das Element', () => {
      const run = (label: string) => named(menuItemsFor([], 0)).find((i) => i.label === label)!.run();
      run('Foto 3 entsperren und einblenden');
      const e = useDoc.getState().project!.elements.lh!;
      expect([e.locked, e.visible]).toEqual([false, true]);
      expect(useUi.getState().selectedIds).toEqual(['lh']);
      useDoc.temporal.getState().undo();
      expect(useDoc.getState().project!.elements.lh).toMatchObject({ locked: true, visible: false });
    });
  });
});
