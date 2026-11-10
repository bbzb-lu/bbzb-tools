import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { theme as uiTheme } from '@bbzb/ui';
import { applyStudioTheme, studioTheme, theme, type ThemeToken, uiFonts } from './theme';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: ThemeToken, b: ThemeToken) => {
  const [hi, lo] = [lum(theme[a]), lum(theme[b])].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// [Vordergrund, Fläche]: Text 4.5:1
const textPairs: [ThemeToken, ThemeToken][] = [
  ['ink', 'paper'], ['ink', 'paper-shade'], ['ink', 'table'], ['ink-soft', 'paper'], ['ink-soft', 'paper-shade'],
  ['ink-disabled', 'paper'], ['ink-disabled', 'paper-shade'], ['on-accent', 'accent'], ['paper', 'ink'], ['ink', 'riso-mustard'],
];
// Bedienelemente (Rahmen, Fokusring, Bahn, Akzentfläche): 3:1
const controlPairs: [ThemeToken, ThemeToken][] = [
  ['ink', 'paper'], ['ink', 'table'], ['ink-soft', 'paper'], ['ink-disabled', 'paper'], ['accent', 'paper'], ['accent', 'paper-shade'], ['ink', 'accent'],
  // Schreibmatte (Lineal, Passermarken): dunkel auf Grau, hell auf den dunklen Unterlagen
  ['ink-soft', 'unterlage-grau'], ['ink', 'unterlage-grau'],
  ...(['unterlage-dunkel', 'unterlage-gruen', 'unterlage-blau'] as const).flatMap((u): [ThemeToken, ThemeToken][] => [['paper', u], ['paper-shade', u]]),
];

describe('Kontrast der Oberflächen-Tokens', () => {
  it.each(textPairs)('Text %s auf %s >= 4.5', (fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it.each(controlPairs)('Bedienelement %s auf %s >= 3', (fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));
});

it('jede var(--x) in src/ui/*.css ist ein Theme-Token, eine Slide-Farbe, ein Reglermass oder lokal in CSS/TSX definiert', () => {
  const provided = new Set<string>();
  applyStudioTheme({ style: { setProperty: (n: string) => provided.add(n) } } as unknown as HTMLElement);
  const dir = __dirname;
  const css = readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const tsx = readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const local = new Set([...css.matchAll(/(--[a-z-]+)\s*:/g), ...tsx.matchAll(/'(--[a-z-]+)'/g)].map((m) => m[1]!));
  const used = [...css.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]!);
  expect(used.length).toBeGreaterThan(50);
  expect(used.filter((v) => !provided.has(v) && !local.has(v))).toEqual([]);
});

it('kein Hexwert im Oberflächen-CSS', () => {
  for (const f of readdirSync(__dirname).filter((n) => n.endsWith('.css'))) expect(readFileSync(join(__dirname, f), 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
});

it('Oberflächen-Schriften sind lokal gebündelt (aus @bbzb/ui, nie absolut oder fremd)', () => {
  for (const f of uiFonts) {
    expect(f.url).toMatch(/\.woff2$/);
    expect(f.url).not.toMatch(/^(https?:)?\/\/|^\/fonts\//);
  }
});

it('Studio-Tokens wiederholen keine gemeinsamen Tokens aus @bbzb/ui', () => {
  expect(Object.keys(studioTheme).filter((k) => k in uiTheme)).toEqual([]);
});
