import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { colors } from '../src/tokens';
import type { LayoutPreset } from '../src/core/types';
import { elements, exportPng, frames, gradientPng, mean, newProject, toScreen, addSlide, openSection } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-21-phase-2b-layouts-und-hilfen/screens';
const photo = (o: Partial<LayoutPreset['elements'][number]>) => ({ type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 1080, height: 1350, props: {}, ...o });
const panorama: LayoutPreset = { id: 'p', label: 'Panorama', format: 'post', slides: 2, background: 'warmweiss', elements: [photo({ width: 2160 })] };
const querformat: LayoutPreset = { id: 'q', label: 'Querformat', format: 'post', slides: 1, background: 'warmweiss', elements: [photo({ x: 72, y: 470, width: 936, height: 540 })] };

const applyLayout = (page: Page, preset: LayoutPreset, at = 0) => page.evaluate(([p, i]) => window.__bbzbTest.applyLayout(p, i), [preset, at] as const);
const one = async (page: Page, id: string) => (await elements(page)).find((e) => e.id === id)!;

/** Legt ein PNG (Verlauf Orange → Blau) am Weltpunkt ab, wie aus dem Explorer gezogen. */
async function dropPhoto(page: Page, wx: number, wy: number) {
  const p = await toScreen(page, wx, wy);
  const bytes = [...gradientPng(400, 300)];
  const dataTransfer = await page.evaluateHandle((b) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(b)], 'foto.png', { type: 'image/png' }));
    return dt;
  }, bytes);
  await page.locator('.canvas-scroll').dispatchEvent('drop', { dataTransfer, clientX: p.x, clientY: p.y });
}

test('Panorama-Platzhalter: Hinweis nur im Editor, Export zeigt den Hintergrund; Drop füllt ihn deckend, ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  const [id] = await applyLayout(page, panorama);
  const ph = await one(page, id!);
  expect(ph).toMatchObject({ role: 'foto', x: 0, width: 2160, props: { grain: true, look: true } });
  expect(ph.props).not.toHaveProperty('assetId');
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-3-placeholder-empty.png` });

  // leer exportiert: nur der warmweisse Hintergrund, kein Hinweis, kein Rand
  for (const png of await exportPng(page)) for (const [c, v] of mean(png).entries()) expect(Math.abs(v - [251, 248, 243][c]!)).toBeLessThan(0.01);

  await dropPhoto(page, 1080 + 300, 675);
  await expect.poll(async () => (await one(page, id!)).props).toHaveProperty('assetId');
  const filled = await one(page, id!);
  expect(await elements(page)).toHaveLength(1);
  // Rahmen bleibt über der Naht; 400 × 300 auf 2160 × 1350 deckend: Skalierung 5.4, oben und unten angeschnitten
  expect(filled).toMatchObject({ x: 0, y: 0, width: 2160, height: 1350, role: 'foto' });
  expect(filled.props).toMatchObject({ grain: false, look: true, crop: { x: 0, y: (1350 - 300 * 5.4) / 2, scale: 5.4 } });
  await page.screenshot({ path: `${SHOTS}/task-3-placeholder-filled.png` });

  // Export: beide Slides zeigen das Foto, links eher orange, rechts eher blau
  const [left, right] = await exportPng(page);
  expect(mean(left!)[0]!).toBeGreaterThan(mean(right!)[0]!);
  expect(mean(right!)[2]!).toBeGreaterThan(mean(left!)[2]!);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await one(page, id!)).props).not.toHaveProperty('assetId');
});

test('Platzhalter per Dateiauswahl füllen (ohne Maus); Drop neben den Platzhalter legt wie bisher ein neues Foto an', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const [id] = await applyLayout(page, querformat);
  const c = await toScreen(page, 540, 740);
  await page.mouse.click(c.x, c.y);
  await openSection(page, 'Bild');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto wählen' }).click();
  await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: gradientPng(300, 400) });
  await expect.poll(async () => (await one(page, id!)).props).toHaveProperty('assetId');
  expect(await one(page, id!)).toMatchObject({ x: 72, y: 470, width: 936, height: 540, props: { grain: false, look: true } });
  await expect(page.getByRole('button', { name: 'Foto ersetzen' })).toBeVisible();
  const before = (await one(page, id!)).props;

  await dropPhoto(page, 540, 200); // oberhalb des Rahmens
  await expect.poll(() => elements(page)).toHaveLength(2);
  const free = (await elements(page)).find((e) => e.id !== id)!;
  expect(free.role).toBeUndefined();
  expect(free.props).toMatchObject({ grain: false, look: true });
  expect((await one(page, id!)).props).toEqual(before);
});

test('Export: Hinweis auf leere Fotorahmen, Mehrzahl und Einzahl, Export bleibt möglich', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  const empty = (await elements(page)).filter((e) => e.type === 'photo' && e.visible && !(e.props as { assetId?: string }).assetId).length;
  expect(empty).toBeGreaterThan(1);
  const dialog = page.getByRole('dialog', { name: 'Exportieren' });
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(dialog.getByText(`${empty} Fotorahmen sind noch leer.`)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/final-fix-leere-rahmen.png` });
  await dialog.getByRole('button', { name: 'Schliessen' }).click();

  await newProject(page, 'Post 4:5', 'Leer');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(dialog.getByText(/Fotorahmen/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  await addSlide(page, 'Vollbild');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(dialog.getByText('1 Fotorahmen ist noch leer.')).toBeVisible();
});

test('Platzhalter-Hinweis: hell auf Blauschwarz, dunkel auf dem Rahmen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const [id] = await applyLayout(page, querformat);
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Blauschwarz', exact: true }).check();
  await frames(page);
  const fill = () => page.evaluate(() => window.__bbzbTest.hintFill());
  expect(await fill()).toBe(colors.warmweiss);
  if (process.env.SHOT) await page.screenshot({ path: '.superpowers/sdd/2026-10-23-phase-2-4-gestaltung/screens/task-8-blauschwarz.png' });
  await page.evaluate((i) => window.__bbzbTest.patch(i, { props: { ...(window.__bbzbTest.elements()[0]!.props as object), frame: true } }), id!);
  await expect.poll(fill).toBe(colors.blauschwarz);
  if (process.env.SHOT) await page.screenshot({ path: '.superpowers/sdd/2026-10-23-phase-2-4-gestaltung/screens/task-8-blauschwarz-rahmen.png' });
});

test('Titel-Layout: «Foto hierher ziehen» steht unter dem Titel, nicht dahinter', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const preset = JSON.parse(readFileSync(`${import.meta.dirname}/../src/plugins/layouts/presets/titel.json`, 'utf8')) as LayoutPreset;
  await applyLayout(page, preset);
  await frames(page);
  const title = (await elements(page)).find((e) => e.role === 'titel')!;
  const box = await page.evaluate(() => window.__bbzbTest.hintBox());
  const bottom = title.y + title.height;
  expect(box!.top).toBeGreaterThanOrEqual(Math.max(bottom, 830)); // drei Zeilen Titel reichen bis etwa y 830
  await page.screenshot({ path: '.superpowers/sdd/2026-11-13-phase-5-sammelrunde/screens/task-8-placeholder-titel.png' });
});
