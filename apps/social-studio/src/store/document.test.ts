import { beforeEach, describe, expect, it } from 'vitest';
import { project } from '../model/fixtures';
import { ModelError } from '../model/slides';
import {
  apply, endGesture, load, redo, startGesture, undo, useDoc,
} from './document';
import { useUi } from './ui';

const name = () => useDoc.getState().project!.name;
const past = () => useDoc.temporal.getState().pastStates.length;
const future = () => useDoc.temporal.getState().futureStates.length;

beforeEach(() => {
  load({ ...project(2), name: 'Start' });
});

describe('useDoc', () => {
  it('apply = ein Undo-Schritt, Auswahl nicht in History', () => {
    useUi.getState().setSelectedId('x');
    apply((d) => { d.name = 'a'; });
    expect(past()).toBe(1);
    expect(useDoc.getState().project!.updatedAt).toBeGreaterThan(0);
    undo();
    expect(name()).toBe('Start');
    expect(past()).toBe(0);
    expect(future()).toBe(1);
    redo();
    expect(name()).toBe('a');
    expect(useUi.getState().selectedId).toBe('x');
  });

  it('Geste mit drei apply = ein Undo-Schritt zurück auf den Stand vor der Geste', () => {
    startGesture();
    startGesture(); // verschachtelt: ignoriert
    apply((d) => { d.name = 'a'; });
    apply((d) => { d.name = 'b'; });
    apply((d) => { d.name = 'c'; });
    endGesture();
    expect(past()).toBe(1);
    undo();
    expect(name()).toBe('Start');
    redo();
    expect(name()).toBe('c');
  });

  it('Geste ohne Änderung und endGesture ohne Start legen nichts an', () => {
    endGesture();
    startGesture();
    endGesture();
    expect(past()).toBe(0);
  });

  it('Geste leert die Redo-Liste', () => {
    apply((d) => { d.name = 'a'; });
    undo();
    expect(future()).toBe(1);
    startGesture();
    apply((d) => { d.name = 'b'; });
    endGesture();
    expect(future()).toBe(0);
  });

  it('apply mit ModelError lässt Projekt und History unverändert', () => {
    const before = useDoc.getState().project;
    expect(() => apply((d) => { d.name = 'x'; throw new ModelError('nein'); })).toThrow(ModelError);
    expect(useDoc.getState().project).toBe(before);
    expect(past()).toBe(0);
  });

  it('load leert die History', () => {
    apply((d) => { d.name = 'a'; });
    load({ ...project(1), name: 'Neu' });
    expect(past()).toBe(0);
    expect(past()).toBe(0);
    expect(name()).toBe('Neu');
  });

  it('History ist auf 100 Schritte begrenzt', () => {
    for (let i = 0; i < 105; i++) apply((d) => { d.name = `n${i}`; });
    expect(past()).toBe(100);
  });

  it('load während einer Geste verwirft die Geste', () => {
    startGesture();
    apply((d) => { d.name = 'alt'; });
    load({ ...project(1), name: 'other' });
    apply((d) => { d.name = 'neu'; });
    endGesture();
    expect(past()).toBe(1);
    undo();
    expect(name()).toBe('other');
  });

  it('undo und redo sind während einer Geste wirkungslos', () => {
    apply((d) => { d.name = 'a'; });
    startGesture();
    apply((d) => { d.name = 'b'; });
    undo();
    expect(name()).toBe('b');
    redo();
    expect(name()).toBe('b');
    endGesture();
    expect(past()).toBe(2);
    undo();
    expect(name()).toBe('a');
  });

  it('load eines anderen Projekts setzt Auswahl, Slide und Modi zurück, Neuladen desselben nicht', () => {
    useUi.setState({ selectedIds: ['x'], selectedId: 'x', currentSlide: 2, cropEditId: 'x', textEditId: 'y' });
    load({ ...project(2), name: 'Start' }); // gleiche ID
    expect(useUi.getState().currentSlide).toBe(2);
    load({ ...project(1), id: 'anders' });
    expect(useUi.getState()).toMatchObject({ selectedId: null, currentSlide: 0, cropEditId: null, textEditId: null });
  });
});
