import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { PNG } from 'pngjs';
import { colors, scrim } from '../src/tokens';
import { addEffect, exportPng, newProject } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const px = (png: PNG, x: number, y: number) => [0, 1, 2].map((k) => png.data[(y * png.width + x) * 4 + k]!);
/** Mittel und Streuung einer Pixelzeile (alle Kanäle einzeln). */
function rowStats(png: PNG, y: number) {
  const sum = [0, 0, 0], sq = [0, 0, 0];
  for (let x = 0; x < png.width; x++) px(png, x, y).forEach((v, k) => ((sum[k]! += v), (sq[k]! += v * v)));
  const mean = sum.map((s) => s / png.width);
  return { mean, sd: Math.sqrt(sq[1]! / png.width - mean[1]! ** 2) };
}
const near = (a: number[], b: number[], t: number) => a.every((v, k) => Math.abs(v - b[k]!) <= t);
const slide = (page: Page) => page.evaluate(() => window.__bbzbTest.project().slides[0]!);

const BG = rgb(colors.warmweiss);
const DARK = rgb(colors.blauschwarz);
// unterste Zeile: Blauschwarz mit Alpha «mittel» über Warmweiss; oben endet der Verlauf transparent
const BOTTOM = BG.map((v, k) => v * (1 - scrim.alpha.mittel) + DARK[k]! * scrim.alpha.mittel);
const SHOTS = '.superpowers/sdd/2026-10-27-phase-2-8-oberflaeche/screens';

test('Slide ohne Auswahl: «Verlauf hinzufügen» unten dunkelt die unterste Zeile ab, oben bleibt; Editor = Export; Undo entfernt ihn', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Verlauf');
  await expect.poll(async () => (await slide(page)).scrims).toEqual([{ side: 'unten', strength: 'mittel' }]);
  const [got] = await exportPng(page);
  expect(near(rowStats(got!, 1349).mean, BOTTOM, 2)).toBe(true);
  expect(rowStats(got!, 0).mean).toEqual(BG);
  // Editor zeigt dieselbe Canvas wie der Export: unterste Zeile gleich
  const editor = await page.evaluate(() => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    const bg = (k.stages[0]!.findOne('.content') as import('konva').default.Layer).getChildren()[0]!;
    const c = bg instanceof k.Image ? (bg.image() as HTMLCanvasElement) : null;
    return c && Array.from(c.getContext('2d')!.getImageData(0, c.height - 1, c.width, 1).data);
  });
  expect(editor).not.toBeNull();
  expect(editor!.every((v, i) => v === got!.data[(1349 * 1080) * 4 + i])).toBe(true);
  await page.screenshot({ path: `${SHOTS}/task-4-editor.png` });

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await slide(page)).scrims).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Verlauf Unten entfernen' })).toHaveCount(0);
  const [flat] = await exportPng(page);
  expect(rowStats(flat!, 1349).mean).toEqual(BG);
});

test('Verlauf mit Korn: gleiche Abdunklung plus Rauschen; Stärke ein Undo-Schritt; Reichweite in der Zeile', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Korn');
  await addEffect(page, 'Verlauf');
  const [got] = await exportPng(page);
  const bottom = rowStats(got!, 1349);
  expect(near(bottom.mean, BOTTOM, 4)).toBe(true);
  expect(bottom.sd).toBeGreaterThan(2);

  const row = page.getByRole('region', { name: 'Verlauf Unten', exact: true });
  await expect(row.getByRole('slider', { name: 'Reichweite' })).toHaveValue('56');
  await row.getByRole('radio', { name: 'Stark' }).check();
  await expect.poll(async () => (await slide(page)).scrims).toEqual([{ side: 'unten', strength: 'stark' }]);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await slide(page)).scrims).toEqual([{ side: 'unten', strength: 'mittel' }]);
  const slider = row.getByRole('slider', { name: 'Reichweite' });
  await expect(slider).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/task-4-reichweite.png` });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.4, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.4 + i * 0.075), y);
  await page.mouse.up();
  await expect.poll(async () => (await slide(page)).scrims).toEqual([{ side: 'unten', strength: 'mittel', reach: 100 }]);
  await page.keyboard.press('Control+z'); // die ganze Regler-Geste auf einmal
  await expect.poll(async () => (await slide(page)).scrims).toEqual([{ side: 'unten', strength: 'mittel' }]);
});

test('Höchstens vier Verläufe je Slide; Projektdatei sichern und neu öffnen behält sie', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 4; i++) await addEffect(page, 'Verlauf');
  await page.getByRole('button', { name: 'Effekt hinzufügen', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /^Verlauf/ })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  const before = (await slide(page)).scrims;
  expect(before).toHaveLength(4);
  const [shown] = await exportPng(page);

  await page.getByLabel('Projektname').fill('Verläufe');
  await page.getByLabel('Projektname').press('Enter');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
  const d = await download;
  const file = await readFile(await d.path());
  await page.getByLabel('Projektname').fill('Original');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: d.suggestedFilename(), mimeType: 'application/zip', buffer: file });
  await page.getByRole('listitem').filter({ hasText: 'Verläufe' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Verläufe');
  await expect.poll(async () => (await slide(page)).scrims).toEqual(before);
  const [again] = await exportPng(page);
  expect(again!.data.equals(shown!.data)).toBe(true);
});
