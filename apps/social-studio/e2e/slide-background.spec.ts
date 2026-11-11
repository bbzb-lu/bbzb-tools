import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { addEffect, bbzbsocial, exportPng, frames, grainSpread, mean, newProject, openSection } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const px = (png: PNG, x: number, y: number) => [0, 1, 2].map((k) => png.data[(y * png.width + x) * 4 + k]!);
const slide = (page: Page) => page.evaluate(() => window.__bbzbTest.project().slides[0]!);
const H = 1350;

test('Slide-Panel: Korn schaltet, ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const row = page.getByRole('button', { name: 'Korn entfernen', exact: true });
  await expect(row).toHaveCount(0);
  await addEffect(page, 'Korn');
  await expect(row).toBeVisible();
  expect((await slide(page)).grain).toBe(true);
  await page.keyboard.press('Control+z');
  await expect(row).toHaveCount(0);
  expect((await slide(page)).grain).toBeFalsy();
  await page.keyboard.press('Control+y');
  await row.click();
  expect((await slide(page)).grain).toBeFalsy();
});

test('Blauer Hintergrund mit Korn streut wie die Referenzbilder (40 %), ohne Korn reines Blau', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Blau', exact: true }).check();
  const [flat] = await exportPng(page);
  for (const [x, y] of [[0, 0], [540, 675], [1079, 1349]] as const) expect(px(flat!, x, y)).toEqual(rgb(colors.blau));
  await addEffect(page, 'Korn');
  const [got] = await exportPng(page);
  const { ours, ref } = await grainSpread(page, got!);
  expect(ours / ref).toBeGreaterThan(0.8);
  expect(ours / ref).toBeLessThan(1.2);
  mean(got!).forEach((v, k) => expect(Math.abs(v - rgb(colors.blau)[k]!)).toBeLessThan(4));
});

test('Slides mit gleicher Farbe und Korn teilen sich eine Korn-Canvas, andere Farbe hat eine eigene', async ({ page }) => {
  const file = bbzbsocial({
    schemaVersion: 1, id: 'k', name: 'Korn', createdAt: 0, updatedAt: 0,
    format: { id: 'post', width: 1080, height: H },
    slides: [{ id: 's1', background: 'blau', grain: true }, { id: 's2', background: 'blau', grain: true }, { id: 's3', background: 'orange', grain: true }],
    elements: {}, order: [], assets: {},
  });
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'k.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await page.getByRole('button', { name: '«Korn» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Korn');
  const same = () =>
    page.evaluate(() => {
      const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
      const bg = (k.stages[0]!.findOne('.content') as import('konva').default.Layer).getChildren().slice(0, 3);
      const img = bg.map((n) => (n instanceof k.Image ? n.image() : null));
      if (!img.every((c) => c instanceof HTMLCanvasElement)) return null;
      return [img[0] === img[1], img[0] === img[2]];
    });
  await expect.poll(same).toEqual([true, false]);
  expect(await page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
});

test('Korn aus und wieder an: nie eine freigegebene Canvas, der Export wartet auf die neue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await newProject(page, 'Post 4:5');
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Blau', exact: true }).check();
  const korn = () => addEffect(page, 'Korn');
  const unkorn = () => page.getByRole('button', { name: 'Korn entfernen', exact: true }).click();
  await korn();
  const [before] = await exportPng(page);
  await unkorn();
  await frames(page); // die alte Canvas ist jetzt freigegeben (0 × 0)
  // jede Zuweisung an Konva-Knoten mitschreiben (unabhängig vom Zeichnen): freigegebene Canvas oder Warte-Name
  await page.evaluate(() => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    const w = window as unknown as { log_: string[] };
    w.log_ = [];
    const proto = k.Node.prototype as unknown as { _setAttr(key: string, val: unknown): void };
    const set = proto._setAttr;
    proto._setAttr = function (key, val) {
      if (key === 'image' && val instanceof HTMLCanvasElement) w.log_.push(val.width ? 'canvas' : 'released');
      if (key === 'name' && val === 'effect-pending') w.log_.push('pending');
      set.call(this, key, val);
    };
  });
  await korn();
  await expect.poll(() => page.evaluate(() => (window as unknown as { log_: string[] }).log_.at(-1))).toBe('canvas');
  const log = await page.evaluate(() => (window as unknown as { log_: string[] }).log_);
  expect(log).not.toContain('released');
  expect(log[0]).toBe('pending');
  const [after] = await exportPng(page);
  expect(after!.data.equals(before!.data)).toBe(true);
  expect(errors).toEqual([]);
});
