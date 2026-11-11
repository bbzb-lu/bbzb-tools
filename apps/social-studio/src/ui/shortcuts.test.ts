import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDoc } from '../store/document';
import { el, project } from '../model/fixtures';
import { load } from '../store/document';
import { useUi } from '../store/ui';
import { KEYS } from './keys';
import { saveProjectFile } from './projectFileActions';
import { installShortcuts } from './shortcuts';

vi.mock('./projectFileActions', () => ({ saveProjectFile: vi.fn() }));

/** Echte Klassenhierarchie, damit `instanceof` und NO_TEXT wie im Browser greifen. */
class FakeEl {
  isContentEditable = false;
  classList: { contains: (c: string) => boolean };
  constructor(public tagName: string, classes: string[] = []) {
    this.classList = { contains: (c) => classes.includes(c) };
  }
}
class FakeInput extends FakeEl {
  constructor(public type: string) {
    super('INPUT');
  }
}

type Handler = (e: unknown) => void;
let handlers: Record<string, Handler>;
let stop: () => void;
beforeEach(() => {
  handlers = {};
  vi.stubGlobal('window', {
    addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    removeEventListener: (t: string, h: Handler) => handlers[t] === h && delete handlers[t],
  });
  vi.stubGlobal('HTMLElement', FakeEl);
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.stubGlobal('document', { querySelector: () => null, body: new FakeEl('BODY') });
  load(project(1, [el({ id: 'a', x: 10, y: 10 }), el({ id: 'b', x: 50, y: 50 })]));
  useUi.setState({ selectedIds: ['a'], selectedId: 'a', currentSlide: 0, zoom: 1, cropEditId: null });
  stop = installShortcuts();
});
afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

/** Taste aus KEYS als KeyboardEvent-Ersatz; gibt zurück, ob der Handler sie erkannt hat. */
const press = (keys: readonly string[], target: unknown = null) => {
  const last = keys[keys.length - 1]!;
  const key = { Entf: 'Delete', Esc: 'Escape', '−': '-' }[last] ?? last;
  const e = { key, ctrlKey: keys.includes('Strg'), metaKey: false, shiftKey: keys.includes('Umschalt'), altKey: keys.includes('Alt'), target, preventDefault: vi.fn() };
  handlers.keydown!(e);
  return e.preventDefault.mock.calls.length > 0;
};

describe('installShortcuts erkennt KEYS', () => {
  for (const name of ['undo', 'redo', 'duplicate', 'remove', 'zoomIn', 'zoomOut', 'zoomFit', 'save', 'export'] as const) {
    it(name, () => expect(press(KEYS[name])).toBe(true));
  }
  it('export fordert den Dialog an', () => {
    const n = useUi.getState().exportRequest;
    press(KEYS.export);
    expect(useUi.getState().exportRequest).toBe(n + 1);
  });
  it('save ruft saveProjectFile auf', () => {
    press(KEYS.save);
    expect(saveProjectFile).toHaveBeenCalled();
  });
  it('deselect hebt die Auswahl auf, ohne preventDefault', () => {
    expect(press(KEYS.deselect)).toBe(false);
    expect(useUi.getState().selectedId).toBeNull();
  });
});

describe('Pinselmodus', () => {
  const key = (k: string, mods: { ctrlKey?: boolean; altKey?: boolean; altGr?: boolean } = {}) => {
    const e = { key: k, ctrlKey: !!mods.ctrlKey, metaKey: false, shiftKey: false, altKey: !!mods.altKey, target: null, preventDefault: vi.fn(), getModifierState: (m: string) => m === 'AltGraph' && !!mods.altGr };
    handlers.keydown!(e);
    return e.preventDefault.mock.calls.length > 0;
  };
  beforeEach(() => useUi.getState().setMaskEditId('a'));
  it('X tauscht Ausblenden und Einblenden', () => {
    const mode = useUi.getState().brush.mode;
    expect(key('x')).toBe(true);
    expect(useUi.getState().brush.mode).not.toBe(mode);
    expect(key('X')).toBe(true);
    expect(useUi.getState().brush.mode).toBe(mode);
  });
  it('[ ] und - + ändern die Grösse; [ ] auch mit AltGr (Schweizer Tastatur: Strg + Alt)', () => {
    const size = () => useUi.getState().brush.size;
    useUi.getState().setBrush({ size: 100 });
    for (const [k, mods, dir] of [[']', {}, 1], ['[', {}, -1], ['+', {}, 1], ['-', {}, -1], [']', { ctrlKey: true, altKey: true, altGr: true }, 1], ['[', { ctrlKey: true, altKey: true, altGr: true }, -1]] as const) {
      const before = size();
      expect(key(k, mods), k).toBe(true);
      expect(Math.sign(size() - before), k).toBe(dir);
    }
  });
  it('Strg + Plus zoomt weiter, ändert die Pinselgrösse nicht', () => {
    const size = useUi.getState().brush.size;
    key('+', { ctrlKey: true });
    expect(useUi.getState().brush.size).toBe(size);
    expect(useUi.getState().zoom).toBe(1.25);
  });
  it('ohne Pinselmodus tun X und [ nichts', () => {
    useUi.getState().setMaskEditId(null);
    const { brush } = useUi.getState();
    expect(key('x')).toBe(false);
    expect(key('[')).toBe(false);
    expect(useUi.getState().brush).toEqual(brush);
  });
  it('Esc verlässt den Pinselmodus, die Auswahl bleibt', () => {
    key('Escape');
    expect(useUi.getState()).toMatchObject({ maskEditId: null, selectedId: 'a' });
  });
});

const at = (id: string) => useDoc.getState().project!.elements[id]!;
const count = () => Object.keys(useDoc.getState().project!.elements).length;
describe('Mehrfachauswahl und Pfeile', () => {
  it('Strg + A wählt alle wählbaren der Slide', () => {
    expect(press(['Strg', 'a'])).toBe(true);
    expect(useUi.getState().selectedIds).toEqual(['a', 'b']);
  });
  it('Strg + A im Textfeld lässt den Browser machen', () => {
    expect(press(['Strg', 'a'], new FakeEl('TEXTAREA'))).toBe(false);
    expect(useUi.getState().selectedIds).toEqual(['a']);
  });
  it('Pfeil rechts: 1, mit Umschalt 10, auf der ganzen Auswahl', () => {
    useUi.setState({ selectedIds: ['a', 'b'] });
    expect(press(['ArrowRight'])).toBe(true);
    press(['Umschalt', 'ArrowDown']);
    expect([at('a').x, at('a').y, at('b').x, at('b').y]).toEqual([11, 20, 51, 60]);
  });
  it('Pfeil auf Body bewegt, auf Regler, Zahlenfeld und Bibliothek nicht', () => {
    expect(press(['ArrowRight'], document.body)).toBe(true);
    expect(press(['ArrowRight'], new FakeEl('DIV', ['canvas-scroll']))).toBe(true);
    expect(press(['ArrowRight'], new FakeEl('CANVAS'))).toBe(true);
    expect(at('a').x).toBe(13);
    // Bedienelemente, auch solche innerhalb der Leinwand (Regler, Zahlenfeld, Knopf, Bibliothek)
    for (const t of [new FakeInput('range'), new FakeInput('number'), new FakeEl('BUTTON'), new FakeEl('DIV', ['library'])]) {
      expect(press(['ArrowRight'], t)).toBe(false);
    }
    expect(at('a').x).toBe(13);
  });
  it('Alt + Pfeil und Pfeil ohne Auswahl bewegen nichts', () => {
    expect(press(['Alt', 'ArrowLeft'])).toBe(false);
    useUi.setState({ selectedIds: [], selectedId: null });
    expect(press(['ArrowLeft'])).toBe(false);
    expect(at('a').x).toBe(10);
  });
  it('Entf und Strg + D wirken auf die ganze Auswahl', () => {
    useUi.setState({ selectedIds: ['a', 'b'] });
    press(KEYS.duplicate);
    expect(count()).toBe(4);
    useUi.setState({ selectedIds: ['a', 'b'] });
    press(KEYS.remove);
    expect(count()).toBe(2);
  });
});

describe('copy/cut/paste als DOM-Ereignisse', () => {
  it('Abmelden entfernt alle Listener', () => {
    expect(Object.keys(handlers).sort()).toEqual(['copy', 'cut', 'keydown', 'paste']);
    stop();
    expect(Object.keys(handlers)).toEqual([]);
    stop = installShortcuts();
  });
  const ev = (target: unknown = null) => {
    const data: Record<string, string> = {};
    return { target, data, files: [], preventDefault: vi.fn(), clipboardData: { files: [], setData: (t: string, v: string) => (data[t] = v), getData: (t: string) => data[t] ?? '' } };
  };
  it('copy setzt den Marker, paste fügt auf der aktuellen Slide ein', () => {
    const c = ev();
    handlers.copy!(c);
    expect(c.preventDefault).toHaveBeenCalled();
    expect(c.data['text/plain']).toMatch(/^bbzb-social-studio:/);
    const p = ev();
    p.clipboardData.getData = () => c.data['text/plain']!;
    handlers.paste!(p);
    expect(count()).toBe(3);
  });
  it('cut entfernt die Auswahl', () => {
    handlers.cut!(ev());
    expect(Object.keys(useDoc.getState().project!.elements)).toEqual(['b']);
  });
  it('ohne Auswahl bleibt copy/cut unberührt; beim Tippen alle drei', () => {
    useUi.setState({ selectedIds: [], selectedId: null });
    const c = ev();
    handlers.copy!(c);
    handlers.cut!(c);
    expect(c.preventDefault).not.toHaveBeenCalled();
    useUi.setState({ selectedIds: ['a'], selectedId: 'a' });
    const t = ev(new FakeEl('TEXTAREA'));
    handlers.copy!(t);
    handlers.cut!(t);
    handlers.paste!(t);
    expect(t.preventDefault).not.toHaveBeenCalled();
    expect(count()).toBe(2);
  });
});
