import { describe, expect, it } from 'vitest';
import { MAX_OPTIONEN, parseOptionen, ziehe } from './ziehen';

describe('parseOptionen', () => {
  it('trimmt, entfernt leere und doppelte Zeilen, versteht \\r\\n', () => {
    expect(parseOptionen('A\r\n\r\n B \nA\n')).toEqual({ optionen: ['A', 'B'], gekuerzt: false });
  });
  it('ignoriert ein BOM', () => {
    expect(parseOptionen('﻿A\nB').optionen).toEqual(['A', 'B']);
  });
  it('kürzt auf MAX_OPTIONEN', () => {
    const text = Array.from({ length: 150 }, (_, i) => `O${i}`).join('\n');
    const r = parseOptionen(text);
    expect(r.optionen).toHaveLength(MAX_OPTIONEN);
    expect(r.gekuerzt).toBe(true);
  });
});

describe('ziehe', () => {
  it('liefert verschiedene Indizes im Bereich', () => {
    const r = ziehe(5, 3);
    expect(new Set(r).size).toBe(3);
    expect(r.every((i) => i >= 0 && i < 5)).toBe(true);
  });
  it('begrenzt die Anzahl und kommt mit 0 Optionen klar', () => {
    expect(ziehe(2, 9)).toHaveLength(2);
    expect(ziehe(0, 3)).toEqual([]);
  });
  it('zieht deterministisch von vorn mit festem Zufall', () => {
    expect(ziehe(4, 2, () => 0)).toEqual([0, 1]);
  });
  it('ist grob gleichverteilt', () => {
    const n = [0, 0, 0];
    for (let i = 0; i < 6000; i++) n[ziehe(3, 1)[0]!]! += 1;
    for (const c of n) {
      expect(c).toBeGreaterThan(1700);
      expect(c).toBeLessThan(2300);
    }
  });
});
