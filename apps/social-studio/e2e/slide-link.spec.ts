import { expect, test, type Page } from '@playwright/test';
import type { PNG } from 'pngjs';
import { addSlide, columnPng, dropPng, elements, exportPng, newProject, openSection } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-22-phase-2-2-bedienung/screens';
const project = (page: Page) => page.evaluate(() => window.__bbzbTest.project());
const tiles = (page: Page) => page.getByRole('list', { name: 'Slides' }).getByRole('button');
const tile = (page: Page, n: number) => tiles(page).nth(n - 1);
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
/** Hintergründe der Slides: Panorama blau, die leeren Slides warmweiss bzw. orange. */
const order = async (page: Page) => (await project(page)).slides.map((s) => s.background);
/** Spalte im Export: columnPng trägt die Bildspalte in R (low) und G (high). */
const col = (p: PNG, x: number, y: number) => p.data[(y * p.width + x) * 4]! + 256 * p.data[(y * p.width + x) * 4 + 1]!;

/** Leere Slide, Panorama über die Layout-Wahl, leere orange Slide: [warmweiss, blau, blau, orange]. */
async function panoramaProject(page: Page) {
  await newProject(page, 'Post 4:5');
  await addSlide(page, 'Panorama');
  await addSlide(page);
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Orange' }).check(); // Hintergrund der letzten Slide
  await expect.poll(() => order(page)).toEqual(['warmweiss', 'blau', 'blau', 'orange']);
}

/** Spaltenbild ins Panorama-Foto, Texte und Scribble aus, Foto ohne Look und Korn: der Export zeigt die Bildspalten roh. */
async function columnPhoto(page: Page) {
  for (const e of await elements(page)) if (e.type !== 'photo') await page.evaluate((id) => window.__bbzbTest.patch(id, { visible: false }), e.id);
  await dropPng(page, 1080 + 300, 1000, columnPng(2160, 1350));
  await expect.poll(async () => (await elements(page)).find((e) => e.type === 'photo')!.props).toHaveProperty('assetId');
  const photo = (await elements(page)).find((e) => e.type === 'photo')!;
  await page.evaluate(([id, props]) => window.__bbzbTest.patch(id, { props }), [photo.id, { ...(photo.props as object), look: false, grain: false }] as const);
}

/** Export: das Panorama an Slide `at` (0-basiert) ist spaltengenau über die Naht verteilt. */
async function expectSeamless(page: Page, at: number) {
  const slides = await exportPng(page);
  expect(slides).toHaveLength(4);
  const [a, b] = [slides[at]!, slides[at + 1]!];
  for (const y of [500, 675, 900]) expect([col(a, 0, y), col(a, 1079, y), col(b, 0, y), col(b, 1079, y)]).toEqual([0, 1079, 1080, 2159]);
}

test('Panorama verschieben: Ziehen und Alt + Pfeil bewegen beide Slides, der Export bleibt nahtlos', async ({ page }) => {
  await panoramaProject(page);
  await columnPhoto(page);
  const links = (await project(page)).slides.map((s) => s.link);
  expect(links[1]).toBeDefined();
  expect(links).toEqual([undefined, links[1], links[1], undefined]);
  await expect(tile(page, 2)).toHaveAccessibleName('Slide 2, Panorama mit Slide 3');
  await expect(tile(page, 3)).toHaveAccessibleName('Slide 3, Panorama mit Slide 2');
  await expect(tile(page, 4)).toHaveAccessibleName('Slide 4');

  // Ziehen der rechten Hälfte auf Slide 1: beide nach vorne
  await tile(page, 3).dragTo(tile(page, 1));
  await expect.poll(() => order(page)).toEqual(['blau', 'blau', 'warmweiss', 'orange']);
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true'); // die gezogene Hälfte bleibt aktuell
  await expectSeamless(page, 0);

  // Alt + → auf der linken Hälfte: hinter die nächste Slide
  await tile(page, 1).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(() => order(page)).toEqual(['warmweiss', 'blau', 'blau', 'orange']);
  await expectSeamless(page, 1);

  // Alt + → auf der rechten Hälfte: ans Ende, der Fokus bleibt auf der Kachel
  await tile(page, 3).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(() => order(page)).toEqual(['warmweiss', 'orange', 'blau', 'blau']);
  await expect(tile(page, 4)).toBeFocused();
  await expectSeamless(page, 2);

  // Einzelne Slide nach rechts springt über das ganze Panorama, nie dazwischen
  await tile(page, 2).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(() => order(page)).toEqual(['warmweiss', 'blau', 'blau', 'orange']);
  await expect(tile(page, 4)).toBeFocused();
  await expectSeamless(page, 1);

  await page.locator('.slidebar').screenshot({ path: `${SHOTS}/task-1-slidebar.png` });
});

test('«2 Slides löschen» entfernt das Panorama, Undo stellt es her', async ({ page }) => {
  await panoramaProject(page);
  const before = await project(page);
  await tile(page, 3).click();
  await expect(button(page, 'Slide löschen')).toHaveCount(0);
  await button(page, '2 Slides löschen').click();
  await expect(tiles(page)).toHaveCount(2);
  expect(await order(page)).toEqual(['warmweiss', 'orange']);
  expect(await elements(page)).toHaveLength(0);
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(button(page, 'Slide löschen')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(tiles(page)).toHaveCount(4);
  const after = await project(page);
  expect(after.slides).toEqual(before.slides);
  expect(after.elements).toEqual(before.elements);
});

test('«2 Slides duplizieren» legt ein eigenes Panorama dahinter an; bei 19 Slides gesperrt mit Hinweis', async ({ page }) => {
  await panoramaProject(page);
  await tile(page, 2).click();
  await button(page, '2 Slides duplizieren').click();
  await expect(tiles(page)).toHaveCount(6);
  const p = await project(page);
  expect(p.slides.map((s) => s.background)).toEqual(['warmweiss', 'blau', 'blau', 'blau', 'blau', 'orange']);
  const [l1, l2] = [p.slides[1]!.link, p.slides[3]!.link];
  expect(p.slides.map((s) => s.link)).toEqual([undefined, l1, l1, l2, l2, undefined]);
  expect(l2).not.toBe(l1);
  await expect(tile(page, 4)).toHaveAttribute('aria-current', 'true');
  await expect(tile(page, 4)).toHaveAccessibleName('Slide 4, Panorama mit Slide 5');

  for (let n = 6; n < 19; n++) await addSlide(page);
  await expect(tiles(page)).toHaveCount(19);
  const full = await project(page);
  await tile(page, 2).click();
  const dup = button(page, '2 Slides duplizieren');
  await expect(dup).toBeDisabled(); // wie bei 20 Slides: gesperrt statt Meldung nach dem Klick
  await expect(dup).toHaveAttribute('data-tip', 'Instagram erlaubt höchstens 20 Slides.');
  await tile(page, 1).click();
  await expect(button(page, 'Slide duplizieren')).toBeEnabled(); // eine einzelne Slide passt noch
  await expect(tiles(page)).toHaveCount(19);
  expect((await project(page)).slides).toEqual(full.slides);
});
