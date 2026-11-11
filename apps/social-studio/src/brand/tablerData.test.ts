import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const data = JSON.parse(readFileSync(join(__dirname, '../../brand/tabler/outline.json'), 'utf8')) as Record<
  string,
  { p: string[]; t: string }
>;
const entries = Object.entries(data);

describe('brand/tabler/outline.json', () => {
  it('hat mindestens 5000 Icons und die bekannten Namen', () => {
    expect(entries.length).toBeGreaterThanOrEqual(5000);
    for (const n of ['map-pin', 'home', 'camera', 'arrow-up-right']) expect(data[n]).toBeDefined();
  });

  it('Namen, Pfade und Stichwörter sind gültig', () => {
    for (const [name, { p, t }] of entries) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
      expect(p.length).toBeGreaterThan(0);
      for (const d of p) expect(d).toMatch(/^[0-9MmLlHhVvCcSsQqTtAaZz .,+eE-]+$/);
      expect(typeof t).toBe('string');
    }
  });

  it('enthält keinen leeren Hintergrundpfad', () => {
    for (const [, { p }] of entries) expect(p).not.toContain('M0 0h24v24H0z');
  });
});
