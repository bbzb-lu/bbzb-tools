import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, frames, newProject, openLayers, png, toScreen } from './fixtures';

const box = (e: { x: number; y: number; width: number; height: number; rotation: number }) => [e.x, e.y, e.width, e.height, e.rotation];
const inspectorBtn = (page: Page, name: string) => page.getByLabel('Eigenschaften').getByRole('button', { name, exact: true });
const item = (page: Page, name: string) => page.getByRole('menu', { name: 'Kontextmenü' }).getByRole('menuitem', { name, exact: true });

/** Foto und Text auf bekannten Plätzen. */
async function setup(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(2);
  const [photo, text] = await elements(page);
  await page.evaluate(([a, b]) => {
    window.__bbzbTest.patch(a!, { x: 100, y: 200, width: 500, height: 400, rotation: 15 });
    window.__bbzbTest.patch(b!, { x: 100, y: 800, width: 400, height: 100 });
  }, [photo!.id, text!.id]);
  await page.keyboard.press('Escape');
  await openLayers(page);
  await frames(page);
  return { photo: photo!.id, text: text!.id };
}
const sel = (page: Page, id: string, shift = false) => page.locator(`[data-layer="${id}"]`).click({ modifiers: shift ? ['Shift'] : [] });

test('Inspector: «An gleicher Stelle duplizieren» legt das Foto deckungsgleich ab und wählt die Kopie; Duplizieren versetzt weiter', async ({ page }) => {
  const { photo } = await setup(page);
  await sel(page, photo);
  const before = (await elements(page)).find((e) => e.id === photo)!;
  await inspectorBtn(page, 'An gleicher Stelle duplizieren').click();
  await expect.poll(() => elements(page)).toHaveLength(3);
  const copy = (await elements(page)).find((e) => e.type === 'photo' && e.id !== photo)!;
  expect(box(copy)).toEqual(box(before));
  expect((copy.props as { assetId?: string }).assetId).toBe((before.props as { assetId?: string }).assetId);
  await expect(page.locator(`[data-layer="${copy.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-layer="${photo}"]`)).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toHaveLength(2);
  // Standard bleibt versetzt
  await sel(page, photo);
  await inspectorBtn(page, 'Duplizieren').click();
  await expect.poll(() => elements(page)).toHaveLength(3);
  const off = (await elements(page)).find((e) => e.type === 'photo' && e.id !== photo)!;
  expect([off.x, off.y]).toEqual([before.x + 40, before.y + 40]);
});

test('Rechtsklickmenü auf ein Foto: «An gleicher Stelle duplizieren» steht nach «Duplizieren»', async ({ page }) => {
  await setup(page);
  const at = await toScreen(page, 300, 400);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  const names = await page.getByRole('menu', { name: 'Kontextmenü' }).getByRole('menuitem').allTextContents();
  const i = names.findIndex((n) => n.startsWith('Duplizieren'));
  expect(names[i + 1]).toMatch(/^An gleicher Stelle duplizieren/);
  await item(page, 'An gleicher Stelle duplizieren').click();
  await expect.poll(() => elements(page)).toHaveLength(3);
  const photos = (await elements(page)).filter((e) => e.type === 'photo');
  expect(box(photos[0]!)).toEqual(box(photos[1]!));
});

test('Mehrfachauswahl: Inspector und Menü duplizieren beide an gleicher Stelle, Abstände bleiben, ein Undo', async ({ page }) => {
  const { photo, text } = await setup(page);
  await sel(page, photo);
  await sel(page, text, true);
  const before = await elements(page);
  await inspectorBtn(page, 'An gleicher Stelle duplizieren').click();
  await expect.poll(() => elements(page)).toHaveLength(4);
  const after = await elements(page);
  for (const o of before) {
    const copies = after.filter((e) => e.type === o.type && e.id !== o.id);
    expect(copies.some((c) => box(c).join() === box(o).join())).toBe(true);
  }
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toHaveLength(2);
  // Menü: Auswahl steht nach dem Undo wieder bei den Originalen oder leer; neu wählen
  await sel(page, photo);
  await sel(page, text, true);
  const at = await toScreen(page, 300, 400);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await item(page, 'An gleicher Stelle duplizieren').click();
  await expect.poll(() => elements(page)).toHaveLength(4);
});

test('Screenshot Inspector «Ebene» (Aufgabe A)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { photo } = await setup(page);
  await sel(page, photo);
  const r = (await inspectorBtn(page, 'An gleicher Stelle duplizieren').boundingBox())!;
  const insp = (await page.getByLabel('Eigenschaften').boundingBox())!;
  expect(r.x + r.width).toBeLessThanOrEqual(insp.x + insp.width);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-30-phase-4c-6-kontextleiste/screens/task-A-inspector.png' });
});
