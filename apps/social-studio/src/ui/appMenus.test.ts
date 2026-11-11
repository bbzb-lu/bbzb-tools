import { beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '../core/types';
import { el, project } from '../model/fixtures';
import { apply, load, useDoc } from '../store/document';
import { appMenuItems, slideMenuItems } from './appMenus';
import { stepSlide } from './layoutActions';

const named = (items: MenuItem[]) => items.flatMap((i) => ('separator' in i ? [] : [i]));
const item = (items: MenuItem[], label: string) => named(items).find((i) => i.label === label)!;

beforeEach(() => load(project(3, [el({ id: 'a' })])));

describe('slideMenuItems', () => {
  it('mittlere Slide: alles frei', () => {
    const items = slideMenuItems(1);
    expect(named(items).map((i) => i.label)).toEqual(['Slide duplizieren', 'Nach links', 'Nach rechts', 'Slide löschen']);
    expect(named(items).every((i) => !i.disabled)).toBe(true);
  });
  it('an den Enden sind Nach links bzw. Nach rechts gesperrt, mit Grund', () => {
    expect(item(slideMenuItems(0), 'Nach links').disabled).toBeTruthy();
    expect(item(slideMenuItems(0), 'Nach rechts').disabled).toBeUndefined();
    expect(item(slideMenuItems(2), 'Nach rechts').disabled).toBeTruthy();
  });
  it('die letzte Slide lässt sich nicht löschen', () => {
    load(project(1));
    expect(item(slideMenuItems(0), 'Slide löschen').disabled).toBeTruthy();
  });
  it('Aktionen wirken auf die angeklickte Slide', () => {
    item(slideMenuItems(2), 'Slide löschen').run();
    expect(useDoc.getState().project!.slides).toHaveLength(2);
    item(slideMenuItems(0), 'Slide duplizieren').run();
    expect(useDoc.getState().project!.slides).toHaveLength(3);
  });
});

describe('appMenuItems', () => {
  it('Rückgängig und Wiederholen sind gesperrt, solange nichts da ist', () => {
    const items = appMenuItems();
    expect(named(items).map((i) => i.label)).toEqual(['Rückgängig', 'Wiederholen', 'Projektdatei sichern', 'Exportieren']);
    expect(item(items, 'Rückgängig').disabled).toBeTruthy();
    expect(item(items, 'Wiederholen').disabled).toBeTruthy();
    expect(item(items, 'Exportieren').keys).toBe('Strg+E');
  });
  it('nach einer Änderung ist Rückgängig frei', () => {
    apply((d) => void (d.name = 'neu'));
    expect(item(appMenuItems(), 'Rückgängig').disabled).toBeUndefined();
  });
});

describe('stepSlide', () => {
  it('meldet am Rand, dass nichts bewegt wurde', () => {
    expect(stepSlide(0, -1)).toBe(false);
    expect(stepSlide(2, 1)).toBe(false);
    expect(stepSlide(0, 1)).toBe(true);
  });
});
