import { expect, it } from 'vitest';
import { presetName, presets } from './presets';
import { parseOptionen } from './ziehen';

it('presetName macht aus dem Dateinamen eine Beschriftung', () => {
  expect(presetName('../presets/klasse-beispiel.txt')).toBe('Klasse beispiel');
  expect(presetName('x/ja_nein.txt')).toBe('Ja nein');
});

it('jede Vorlage im Repo hat 2 bis 100 Optionen ohne Kürzung', () => {
  expect(presets.length).toBeGreaterThan(0);
  for (const p of presets) {
    const r = parseOptionen(p.text);
    expect(r.optionen.length, p.name).toBeGreaterThanOrEqual(2);
    expect(r.gekuerzt, p.name).toBe(false);
  }
});
