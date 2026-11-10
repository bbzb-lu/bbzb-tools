import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

export const px = (p: PNG, x: number, y: number) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)];

/** Tolerant ±2 pro Kanal: Edge dithert Verläufe. */
export const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(Math.abs(v - b[i]!)).toBeLessThanOrEqual(2));

export async function exportPng(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG laden' }).click()]);
  return { name: dl.suggestedFilename(), png: PNG.sync.read(readFileSync((await dl.path())!)) };
}

export const choose = (page: Page, name: string) => page.getByRole('radio', { name, exact: true }).check({ force: true });

export const slotButton = (page: Page, slot: 'links' | 'rechts' | 'unten') => page.getByRole('button', { name: `Icon ${slot} bearbeiten` });

/** Platz wählen, suchen, Kachel klicken. */
export async function pick(page: Page, slot: 'Links' | 'Rechts' | 'Unten', query: string, tile: string) {
  await slotButton(page, slot.toLowerCase() as 'links').click();
  await choose(page, 'Icons');
  await page.getByRole('searchbox').fill(query);
  await page.getByRole('button', { name: tile, exact: true }).first().click();
}

/** Bereich (Rechteck) mit auffälligen Pixeln: weicht deutlich vom Hintergrund derselben Zeile ab (Verlauf ist nur vertikal). */
export function strong(png: PNG, x0: number, y0: number, x1: number, y1: number, min = 100) {
  let n = 0;
  for (let y = y0; y < y1; y++) {
    const bg = px(png, 2, y);
    for (let x = x0; x < x1; x++) if (Math.abs(px(png, x, y)[0]! - bg[0]!) > min) n++;
  }
  return n;
}
