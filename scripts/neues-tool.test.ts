import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, test } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { neuesTool } from './neues-tool.mjs';

const repo = join(import.meta.dirname, '..');
let root: string;

// Ausschnitt des Repos: Vorlage und Startseite (nur tools.ts und die Vorschaubilder)
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'neues-tool-'));
  cpSync(join(repo, 'apps/_vorlage'), join(root, 'apps/_vorlage'), { recursive: true });
  mkdirSync(join(root, 'apps/startseite/src'), { recursive: true });
  cpSync(join(repo, 'apps/startseite/src/tools.ts'), join(root, 'apps/startseite/src/tools.ts'));
  cpSync(join(repo, 'apps/startseite/public/vorschau'), join(root, 'apps/startseite/public/vorschau'), { recursive: true });
});

const read = (p: string) => readFileSync(join(root, p), 'utf8');

test('legt apps/<id> mit ersetzten Platzhaltern an', () => {
  neuesTool(root, 'test-tool', 'Test Tool');
  expect(JSON.parse(read('apps/test-tool/package.json')).name).toBe('test-tool');
  expect(read('apps/test-tool/vite.config.ts')).toContain("base: '/test-tool/'");
  expect(read('apps/test-tool/vite.config.ts')).toContain("outDir: '../../dist/test-tool'");
  expect(read('apps/test-tool/src/App.tsx')).toContain('<Header tool="Test Tool" />');
  expect(read('apps/test-tool/e2e/start.spec.ts')).toContain('BBZB Tools, Test Tool, zur Startseite');
  expect(read('apps/test-tool/index.html')).toContain('<title>BBZB Test Tool</title>');
  for (const f of ['package.json', 'vite.config.ts', 'index.html', 'src/App.tsx', 'e2e/start.spec.ts', 'AGENTS.md']) {
    expect(read(`apps/test-tool/${f}`), f).not.toMatch(/__ID__|__NAME__|vorlage/);
  }
  expect(existsSync(join(root, 'apps/test-tool/vorschau.png'))).toBe(false);
});

test('trägt die Kachel in tools.ts ein und legt das Platzhalter-Vorschaubild ab', async () => {
  neuesTool(root, 'test-tool', 'Test Tool');
  const { tools } = await import(join(root, 'apps/startseite/src/tools.ts'));
  expect(tools.at(-1)).toEqual({
    id: 'test-tool',
    name: 'Test Tool',
    satz: 'Kurz beschreiben, was das Tool erledigt.',
    pfad: '/test-tool/',
    vorschau: 'vorschau/test-tool.png',
    beta: true,
  });
  expect(tools.map((t: { id: string }) => t.id)).toContain('news-banner');
  expect(existsSync(join(root, 'apps/startseite/public/vorschau/test-tool.png'))).toBe(true);
});

test('lehnt ungültige und bestehende IDs mit Meldung ab, ohne etwas anzulegen', () => {
  expect(() => neuesTool(root, 'Test Tool', 'X')).toThrow(/ID/);
  expect(() => neuesTool(root, '1abc', 'X')).toThrow(/ID/);
  expect(() => neuesTool(root, 'news-banner', 'X')).toThrow(/gibt es schon/);
  neuesTool(root, 'test-tool', 'Test Tool');
  expect(() => neuesTool(root, 'test-tool', 'Test Tool')).toThrow(/gibt es schon/);
  expect(() => neuesTool(root, 'zwei', '')).toThrow(/Name/);
  expect(() => neuesTool(root, 'zwei', "Bob's")).toThrow(/Name/);
  expect(existsSync(join(root, 'apps/zwei'))).toBe(false);
  expect(read('apps/startseite/src/tools.ts').match(/id: 'test-tool'/g)).toHaveLength(1);
});
