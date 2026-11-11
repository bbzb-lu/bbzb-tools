import { beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '../core/types';
import { useUi } from '../store/ui';
import { pasteInto, textMenuItems } from './textMenu';

const field = {} as HTMLElement; // run wird hier nicht aufgerufen
const named = (items: MenuItem[]) => items.flatMap((i) => ('separator' in i ? [] : [i]));
const state = (s: Partial<{ selected: boolean; editable: boolean; empty: boolean }>) =>
  Object.fromEntries(named(textMenuItems({ selected: true, editable: true, empty: false, ...s }, field)).map((i) => [i.label, i.disabled]));

describe('textMenuItems', () => {
  it('Ausschneiden, Kopieren, Einfügen, Alles auswählen mit Kürzeln', () => {
    const items = named(textMenuItems({ selected: true, editable: true, empty: false }, field));
    expect(items.map((i) => i.label)).toEqual(['Ausschneiden', 'Kopieren', 'Einfügen', 'Alles auswählen']);
    expect(items.map((i) => i.keys)).toEqual(['Strg+X', 'Strg+C', 'Strg+V', 'Strg+A']);
    expect(items.every((i) => !i.disabled)).toBe(true);
  });
  it('ohne markierten Text: Ausschneiden und Kopieren gesperrt, mit Grund', () => {
    const s = state({ selected: false });
    expect(s['Ausschneiden']).toBeTruthy();
    expect(s['Kopieren']).toBeTruthy();
    expect(s['Einfügen']).toBeUndefined();
    expect(s['Alles auswählen']).toBeUndefined();
  });
  it('schreibgeschütztes Feld: Ausschneiden und Einfügen gesperrt, Kopieren frei', () => {
    const s = state({ editable: false });
    expect(s['Ausschneiden']).toBeTruthy();
    expect(s['Einfügen']).toBeTruthy();
    expect(s['Kopieren']).toBeUndefined();
  });
  it('leeres Feld: Alles auswählen gesperrt', () => {
    expect(state({ empty: true, selected: false })['Alles auswählen']).toBeTruthy();
  });
});

describe('pasteInto', () => {
  const setup = (o: { connected?: boolean; focusable?: boolean; inserted?: boolean } = {}) => {
    const calls: string[] = [];
    const doc = { activeElement: null as unknown, execCommand: (_c: string, _u: boolean, v: string) => (calls.push(v), o.inserted ?? true) };
    const f = { isConnected: o.connected ?? true, focus: () => void (o.focusable !== false && (doc.activeElement = f)) } as unknown as HTMLElement;
    return { f, doc: doc as unknown as Document, calls };
  };
  const notice = () => useUi.getState().notice?.text;
  beforeEach(() => useUi.getState().setNotice(null));

  it('fügt am fokussierten Feld ein', async () => {
    const { f, doc, calls } = setup();
    await pasteInto(f, async () => 'Neu', doc);
    expect(calls).toEqual(['Neu']);
    expect(notice()).toBeUndefined();
  });
  it('abgelehnt: Hinweis, nichts eingefügt', async () => {
    const { f, doc, calls } = setup();
    await pasteInto(f, () => Promise.reject(new Error('denied')), doc);
    expect(calls).toEqual([]);
    expect(notice()).toBe('Einfügen: drücke Strg + V.');
  });
  it('leere Zwischenablage (z. B. ein Bild): nichts tun, die Markierung bleibt', async () => {
    const { f, doc, calls } = setup();
    await pasteInto(f, async () => '', doc);
    expect(calls).toEqual([]);
    expect(notice()).toBeUndefined();
  });
  it('Feld inzwischen weg, Fokus anderswo oder Einfügen scheitert: Hinweis, nie in ein anderes Feld', async () => {
    for (const o of [{ connected: false }, { focusable: false }, { inserted: false }]) {
      useUi.getState().setNotice(null);
      const { f, doc, calls } = setup(o);
      await pasteInto(f, async () => 'Neu', doc);
      expect(calls.length, JSON.stringify(o)).toBe(o.inserted === false ? 1 : 0);
      expect(notice(), JSON.stringify(o)).toBe('Einfügen: drücke Strg + V.');
    }
  });
});
