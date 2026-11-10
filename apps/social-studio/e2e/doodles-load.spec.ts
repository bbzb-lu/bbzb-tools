import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { bbzbsocial } from './fixtures';

const projectWith = (brandId: string) => ({
  schemaVersion: 1,
  id: 'fremd',
  name: 'Doodle',
  format: { id: 'post', width: 1080, height: 1350 },
  createdAt: 0,
  updatedAt: 0,
  slides: [{ id: 's1', background: 'warmweiss' }],
  elements: {
    e1: {
      id: 'e1', type: 'brand', name: 'Doodle', x: 100, y: 100, width: 300, height: 300,
      rotation: 0, opacity: 1, visible: true, locked: false,
      props: { brandId, color: 'akzent' },
    },
  },
  order: ['e1'],
  assets: {},
});

const openImported = async (page: Page, brandId: string) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'test.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(projectWith(brandId)) });
  await page.getByRole('listitem').filter({ hasText: 'Doodle' }).getByRole('button', { name: 'Öffnen' }).click();
};

const startExport = async (page: Page) => {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  return dialog;
};

test('Projekt mit Doodle: Datei lädt beim Öffnen vor, Export zeigt das Doodle in Akzentfarbe', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await openImported(page, 'doodle-logos-apple');
  await expect(page.getByLabel('Projektname')).toHaveValue('Doodle');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const download = page.waitForEvent('download');
  const dialog = await startExport(page);
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await expect(dialog).not.toContainText('Fehler');
  const png = PNG.sync.read(Buffer.from(Object.values(files)[0]!));
  const c = [1, 3, 5].map((i) => parseInt(colors.orange.slice(i, i + 2), 16));
  let n = 0;
  for (let i = 0; i < png.width * png.height; i++) if (c.every((v, k) => Math.abs(png.data[i * 4 + k]! - v) <= 6)) n++;
  expect(n).toBeGreaterThan(1000);
  expect(requests.some((u) => /\/doodles-[^/]*\.js$/.test(u))).toBe(true);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((u) => /^https?:/.test(u) && !u.startsWith(origin))).toEqual([]);
});

test('Doodle-Datei lässt sich nicht laden: Projekt öffnet, Platzhalter und Meldung, Export bricht ab', async ({ page }) => {
  await page.route('**/doodles-*.js', (r) => r.abort());
  await openImported(page, 'doodle-logos-apple');
  await expect(page.getByLabel('Projektname')).toHaveValue('Doodle');
  await expect(page.getByRole('alert')).toContainText('Ein Scribble oder Icon fehlt');
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  const dialog = await startExport(page);
  await expect(dialog.getByRole('alert')).toContainText('Ein Scribble oder Icon fehlt');
  expect(downloaded).toBe(false);
});

test('Doodle-Datei lädt langsam: Projekt öffnet erst danach, ohne Platzhalter und Meldung', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/doodles-*.js', async (r) => {
    await gate;
    await r.continue();
  });
  await openImported(page, 'doodle-logos-apple');
  await expect(page.getByLabel('Projektname')).toBeHidden();
  release();
  await expect(page.getByLabel('Projektname')).toHaveValue('Doodle');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
