/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('prefers-reduced-motion schaltet Übergänge und Animationen ab', () => {
  const css = readFileSync(new URL('./kit.css', import.meta.url), 'utf8');
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*transition: none !important/);
});
