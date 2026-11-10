import { describe, expect, it } from 'vitest';
import type { LayoutPreset } from '../core/types';
import { el, project } from './fixtures';
import { applyLayout, type ContentRules } from './layout';
import type { Element } from './types';

// Eigene Datei, weil layout.test.ts an die 400 Zeilen stösst.

const scribble = { type: 'brand', role: 'scribble', name: 'Pfeil' } as const;
const abschluss: LayoutPreset = {
  id: 'abschluss',
  label: 'Abschluss',
  format: 'post',
  slides: 1,
  background: 'warmweiss',
  elements: [{ ...scribble, x: 420, y: 821.5, width: 236, height: 107, props: { brandId: 'scribble-05', color: 'akzent', flipX: true } }],
};
const vollbild: LayoutPreset = {
  id: 'vollbild',
  label: 'Vollbild',
  format: 'post',
  slides: 1,
  background: 'blau',
  elements: [{ ...scribble, x: 765.1, y: 329.6, width: 195, height: 89, rotation: 128, props: { brandId: 'scribble-05', color: 'akzent' } }],
};
const presets: Record<string, LayoutPreset> = { abschluss, vollbild };

/** Scribbles sind Deko (kein take), Fresh-Flag wird mitgeschrieben. */
const rules = (seen: boolean[] = []): ContentRules => ({
  fit: (e, _p, fresh) => {
    seen.push(fresh);
    return e;
  },
  hasContent: (e) => e.type !== 'brand',
  take: () => undefined,
  layout: (id) => presets[id],
  isEmpty: () => false,
});

describe('Layoutwechsel mit Projekten aus 2.4', () => {
  it('Scribble in «orange» aus dem Layout gilt als unverändert (Layout sagt heute «akzent») und wird ersetzt, nicht verdoppelt', () => {
    const old: Element = el({ id: 'old', ...scribble, x: 420, y: 821.5, width: 236, height: 107, props: { brandId: 'scribble-05', color: 'orange', flipX: true } });
    const p = project(1, [old]);
    p.slides[0]!.layout = 'abschluss';
    applyLayout(p, vollbild, 0, rules());
    const scribbles = Object.values(p.elements).filter((e) => e.role === 'scribble');
    expect(scribbles).toHaveLength(1);
    expect(p.elements.old).toBeUndefined();
  });

  it('ein von Hand blau gefärbtes Scribble bleibt', () => {
    const old: Element = el({ id: 'old', ...scribble, x: 420, y: 821.5, width: 236, height: 107, props: { brandId: 'scribble-05', color: 'blau', flipX: true } });
    const p = project(1, [old]);
    p.slides[0]!.layout = 'abschluss';
    applyLayout(p, vollbild, 0, rules());
    expect(p.elements.old).toBeDefined();
  });
});

describe('fit erfährt, ob ein Platzhalter frisch ist (Schul-Tag nimmt lastTagLocation)', () => {
  const tagPreset: LayoutPreset = {
    id: 'tagLayout',
    label: 'Tag',
    format: 'post',
    slides: 1,
    background: 'warmweiss',
    elements: [
      { type: 'tag', role: 'schulTag', name: 'Schul-Tag', x: 72, y: 72, width: 323, height: 62, props: { variant: 'schul', text: 'Bahnhof' } },
      { ...scribble, x: 420, y: 821.5, width: 236, height: 107, props: { brandId: 'scribble-05', color: 'akzent' } },
    ],
  };
  const withTake = (seen: (boolean | undefined)[]): ContentRules => ({
    ...rules(seen as boolean[]),
    take: (into, from) => (into.type === 'tag' ? { ...into, props: { ...(into.props as object), text: (from.props as { text: string }).text } } : undefined),
  });

  it('leere Slide: jeder Platzhalter frisch', () => {
    const seen: (boolean | undefined)[] = [];
    applyLayout(project(1), tagPreset, 0, withTake(seen));
    expect(seen).toEqual([true, true]);
  });

  it('ein Tag der Slide füllt den Platzhalter: nicht frisch; das Scribble bleibt frisch', () => {
    const seen: (boolean | undefined)[] = [];
    const tag = el({ id: 't', type: 'tag', role: 'schulTag', x: 72, y: 72, width: 300, height: 62, props: { variant: 'schul', text: 'Bahnhof' } });
    applyLayout(project(1, [tag]), tagPreset, 0, withTake(seen));
    expect(seen).toEqual([false, true]);
  });

  it('Vergleich mit dem bisherigen Layout rechnet es frisch', () => {
    const seen: (boolean | undefined)[] = [];
    const p = project(1);
    p.slides[0]!.layout = 'abschluss';
    applyLayout(p, vollbild, 0, withTake(seen));
    expect(seen).toEqual([true, true]); // abschluss (Vergleich), dann vollbild (leer)
  });
});
