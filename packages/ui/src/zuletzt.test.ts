import { beforeEach, describe, expect, it } from 'vitest';
import { merkeZuletzt, vergissZuletzt, zuletzt } from './zuletzt';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as Storage;
});

describe('zuletzt', () => {
  it('neuster Eintrag zuerst, gleiches Projekt nur einmal', () => {
    merkeZuletzt({ tool: 'social-studio', id: 'a', name: 'A', geaendert: 1 });
    merkeZuletzt({ tool: 'social-studio', id: 'b', name: 'B', geaendert: 2 });
    merkeZuletzt({ tool: 'social-studio', id: 'a', name: 'A neu', geaendert: 3 });
    expect(zuletzt().map((e) => e.name)).toEqual(['A neu', 'B']);
  });
  it('höchstens 8 Einträge', () => {
    for (let i = 0; i < 12; i++) merkeZuletzt({ tool: 't', id: String(i), name: String(i), geaendert: i });
    expect(zuletzt()).toHaveLength(8);
    expect(zuletzt()[0]!.id).toBe('11');
  });
  it('vergessen entfernt nur dieses Projekt', () => {
    merkeZuletzt({ tool: 'x', id: 'a', name: 'A', geaendert: 1 });
    merkeZuletzt({ tool: 'y', id: 'a', name: 'A', geaendert: 2 });
    vergissZuletzt('x', 'a');
    expect(zuletzt().map((e) => e.tool)).toEqual(['y']);
  });
  it('kaputter oder fremder Inhalt ergibt eine leere oder bereinigte Liste', () => {
    mem.set('bbzb-tools.zuletzt', '{kaputt');
    expect(zuletzt()).toEqual([]);
    mem.set('bbzb-tools.zuletzt', JSON.stringify([{ tool: 't', id: 'a', name: 'A', geaendert: 1 }, { tool: 1 }, null]));
    expect(zuletzt()).toHaveLength(1);
  });
  it('ohne Speicher (privates Fenster) wirft nichts', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('blockiert'); }, setItem: () => { throw new Error('blockiert'); } } as unknown as Storage;
    expect(() => merkeZuletzt({ tool: 't', id: 'a', name: 'A', geaendert: 1 })).not.toThrow();
    expect(zuletzt()).toEqual([]);
  });
});
