/* eslint-disable @typescript-eslint/no-explicit-any -- Tests mutieren bewusst beliebig kaputte JSON-Strukturen */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { photoPropsSchema } from '../plugins/elements/photo/schema';
import { textPropsSchema } from '../plugins/elements/text/schema';
import { el, project } from './fixtures';
import { parseProject, ProjectFileError } from './parse';
import type { Project } from './types';

const lookup = (t: string): z.ZodType | undefined =>
  t === 'photo' ? photoPropsSchema : t === 'text' ? textPropsSchema : undefined;
const H = 'a'.repeat(64);
const textProps = { text: 'Hi', style: 'titel', color: 'blau', fontSize: 100, align: 'left' };
const base = (): Project => ({
  ...project(2, [
    el({ id: 't', type: 'text', props: textProps }),
    el({ id: 'f', type: 'photo', props: { assetId: H, crop: { x: 0, y: 0, scale: 1 } } }),
  ]),
  assets: { [H]: { mime: 'image/jpeg', width: 10, height: 10, name: 'a.jpg' } },
});
const mut = (f: (p: any) => void) => {
  const p = structuredClone(base()) as any;
  f(p);
  return p;
};
const DAMAGED = 'Die Projektdatei ist beschädigt.';

describe('parseProject', () => {
  it('akzeptiert ein gültiges Projekt', () => {
    expect(parseProject(base(), lookup)).toEqual(base());
  });

  it('behält die Platzhalter-Rolle; leerer Foto-Platzhalter (ohne assetId) ist gültig', () => {
    const p = mut((d) => {
      d.elements.f.role = 'foto';
      delete d.elements.f.props.assetId;
    });
    const r = parseProject(p, lookup);
    expect(r.elements.f!.role).toBe('foto');
    expect(r.elements.f!.props).toEqual({ crop: { x: 0, y: 0, scale: 1 } });
  });

  it('behält das Layout der Slide; fehlt es, bleibt die Slide ohne (Ruling R6, R8)', () => {
    const r = parseProject(mut((d) => (d.slides[0].layout = 'panorama')), lookup);
    expect(r.slides[0]!.layout).toBe('panorama');
    expect(r.slides[1]!.layout).toBeUndefined();
    expect(() => parseProject(mut((d) => (d.slides[0].layout = 7)), lookup)).toThrow(DAMAGED);
    expect(() => parseProject(mut((d) => (d.slides[0].layout = '')), lookup)).toThrow(DAMAGED);
  });

  it('behält «Bitte prüfen» der Slide; fehlt es, bleibt die Slide ohne (Ruling R8)', () => {
    const r = parseProject(mut((d) => (d.slides[0].review = true)), lookup);
    expect(r.slides[0]!.review).toBe(true);
    expect(r.slides[1]!.review).toBeUndefined();
    expect(() => parseProject(mut((d) => (d.slides[0].review = 'ja')), lookup)).toThrow(DAMAGED);
  });

  it('Slide.link bleibt, Nicht-String ist beschädigt', () => {
    const r = parseProject(mut((d) => (d.slides[0].link = 'k1')), lookup);
    expect(r.slides[0]!.link).toBe('k1');
    expect(r.slides[1]!.link).toBeUndefined();
    expect(() => parseProject(mut((d) => (d.slides[0].link = 7)), lookup)).toThrow(DAMAGED);
    expect(() => parseProject(mut((d) => (d.slides[0].link = '')), lookup)).toThrow(DAMAGED);
  });

  it('behält das Korn der Slide; fehlt es, bleibt die Slide ohne (aus)', () => {
    const r = parseProject(mut((d) => Object.assign(d.slides[0], { grain: true })), lookup);
    expect(r.slides[0]).toMatchObject({ grain: true });
    expect(r.slides[1]).toEqual(base().slides[1]);
    expect(() => parseProject(mut((d) => (d.slides[0].grain = 1)), lookup)).toThrow(DAMAGED);
  });

  it('Korn-Stärke der Slide (4c.1): fehlt = Standard (kein Feld geschrieben), 0 bis 100 ganzzahlig bleibt, sonst beschädigt', () => {
    expect(parseProject(mut((d) => Object.assign(d.slides[0], { grain: true })), lookup).slides[0]).not.toHaveProperty('grainStrength');
    expect(parseProject(mut((d) => Object.assign(d.slides[0], { grain: true, grainStrength: 75 })), lookup).slides[0]).toMatchObject({ grain: true, grainStrength: 75 });
    for (const bad of [-1, 101, 2.5, '40']) expect(() => parseProject(mut((d) => Object.assign(d.slides[0], { grain: true, grainStrength: bad })), lookup)).toThrow(DAMAGED);
  });

  it('Slide-Verläufe aus 2.1/2.2 fallen beim Öffnen weg (Entscheid Phase 2.3), das Projekt öffnet weiter', () => {
    const r = parseProject(mut((d) => Object.assign(d.slides[0], { grain: true, verlaufOben: true, verlaufUnten: 1 })), lookup);
    expect(r.slides[0]).toEqual({ ...base().slides[0], grain: true });
  });

  it('Slide-Verläufe (Phase 2.8): fehlen = keine, gültige bleiben erhalten, ungültige Seite oder mehr als vier lehnen ab', () => {
    expect(parseProject(base(), lookup).slides[0]!.scrims).toBeUndefined();
    const scrims = [{ side: 'unten', strength: 'stark' }, { side: 'obenLinks', strength: 'leicht', reach: 80, light: true }];
    const r = parseProject(mut((d) => (d.slides[0].scrims = scrims)), lookup);
    expect(r.slides[0]!.scrims).toEqual(scrims);
    expect(parseProject(JSON.parse(JSON.stringify(r)), lookup)).toEqual(r);
    expect(() => parseProject(mut((d) => (d.slides[0].scrims = [{ side: 'mitte', strength: 'stark' }])), lookup)).toThrow(DAMAGED);
    expect(() => parseProject(mut((d) => (d.slides[0].scrims = Array(5).fill(scrims[0]))), lookup)).toThrow(DAMAGED);
  });

  it('Rolle muss ein kurzer Text sein', () => {
    expect(() => parseProject(mut((d) => (d.elements.f.role = 5)), lookup)).toThrow(DAMAGED);
    expect(() => parseProject(mut((d) => (d.elements.f.role = 'x'.repeat(51))), lookup)).toThrow(DAMAGED);
  });

  it.each([
    ['NaN', (p: any) => (p.elements.t.x = NaN)],
    ['Breite 0', (p: any) => (p.elements.t.width = 0)],
    ['Höhe negativ', (p: any) => (p.elements.t.height = -1)],
    ['Format nicht ganzzahlig', (p: any) => (p.format.width = 10.5)],
    ['Format 0', (p: any) => (p.format.height = 0)],
    ['Asset-Breite 0', (p: any) => (p.assets[H].width = 0)],
    ['Schlüssel ≠ id', (p: any) => (p.elements.t.id = 'x')],
    ['doppelte Slide-ID', (p: any) => (p.slides[1].id = p.slides[0].id)],
    ['Hintergrund unbekannt', (p: any) => (p.slides[0].background = 'rot')],
    ['Deckkraft 2', (p: any) => (p.elements.t.opacity = 2)],
    ['keine Slides', (p: any) => (p.slides = [])],
    ['21 Slides', (p: any) => (p.slides = project(21).slides)],
    ['order enthält Unbekanntes', (p: any) => p.order.push('zz')],
    ['order fehlt Element', (p: any) => p.order.pop()],
    ['order mit Prototyp-Schlüssel', (p: any) => (p.order = ['t', 'toString'])],
    ['uppercase assetId', (p: any) => (p.elements.f.props.assetId = H.toUpperCase())],
    ['name zu lang', (p: any) => (p.name = 'x'.repeat(201))],
    ['Element-ID zu lang', (p: any) => (p.slides[0].id = 'x'.repeat(101))],
    ['order doppelt', (p: any) => (p.order = ['t', 't'])],
    ['ungültige Props', (p: any) => (p.elements.t.props.fontSize = 2)],
    ['Foto-Asset fehlt', (p: any) => (p.assets = {})],
    ['kein Objekt', (p: any) => Object.keys(p).forEach((k) => delete p[k])],
  ])('%s → beschädigt', (_n, f) => {
    expect(() => parseProject(mut(f), lookup)).toThrow(new ProjectFileError(DAMAGED));
  });

  it('Infinity (1e999 im JSON-Text) → beschädigt', () => {
    const txt = JSON.stringify(base()).replace('"x":0', '"x":1e999');
    expect(() => parseProject(JSON.parse(txt), lookup)).toThrow(DAMAGED);
  });

  it('Lookup liefert Unsinn oder wirft', () => {
    expect(() => parseProject(base(), (() => ({})) as never)).toThrow(DAMAGED);
    expect(() =>
      parseProject(base(), () => {
        throw new Error('x');
      }),
    ).toThrow('Die Projektdatei enthält einen unbekannten Inhalt.');
  });

  it('null → beschädigt', () => {
    expect(() => parseProject(null, lookup)).toThrow(DAMAGED);
  });

  it('unbekannter Typ', () => {
    expect(() => parseProject(mut((p) => (p.elements.t.type = 'video')), lookup)).toThrow(
      'Die Projektdatei enthält einen unbekannten Inhalt.',
    );
  });

  it('neuere Version', () => {
    expect(() => parseProject(mut((p) => (p.schemaVersion = 2)), lookup)).toThrow(
      'Diese Projektdatei stammt aus einer neueren Version der App.',
    );
  });
});

describe('channel (optional, Ruling R8)', () => {
  it('fehlt in alten Projekten, bleibt sonst erhalten, unbekannter Kanal ist ungültig', () => {
    expect(parseProject(base(), lookup)).not.toHaveProperty('channel');
    expect(parseProject({ ...base(), channel: 'linkedin' }, lookup).channel).toBe('linkedin');
    expect(() => parseProject({ ...base(), channel: 'tiktok' }, lookup)).toThrow(ProjectFileError);
  });
});

describe('lastTagLocation (optional, Ruling R8)', () => {
  it('fehlt in alten Projekten, bleibt sonst erhalten', () => {
    expect(parseProject(base(), lookup)).not.toHaveProperty('lastTagLocation');
    expect(parseProject({ ...base(), lastTagLocation: 'Heimbach' }, lookup).lastTagLocation).toBe('Heimbach');
    expect(() => parseProject({ ...base(), lastTagLocation: 5 }, lookup)).toThrow(ProjectFileError);
  });
});

describe('accentMode (optional, Phase 2.5, Ruling R8)', () => {
  it('fehlt in alten Projekten, bleibt sonst erhalten, unbekannter Modus ist ungültig', () => {
    expect(parseProject(base(), lookup)).not.toHaveProperty('accentMode');
    expect(parseProject({ ...base(), accentMode: 'standort' }, lookup).accentMode).toBe('standort');
    expect(parseProject({ ...base(), accentMode: 'fix' }, lookup).accentMode).toBe('fix');
    expect(() => parseProject({ ...base(), accentMode: 'bunt' }, lookup)).toThrow(ProjectFileError);
  });

  it('Altprojekt mit Elementfarbe orange lädt unverändert; «akzent» ist eine gültige Elementfarbe', () => {
    const old = mut((d) => (d.elements.t.props.color = 'orange'));
    expect(parseProject(old, lookup)).toEqual(old);
    expect(parseProject(mut((d) => (d.elements.t.props.color = 'akzent')), lookup).elements.t!.props).toMatchObject({ color: 'akzent' });
    expect(() => parseProject(mut((d) => (d.elements.t.props.color = '#8ED8F8')), lookup)).toThrow(ProjectFileError);
  });

  it('Slide-Hintergrund bleibt eine feste Palettenfarbe, nie «akzent»', () => {
    expect(() => parseProject(mut((d) => (d.slides[0].background = 'akzent')), lookup)).toThrow(ProjectFileError);
  });
});
