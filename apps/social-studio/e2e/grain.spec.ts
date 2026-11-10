import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { addPhoto, bbzbsocial, effectRemove, elements, exportPng, gradientPng, mean, meanDiff, newProject, openAllSections, png, toggleEffect } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Korn an = Zeile «Korn» unter «Effekte» (seit 4c Task 11 statt Schalter). */
const korn = (page: Page) => effectRemove(page, 'Korn');

test('Neues Foto hat kein Korn; «Korn» an ergibt Korn, aus wieder das Rohbild, ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1080, 1350));
  await expect.poll(async () => (await elements(page))[0]?.props).toMatchObject({ grain: false });
  await openAllSections(page);
  await expect(korn(page)).toHaveCount(0);
  // nur das Korn prüfen: BBZB-Look (bei neuen Fotos an, Task 8) aus
  await page.getByRole('button', { name: 'BBZB-Look', exact: true }).click();
  const [without] = await exportPng(page);

  await toggleEffect(page, 'Korn');
  await expect(korn(page)).toHaveCount(1);
  await expect.poll(async () => (await elements(page))[0]?.props).toMatchObject({ grain: true });
  const [withGrain] = await exportPng(page);

  const raw = PNG.sync.read(gradientPng(1080, 1350));
  expect(Math.max(...meanDiff(without!, raw))).toBeLessThan(0.5);
  // Korn sichtbar, aber auf Mittelgrau normalisiert: Helligkeit bleibt im Mittel gleich
  expect(Math.min(...meanDiff(withGrain!, without!))).toBeGreaterThan(1);
  mean(withGrain!).forEach((v, k) => expect(Math.abs(v - mean(without!)[k]!)).toBeLessThan(1.5));

  await page.keyboard.press('Control+z');
  await expect(korn(page)).toHaveCount(0);
});

/** Ein Slide: Verlaufsfoto mit Korn oben, darunter der blaue Slide-Hintergrund mit Korn. */
function goldenProject() {
  const photo = gradientPng(1080, 675);
  const id = createHash('sha256').update(photo).digest('hex');
  const base = { rotation: 0, opacity: 1, visible: true, locked: false, x: 0, width: 1080, height: 675 };
  return bbzbsocial(
    {
      schemaVersion: 1, id: 'g', name: 'Korn', createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [{ id: 's1', background: 'blau', grain: true }],
      elements: {
        f: { ...base, id: 'f', type: 'photo', name: 'Foto', y: 0, props: { assetId: id, crop: { x: 0, y: 0, scale: 1 }, grain: true } },
      },
      order: ['f'],
      assets: { [id]: { mime: 'image/png', width: 1080, height: 675, name: 'verlauf.png' } },
    },
    { [id]: photo },
  );
}

const GOLDEN = `${import.meta.dirname}/golden/korn.png`;

test('Golden Image: Korn auf Foto und Slide-Hintergrund, mittlere Abweichung je Kanal höchstens 2 %', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'korn.bbzbsocial', mimeType: 'application/zip', buffer: goldenProject() });
  await page.getByRole('button', { name: '«Korn» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Korn');
  const [got] = await exportPng(page);
  expect([got!.width, got!.height]).toEqual([1080, 1350]);
  // Erzeugen (Ruling R4): UPDATE_GOLDEN=1 npx playwright test grain
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, PNG.sync.write(got!));
  const want = PNG.sync.read(readFileSync(GOLDEN));
  meanDiff(got!, want).forEach((d) => expect(d / 255).toBeLessThanOrEqual(0.02));
  // Korn auf Foto und Hintergrund: beide Hälften gekörnt, Mittel des Hintergrunds bleibt Blau
  mean(got!, 700, 1350).forEach((v, k) => expect(Math.abs(v - rgb(colors.blau)[k]!)).toBeLessThan(4));
});
