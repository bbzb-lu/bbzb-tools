import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { findTestHook } from './check-live-build.mjs';

test('findTestHook: leer ohne Testhaken, ein Treffer für die Datei mit dem Schlüssel', () => {
  const dir = mkdtempSync(join(tmpdir(), 'live-'));
  mkdirSync(join(dir, 'social-studio', 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<p>ok</p>');
  writeFileSync(join(dir, 'social-studio', 'assets', 'a.js'), 'console.log(1)');
  expect(findTestHook(dir)).toEqual([]);
  writeFileSync(join(dir, 'social-studio', 'assets', 'b.js'), 'window.__bbzbTest={}');
  expect(findTestHook(dir)).toEqual([join(dir, 'social-studio', 'assets', 'b.js')]);
});
