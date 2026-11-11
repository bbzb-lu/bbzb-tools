import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brush } from '../tokens';
import { readBackdrop, useUi } from './ui';

beforeEach(() => {
  useUi.setState({ selectedIds: [], selectedId: null, cropEditId: null, textEditId: null, maskEditId: null });
  useUi.getState().setBrush({ size: brush.size.default, hardness: brush.hardness.default, mode: 'hide' });
});

describe('Pinselmodus', () => {
  it('öffnen wählt das Foto allein, beendet Ausschnitt und Text', () => {
    useUi.setState({ selectedIds: ['a', 'b'], cropEditId: 'b', textEditId: 'b' });
    useUi.getState().setMaskEditId('a');
    expect(useUi.getState()).toMatchObject({ maskEditId: 'a', selectedIds: ['a'], selectedId: 'a', cropEditId: null, textEditId: null });
  });
  it('«Ausschnitt bearbeiten» und Textbearbeitung beenden den Pinselmodus', () => {
    useUi.getState().setMaskEditId('a');
    useUi.getState().setCropEditId('a');
    expect(useUi.getState()).toMatchObject({ maskEditId: null, cropEditId: 'a' });
    useUi.getState().setMaskEditId('a');
    expect(useUi.getState().cropEditId).toBeNull();
    useUi.getState().setTextEditId('a');
    expect(useUi.getState().maskEditId).toBeNull();
  });
  it('andere Auswahl (Klick auf ein anderes Element, ins Leere, Löschen) beendet ihn; dieselbe nicht', () => {
    const ui = () => useUi.getState();
    ui().setMaskEditId('a');
    ui().setSelectedIds(['a']);
    expect(ui().maskEditId).toBe('a');
    ui().setSelectedId('b');
    expect(ui().maskEditId).toBeNull();
    ui().setMaskEditId('a');
    ui().setSelectedIds(['a', 'b']);
    expect(ui().maskEditId).toBeNull();
    ui().setMaskEditId('a');
    ui().setSelectedIds([]);
    expect(ui().maskEditId).toBeNull();
  });
  it('Ansicht «Rote Folie» oder «Ergebnis»: Standard Folie, die Wahl gilt für die Sitzung, auch nach Verlassen und neuem Öffnen', () => {
    const ui = () => useUi.getState();
    ui().setMaskEditId('a');
    expect(ui().maskView).toBe('folie');
    ui().setMaskView('ergebnis');
    // Verlassen über jeden Weg, wieder öffnen: die Wahl bleibt
    for (const leave of [() => ui().setMaskEditId(null), () => ui().setSelectedId('b'), () => ui().setCropEditId('a'), () => useUi.setState({ maskEditId: null })]) {
      leave();
      expect(ui().maskEditId).toBeNull();
      ui().setMaskEditId('a');
      expect(ui().maskView).toBe('ergebnis');
    }
    ui().setMaskEditId('c'); // anderes Foto
    expect(ui().maskView).toBe('ergebnis');
    ui().setMaskView('folie');
    ui().setMaskEditId(null);
    ui().setMaskEditId('a');
    expect(ui().maskView).toBe('folie');
  });
});

describe('Pinselwerte', () => {
  it('Grösse bleibt zwischen Min und Max, Härte zwischen 0 und 100', () => {
    const ui = () => useUi.getState();
    ui().setBrush({ size: brush.size.max * 10, hardness: 300 });
    expect(ui().brush).toMatchObject({ size: brush.size.max, hardness: 100 });
    ui().setBrush({ size: 0, hardness: -5 });
    expect(ui().brush).toMatchObject({ size: brush.size.min, hardness: 0 });
    ui().setBrush({ size: Number.NaN });
    expect(ui().brush.size).toBe(brush.size.min);
  });
  it('Tastenschritt: grösser und kleiner, immer mindestens 1 px, an den Grenzen gestoppt', () => {
    const ui = () => useUi.getState();
    ui().setBrush({ size: brush.size.min });
    ui().stepBrush(1);
    expect(ui().brush.size).toBeGreaterThan(brush.size.min);
    ui().stepBrush(-1);
    expect(ui().brush.size).toBe(brush.size.min);
    ui().stepBrush(-1);
    expect(ui().brush.size).toBe(brush.size.min);
    for (let i = 0; i < 100; i++) ui().stepBrush(1);
    expect(ui().brush.size).toBe(brush.size.max);
  });
  it('Modus tauschen', () => {
    useUi.getState().swapBrushMode();
    expect(useUi.getState().brush.mode).toBe('show');
    useUi.getState().swapBrushMode();
    expect(useUi.getState().brush.mode).toBe('hide');
  });
});

describe('KI-Lauf', () => {
  it('Phasen laufen durch, zurücksetzen räumt auf', () => {
    const ui = () => useUi.getState();
    ui().setAi({ id: 'a', phase: 'download', fraction: 0 });
    ui().setAi({ id: 'a', phase: 'download', fraction: 0.4 });
    ui().setAi({ id: 'a', phase: 'run', fraction: 0 });
    expect(ui().ai).toEqual({ id: 'a', phase: 'run', fraction: 0 });
    ui().setAi(undefined);
    expect(ui().ai).toBeUndefined();
  });
});

describe('Unterlage (nur Ansicht, in localStorage gemerkt)', () => {
  const store = (get: (k: string) => string | null, set: (k: string, v: string) => void = () => {}) =>
    vi.stubGlobal('localStorage', { getItem: get, setItem: set });
  afterEach(() => vi.unstubAllGlobals());
  it('liest die gemerkte Wahl, sonst «grau»', () => {
    store(() => 'dunkel');
    expect(readBackdrop()).toBe('dunkel');
    store(() => null);
    expect(readBackdrop()).toBe('grau');
  });
  it('ungültiger Wert fällt auf «grau» zurück', () => {
    store(() => 'pink');
    expect(readBackdrop()).toBe('grau');
    store(() => 'toString');
    expect(readBackdrop()).toBe('grau');
  });
  it('gesperrter Speicher: Lesen und Schreiben werfen nie, die Wahl gilt trotzdem', () => {
    store(
      () => { throw new Error('SecurityError'); },
      () => { throw new Error('QuotaExceeded'); },
    );
    expect(readBackdrop()).toBe('grau');
    useUi.getState().setStageBackdrop('blau');
    expect(useUi.getState().stageBackdrop).toBe('blau');
  });
  it('Wahl wird gemerkt', () => {
    const set = vi.fn();
    store(() => null, set);
    useUi.getState().setStageBackdrop('gruen');
    expect(set).toHaveBeenCalledWith('social-studio.unterlage', 'gruen');
  });
});
