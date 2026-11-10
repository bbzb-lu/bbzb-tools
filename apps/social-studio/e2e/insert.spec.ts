import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, newProject, png, toScreen } from './fixtures';

type Crop = { x: number; y: number; scale: number };
const photo = async (page: Page) => {
  const [el] = await elements(page);
  return { ...el!, crop: (el!.props as { crop: Crop }).crop };
};
const canvasScale = (page: Page) =>
  page.evaluate(() => (document.querySelector('.canvas-scroll')!.clientHeight - 48) / window.__bbzbTest.project().format.height);

async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(x + (dx * i) / 5, y + (dy * i) / 5);
  await page.mouse.up();
}

test('Querformat im Post: volle Breite, vertikal zentriert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(() => elements(page)).toMatchObject([{ x: 0, y: 315, width: 1080, height: 720 }]);
});

test('Hochformat 3:4 im Post: ganz sichtbar, volle Höhe', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(3000, 4000));
  await expect.poll(() => elements(page)).toMatchObject([{ x: 33.75, y: 0, width: 1012.5, height: 1350 }]);
});

test('Querformat in der Story: y 600', async ({ page }) => {
  await newProject(page, 'Story 9:16');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(() => elements(page)).toMatchObject([{ x: 0, y: 600, width: 1080, height: 720 }]);
});

// Foto 3000 × 2000 → Rahmen 1080 × 720 bei y 315; Anfasser unten rechts und rechts Mitte, nach innen ziehen (Zoom 0.36 bleibt deckend)
for (const [name, handle, shift] of [
  ['Shift + Ecke', { x: 1080, y: 1035, dx: 0, dy: -150 }, true],
  ['Seiten-Anfasser', { x: 1080, y: 675, dx: -180, dy: 0 }, false],
] as const) {
  test(`${name} ziehen: Bild bleibt zentriert, Zoom gleich, ein Undo-Schritt`, async ({ page }) => {
    await newProject(page, 'Post 4:5');
    await addPhoto(page, png(3000, 2000));
    await expect.poll(() => elements(page)).toHaveLength(1);
    const start = await photo(page);
    const s = await canvasScale(page);
    const o = await toScreen(page, 0, 0);
    if (shift) await page.keyboard.down('Shift');
    await drag(page, o.x + handle.x * s, o.y + handle.y * s, handle.dx * s, handle.dy * s);
    if (shift) await page.keyboard.up('Shift');
    await expect.poll(async () => (await photo(page)).height !== start.height || (await photo(page)).width !== start.width).toBe(true);
    const el = await photo(page);
    expect(el.crop.scale).toBeCloseTo(start.crop.scale, 6);
    expect(el.crop.x).toBeCloseTo((el.width - 3000 * el.crop.scale) / 2, 0);
    expect(el.crop.y).toBeCloseTo((el.height - 2000 * el.crop.scale) / 2, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await photo(page)).height).toBeCloseTo(start.height, 3);
    expect((await photo(page)).crop).toEqual(start.crop);
  });
}

test('«Foto hinzufügen» und «Text hinzufügen» liegen in der Bibliothek über den Tabs, nicht über der Leinwand; Tab-Reihenfolge Leiste, Tabs, Inhalt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const lib = page.locator('.left-panel');
  for (const name of ['Foto oder Video hinzufügen', 'Text hinzufügen']) {
    await expect(lib.getByRole('button', { name })).toBeVisible();
    await expect(page.locator('.canvas').getByRole('button', { name })).toHaveCount(0);
  }
  await expect(lib.getByRole('button', { name: 'Foto oder Video hinzufügen' }).locator('.tabler-icon')).toHaveCount(1);
  const y = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!.y;
  expect(await y(lib.getByRole('button', { name: 'Text hinzufügen' }))).toBeLessThan(await y(lib.getByRole('tab', { name: 'Scribbles' })));
  await lib.getByRole('button', { name: 'Foto oder Video hinzufügen' }).focus();
  await page.keyboard.press('Tab');
  await expect(lib.getByRole('button', { name: 'Text hinzufügen' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(lib.getByRole('tab', { name: 'Bibliothek', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(lib.getByRole('tab', { name: 'Scribbles' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(lib.locator('.library-tile').first()).toBeFocused();
  await lib.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(1);
});
