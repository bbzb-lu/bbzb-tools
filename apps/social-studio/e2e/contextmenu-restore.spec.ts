import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addSlide, elements, frames, newProject, png, toScreen } from './fixtures';

const menu = (page: Page) => page.getByRole('menu', { name: 'Kontextmenü' });
const item = (page: Page, name: string) => menu(page).getByRole('menuitem', { name, exact: true });

/** Zwei Fotos («Foto 1» gesperrt, «Foto 2» ausgeblendet) und ein normaler Text. */
async function setup(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await addPhoto(page, png(400, 300));
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(3);
  const [a, b, t] = await elements(page);
  await page.evaluate(([x, y, z]) => {
    window.__bbzbTest.patch(x!, { x: 100, y: 200, width: 400, height: 300, locked: true });
    window.__bbzbTest.patch(y!, { x: 600, y: 200, width: 400, height: 300, visible: false });
    window.__bbzbTest.patch(z!, { x: 100, y: 900, width: 400, height: 100 });
  }, [a!.id, b!.id, t!.id]);
  await page.keyboard.press('Escape');
  await frames(page);
  return { a: a!, b: b!, t: t! };
}
const byId = async (page: Page, id: string) => (await elements(page)).find((e) => e.id === id)!;

test('Rechtsklick irgendwo auf der Slide bietet gesperrte und ausgeblendete Elemente an', async ({ page }) => {
  const { a, b } = await setup(page);
  const name = (await byId(page, a.id)).name;
  const hidden = (await byId(page, b.id)).name;
  // leere Fläche weit weg von beiden
  const empty = await toScreen(page, 700, 1200);
  await page.mouse.click(empty.x, empty.y, { button: 'right' });
  await expect(item(page, `${name} entsperren`)).toBeVisible();
  await expect(item(page, `${hidden} einblenden`)).toBeVisible();
  await expect(item(page, 'Einfügen')).toBeVisible();
  await item(page, `${name} entsperren`).click();
  expect((await byId(page, a.id)).locked).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBe(a.id);
  // wieder ziehbar
  const at = await toScreen(page, 300, 350);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await byId(page, a.id)).x).toBeGreaterThan(100);
  // ein Undo-Schritt macht das Entsperren rückgängig (der Zug davor ist ein eigener)
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect((await byId(page, a.id)).locked).toBe(true);
});

test('Ausgeblendetes Element einblenden, auch beim Rechtsklick auf ein normales Element', async ({ page }) => {
  const { b, t } = await setup(page);
  const name = (await byId(page, b.id)).name;
  const on = await toScreen(page, 200, 950);
  await page.mouse.click(on.x, on.y, { button: 'right' });
  await expect(item(page, 'Kopieren')).toBeVisible();
  await item(page, `${name} einblenden`).click();
  expect((await byId(page, b.id)).visible).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBe(b.id);
  expect((await byId(page, t.id)).visible).toBe(true);
});

test('Elemente anderer Slides werden nicht angeboten', async ({ page }) => {
  const { a } = await setup(page);
  await addSlide(page);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const other = (await elements(page)).at(-1)!;
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 1100, y: 300, locked: true }), other.id);
  await page.keyboard.press('Escape');
  await frames(page);
  const name = (await byId(page, a.id)).name;
  const otherName = (await byId(page, other.id)).name;
  const at = await toScreen(page, 1500, 1200); // Slide 2, leer
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(item(page, `${otherName} entsperren`)).toBeVisible();
  await expect(item(page, `${name} entsperren`)).toHaveCount(0);
});
