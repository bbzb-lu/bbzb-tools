import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const data = JSON.parse(readFileSync(join(__dirname, '../../brand/doodles/doodles.json'), 'utf8')) as Record<
  string,
  { c: string; w: number; h: number; p: string[]; t: string }
>;
const entries = Object.entries(data);

describe('brand/doodles/doodles.json', () => {
  it('hat 427 Doodles in 14 Kategorien, ohne «files»', () => {
    expect(entries.length).toBe(427);
    const cats = new Set(entries.map(([, d]) => d.c));
    expect(cats.size).toBe(14);
    expect(cats.has('files')).toBe(false);
    expect(cats.has('logos')).toBe(true);
  });

  it('Namen, Masse, Pfade und Stichwörter sind gültig', () => {
    for (const [name, { c, w, h, p, t }] of entries) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
      expect(c).toMatch(/^[a-z0-9-]+$/);
      expect(name.startsWith(c + '-')).toBe(true);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(p.length).toBeGreaterThan(0);
      for (const d of p) expect(d).toMatch(/^[0-9MmLlHhVvCcSsQqTtAaZz .,+eE-]+$/);
      expect(typeof t).toBe('string');
    }
  });

  // Eine Hintergrund- oder Clip-Fläche ist ein Pfad nur aus Geraden (M/L/H/V/Z, höchstens 5 Befehle),
  // der fast die ganze viewBox abdeckt. Handgezeichnete Formen haben immer Kurven oder viel mehr Punkte.
  const isBackground = (d: string, w: number, h: number) => {
    const cmds = d.match(/[a-zA-Z]/g) ?? [];
    if (cmds.length > 5 || cmds.some((k) => !'MLHVZmlhvz'.includes(k))) return false;
    const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    return Math.max(...n) - Math.min(...n) >= 0.9 * Math.min(w, h);
  };

  it('Prüfregel erkennt eine Hintergrundfläche (Selbstprüfung)', () => {
    expect(isBackground('M0 0H151V146H0Z', 151, 146)).toBe(true);
    expect(isBackground('M10 10H40V40H10Z', 151, 146)).toBe(false);
    expect(isBackground('M0 0C50 0 151 50 151 146L0 146Z', 151, 146)).toBe(false);
  });

  it('enthält keine Quell-Hintergrundfläche', () => {
    for (const [name, { w, h, p }] of entries) for (const d of p) expect(isBackground(d, w, h), `${name}: ${d}`).toBe(false);
  });
});
