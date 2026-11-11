import { describe, expect, it } from 'vitest';
import { photoPropsSchema } from '../plugins/elements/photo/schema';
import { el, project } from './fixtures';
import { parseProject } from './parse';
import { duplicateProject } from './slides';
import type { Project } from './types';

const H = 'a'.repeat(64);
const base = (): Project => ({
  ...project(2, [el({ id: 'f', type: 'photo', props: { assetId: H, crop: { x: 0, y: 0, scale: 1 } } })]),
  name: 'Sporttag',
  assets: { [H]: { mime: 'image/jpeg', width: 10, height: 10, name: 'a.jpg' } },
});

describe('duplicateProject', () => {
  it('neue ID, Name mit « (Kopie)», Zeiten = now, Rest gleich', () => {
    const p = base();
    const d = duplicateProject(p, 99);
    expect(d.id).not.toBe(p.id);
    expect(d.name).toBe('Sporttag (Kopie)');
    expect([d.createdAt, d.updatedAt]).toEqual([99, 99]);
    expect({ ...d, id: p.id, name: p.name, createdAt: 0, updatedAt: 0 }).toEqual(p);
  });

  it('ist eine tiefe Kopie', () => {
    const p = base();
    const d = duplicateProject(p);
    d.elements.f!.x = 500;
    d.slides[0]!.background = 'blau';
    delete d.assets[H];
    expect(p.elements.f!.x).toBe(0);
    expect(p.slides[0]!.background).toBe('warmweiss');
    expect(p.assets[H]).toBeDefined();
  });

  it('kürzt lange Namen auf 200 Zeichen, bleibt gültig', () => {
    const d = duplicateProject({ ...base(), name: 'x'.repeat(200) });
    expect(d.name).toHaveLength(200);
    expect(() => parseProject(d, (t) => (t === 'photo' ? photoPropsSchema : undefined))).not.toThrow();
  });
});
