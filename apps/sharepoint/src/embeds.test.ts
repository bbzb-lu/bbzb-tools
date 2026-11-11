import { describe, expect, it } from 'vitest';
import { code, datum, liste, nachName } from './embeds';

describe('embeds', () => {
  it('sechs Embeds ohne Vorlage, neueste zuerst', () => {
    expect(liste.map((e) => e.id).sort()).toEqual(['pomodoro-timer', 'radio-player', 'suchspiel-auswertung', 'sudoku', 'tictactoe', 'viergewinnt']);
    const d = liste.map((e) => e.datum);
    expect(d).toEqual([...d].sort().reverse());
  });
  it('nach Name sortiert', () => {
    const n = nachName(liste).map((e) => e.name);
    expect(n).toEqual([...n].sort((a, b) => a.localeCompare(b, 'de')));
  });
  it('Einbettungscode: Adresse, 480 × 350, Titel; clipboard-write nur bei Sudoku', () => {
    const s = code(liste.find((e) => e.id === 'sudoku')!, 'https://bbzb-tools.pages.dev');
    expect(s).toBe('<iframe src="https://bbzb-tools.pages.dev/sharepoint/sudoku/" width="480" height="350" style="border:0;overflow:hidden" title="Sudoku" allow="clipboard-write"></iframe>');
    expect(code(liste.find((e) => e.id === 'tictactoe')!, 'https://x.test')).not.toContain('allow=');
  });
  it('Datum schweizerisch', () => expect(datum('2026-08-10')).toBe('10.08.2026'));
});
