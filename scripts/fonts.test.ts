import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { fontsStatus } from './fonts.mjs';

test('fontsStatus: missing for empty folder, ok once Braveold-Light.otf exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fonts-'));
  expect(fontsStatus(dir)).toBe('missing');
  writeFileSync(join(dir, 'Braveold-Light.otf'), '');
  expect(fontsStatus(dir)).toBe('ok');
});
