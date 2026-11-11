import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { bbzbsocial, elements, view, openAllSections } from './fixtures';
import { alphaPng } from './photoProject';

const SHOTS = '.superpowers/sdd/2026-10-28-phase-4b-ki-freistellen/screens';
const DARK = [15, 27, 38];
const WEISS = [251, 248, 243];
const photo = alphaPng(1000, 1000, DARK, () => 255);
const pid = createHash('sha256').update(photo).digest('hex');
const section = (page: Page) => page.locator('section.section', { has: page.getByRole('heading', { name: 'Maske', exact: true }) });
const btn = (page: Page, name: string) => section(page).getByRole('button', { name, exact: true });
const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 3);
const base = { rotation: 0, opacity: 1, visible: true, locked: false };

/** Foto (Mitte der Slide, 800 × 800) unter einem grossen Titel; `title: false` lässt den Text weg. */
async function open(page: Page, name: string, title = true) {
  const project = {
    schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
    format: { id: 'post', width: 1080, height: 1350 },
    slides: [{ id: 's1', background: 'blau' }],
    elements: {
      e0: { id: 'e0', type: 'photo', name: 'Foto', x: 140, y: 275, width: 800, height: 800, ...base, props: { assetId: pid, crop: { x: 0, y: 0, scale: 1 }, grain: false, look: false } },
      ...(title && { e1: { id: 'e1', type: 'text', name: 'Titel', x: 40, y: 400, width: 1000, height: 600, ...base, role: 'titel', props: { text: 'MMM', style: 'titel', color: 'warmweiss', fontSize: 400, align: 'center' } } }),
    },
    order: title ? ['e0', 'e1'] : ['e0'],
    assets: { [pid]: { mime: 'image/png', width: 1000, height: 1000, name: 'foto.png' } },
  };
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project, { [pid]: photo }) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await view(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds().length)).toBe(title ? 3 : 2);
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  await openAllSections(page);
  await expect(section(page)).toBeVisible();
}

test('Ohne Maske: beide Knöpfe aria-disabled mit Grund und ohne Wirkung', async ({ page }) => {
  await open(page, 'OhneMaske');
  for (const n of ['Als Sticker kopieren', 'Motiv vor Titel']) {
    await expect(btn(page, n)).toHaveAttribute('aria-disabled', 'true');
    await expect(btn(page, n)).toHaveAttribute('data-tip', 'Erst Hintergrund entfernen');
    await btn(page, n).click({ force: true });
  }
  expect(await elements(page)).toHaveLength(2);
});

test('Freigestellt ohne Titel: «Motiv vor Titel» erklärt, «Als Sticker kopieren» geht', async ({ page }) => {
  await open(page, 'OhneTitel', false);
  await page.evaluate(() => window.__bbzbTest.fakeCutout('kreis', 0));
  await btn(page, 'Hintergrund entfernen').click();
  await expect(btn(page, 'Als Sticker kopieren')).toHaveAttribute('aria-disabled', 'false');
  await expect(btn(page, 'Motiv vor Titel')).toHaveAttribute('aria-disabled', 'true');
  await expect(btn(page, 'Motiv vor Titel')).toHaveAttribute('data-tip', 'Auf dieser Slide fehlt ein Titel');
  await btn(page, 'Motiv vor Titel').click({ force: true });
  expect(await elements(page)).toHaveLength(1);
  await btn(page, 'Als Sticker kopieren').click();
  await expect.poll(async () => (await elements(page)).length).toBe(2);
});

test('«Motiv vor Titel»: im Export liegt das Motiv über dem Titel; «Als Sticker kopieren» legt eine versetzte Kopie obenauf', async ({ page }) => {
  await open(page, 'MitTitel');
  // Raster über der Foto-Box: Punkte, an denen vor dem Freistellen der Titel (Warmweiss) über dem Foto steht
  const grid: [number, number][] = [];
  for (let y = 300; y < 1050; y += 25) for (let x = 150; x < 930; x += 25) grid.push([x / 1080, y / 1350]);
  const sample = () => page.evaluate((g) => window.__bbzbTest.slidePixels(0, g), grid).then((p) => p.map((px) => px.slice(0, 3)));
  // nur Punkte im Motiv (Kreis um Bildpixel 500/500 = Slide 640/775, Radius 250 im Test-Freisteller): ausserhalb bleibt der Titel zu Recht sichtbar
  const inside = (i: number) => Math.hypot(grid[i]![0] * 1080 - 640, grid[i]![1] * 1350 - 775) < 200;
  const glyph = (await sample()).flatMap((px, i) => (close(px, WEISS) && inside(i) ? [i] : []));
  expect(glyph.length).toBeGreaterThan(10);
  await page.evaluate(() => window.__bbzbTest.fakeCutout('kreis', 0));
  await btn(page, 'Hintergrund entfernen').click();
  await expect(btn(page, 'Motiv vor Titel')).toHaveAttribute('aria-disabled', 'false');
  await page.screenshot({ path: `${SHOTS}/task-5-section.png` });
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  await btn(page, 'Motiv vor Titel').click();
  await expect.poll(async () => (await elements(page)).length).toBe(3);
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(h0 + 1);
  const ids = (await elements(page)).map((e) => e.id);
  expect(ids[0]).toBe('e0'); // Reihenfolge: Foto, Titel, Kopie
  const mine = async () => (await sample()).filter((_, i) => glyph.includes(i));
  await expect.poll(async () => (await mine()).every((px) => close(px, DARK))).toBe(true); // im Motiv deckt es den Titel ab
  await page.screenshot({ path: `${SHOTS}/task-5-vor-titel.png` });
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  await expect.poll(async () => (await mine()).every((px) => close(px, WEISS))).toBe(true); // Undo: Titel wieder obenauf
  await page.evaluate(() => window.__bbzbTest.select('e0')); // Undo hat die Auswahl der Kopie beendet
  // Sticker: Kopie um 40 px versetzt, gleiche Maske, ausgewählt
  await btn(page, 'Als Sticker kopieren').click();
  await expect.poll(async () => (await elements(page)).length).toBe(3);
  const [o, c] = [(await elements(page)).find((e) => e.id === 'e0')!, (await elements(page)).find((e) => !['e0', 'e1'].includes(e.id))!];
  expect([c.x, c.y]).toEqual([o.x + 40, o.y + 40]);
  expect((c.props as { mask?: string }).mask).toBe((o.props as { mask?: string }).mask);
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBe(c.id);
});
