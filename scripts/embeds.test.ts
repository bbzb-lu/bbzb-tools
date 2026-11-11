import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { embedOrdner, fehlendeVerweise } from './embeds.mjs';

const alle = (dir: string): string[] => readdirSync(dir, { recursive: true, encoding: 'utf8' });

describe('embeds', () => {
  it('jeder Verweis auf Bild, Schrift, CSS oder JS zeigt auf eine Datei', () => {
    expect(fehlendeVerweise('embeds')).toEqual([]);
  });
  it('die sechs Embeds sind da, je mit index.html und gültigem embed.json', () => {
    expect(embedOrdner('embeds').sort()).toEqual(['pomodoro-timer', 'radio-player', 'suchspiel-auswertung', 'sudoku', 'tictactoe', 'viergewinnt']);
    for (const id of embedOrdner('embeds')) {
      expect(readdirSync(`embeds/${id}`)).toContain('index.html');
      const e = JSON.parse(readFileSync(`embeds/${id}/embed.json`, 'utf8'));
      expect(e.name, id).toBeTruthy();
      expect(e.datum, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.satz.length, id).toBeLessThanOrEqual(90);
      expect(e.satz, id).not.toMatch(/[–ß]/);
    }
  });
  it('nur Sudoku und Radio laden von aussen', () => {
    const extern = embedOrdner('embeds').filter((id) => JSON.parse(readFileSync(`embeds/${id}/embed.json`, 'utf8')).extern);
    expect(extern.sort()).toEqual(['radio-player', 'sudoku']);
  });
  it('Dateinamen in NFC, kein Mac-Müll, keine Quelldateien', () => {
    for (const f of alle('embeds')) {
      expect(f, f).toBe(f.normalize('NFC'));
      expect(f).not.toMatch(/\.DS_Store$|\.aseprite$|node_modules/);
    }
  });
});
