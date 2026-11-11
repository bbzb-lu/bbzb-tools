import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { elements, newProject, openSection } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  return PNG.sync.read(Buffer.from(Object.values(files)[0]!));
}

/** Deckende Pixel in Farbe `hex` (Toleranz 6 je Kanal) als Maske, Zeile für Zeile. */
function mask(png: PNG, hex: string) {
  const c = rgb(hex);
  const m = new Uint8Array(png.width * png.height);
  for (let i = 0; i < m.length; i++) {
    m[i] = c.every((v, k) => Math.abs(png.data[i * 4 + k]! - v) <= 6) ? 1 : 0;
  }
  return m;
}
const count = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);

const props = async (page: Page) => (await elements(page))[0]!.props as { color: string; flipX?: boolean };

test('Scribble einfügen: orange im Export, Farbe wechseln, spiegeln, je ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [el] = await elements(page);
  expect(el!.type).toBe('brand');
  expect(el!.x + el!.width / 2).toBe(540);
  expect(el!.y + el!.height / 2).toBe(675);
  await expect(page.getByRole('heading', { name: 'Scribble 1' })).toBeVisible();

  const orange = await exportPng(page);
  const om = mask(orange, colors.orange);
  // dunkelblaue Quelle ist vollständig eingefärbt: sichtbare Striche, kein Blauschwarz
  expect(count(om)).toBeGreaterThan(5000);
  expect(count(mask(orange, colors.blauschwarz))).toBe(0);
  // ausserhalb des Elements nur Slide-Hintergrund
  expect(om.slice(0, Math.floor(el!.y - 2) * 1080).every((v) => v === 0)).toBe(true);

  await page.getByRole('radio', { name: 'Blau', exact: true }).check();
  await expect.poll(async () => (await props(page)).color).toBe('blau');
  const blue = await exportPng(page);
  expect(count(mask(blue, colors.blau))).toBeGreaterThan(5000);
  expect(count(mask(blue, colors.orange))).toBe(0);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).color).toBe('akzent');

  const flip = page.getByRole('button', { name: 'Spiegeln' });
  await openSection(page, 'Ebene');
  await flip.click();
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  expect((await props(page)).flipX).toBe(true);
  const mirrored = mask(await exportPng(page), colors.orange);
  // Element mittig auf der Slide: gespiegelt = Spalte x wird zu 1079 − x (±1 px Rundung)
  let differ = 0;
  let symmetric = 0; // Gegenprobe: das Scribble selbst ist nicht symmetrisch
  for (let y = 0; y < 1350; y++) {
    for (let x = 1; x < 1079; x++) {
      const v = mirrored[y * 1080 + x]!;
      const near = [x - 1, x, x + 1].some((sx) => om[y * 1080 + 1079 - sx] === v);
      if (!near) differ++;
      if (![x - 1, x, x + 1].some((sx) => om[y * 1080 + 1079 - sx] === om[y * 1080 + x])) symmetric++;
    }
  }
  expect(differ / count(om)).toBeLessThan(0.02);
  expect(symmetric / count(om)).toBeGreaterThan(0.2);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).flipX ?? false).toBe(false);
  expect((await props(page)).color).toBe('akzent');
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toHaveLength(0);
});

test('Icon (SVG) einfügen und an Position ablegen: exportiert ohne Fehler, proportional skaliert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => window.__bbzbTest.insertBrand('icon-bike', { x: 300, y: 400 }));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [el] = await elements(page);
  expect([el!.x + el!.width / 2, el!.y + el!.height / 2]).toEqual([300, 400]);
  expect(el!.width).toBe(el!.height);
  const png = await exportPng(page);
  expect(count(mask(png, colors.orange))).toBeGreaterThan(500);
});

test('Bibliothek: hohe Scribbles werden in der Kachel nicht abgeschnitten', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('tab', { name: /Scribbles/ }).click();
  await expect.poll(() => page.locator('.library-tile img').count()).toBe(18);
  const overflow = await page.locator('.library-tile').evaluateAll((tiles) =>
    tiles.filter((t) => {
      const [tb, ib] = [t.getBoundingClientRect(), t.querySelector('img')!.getBoundingClientRect()];
      return ib.top < tb.top - 0.5 || ib.bottom > tb.bottom + 0.5 || ib.left < tb.left - 0.5 || ib.right > tb.right + 0.5;
    }).length,
  );
  expect(overflow).toBe(0);
});

test('Scribbles: hohe und breite Motive werden gleich gross eingefügt, längste Seite höchstens 60 % der Breite', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const areas: number[] = [];
  for (const id of ['scribble-04', 'scribble-15', 'scribble-18', 'scribble-03']) {
    await page.evaluate((i) => window.__bbzbTest.insertBrand(i), id);
    const els = await elements(page);
    const el = els[els.length - 1]!;
    expect(Math.max(el.width, el.height)).toBeLessThanOrEqual(0.6 * 1080 + 1);
    areas.push(Math.sqrt(el.width * el.height));
  }
  // Fläche bis auf Rundung gleich, ausser wo die Kappe greift (nur sehr schmale Motive: dort kleiner)
  expect(areas[3]).toBeGreaterThan(300);
  expect(areas[3]).toBeLessThan(350);
  for (const a of areas) expect(a).toBeLessThanOrEqual(areas[3]! + 2);
  expect(areas[0]).toBeGreaterThan(300);
});
