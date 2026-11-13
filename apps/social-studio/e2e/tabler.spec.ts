import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { bbzbsocial, elements, newProject } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await expect(dialog).not.toContainText('Fehler');
  return PNG.sync.read(Buffer.from(Object.values(files)[0]!));
}

const orangePixels = (png: PNG) => {
  const c = rgb(colors.orange);
  let n = 0;
  for (let i = 0; i < png.width * png.height; i++) if (c.every((v, k) => Math.abs(png.data[i * 4 + k]! - v) <= 6)) n++;
  return n;
};

const reopen = async (page: Page) => {
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.reload();
  await page.getByRole('listitem').getByRole('button', { name: 'Öffnen' }).click();
};

test('Tabler-Icon überlebt Speichern und Neuladen, Export direkt nach dem Öffnen', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => window.__bbzbTest.insertBrand('tabler-home'));
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect(((await elements(page))[0]!.props as { brandId: string }).brandId).toBe('tabler-home');
  await reopen(page);
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(orangePixels(await exportPng(page))).toBeGreaterThan(300);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((u) => /^https?:/.test(u) && !u.startsWith(origin))).toEqual([]);
});

const projectWith = (brandId: string) => ({
    schemaVersion: 1,
    id: 'fremd',
    name: 'Unbekannt',
    format: { id: 'post', width: 1080, height: 1350 },
    createdAt: 0,
    updatedAt: 0,
    slides: [{ id: 's1', background: 'warmweiss' }],
    elements: {
      e1: {
        id: 'e1', type: 'brand', name: 'Icon', x: 100, y: 100, width: 200, height: 200,
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
  await page.getByRole('listitem').filter({ hasText: 'Unbekannt' }).getByRole('button', { name: 'Öffnen' }).click();
};

test('Unbekanntes Tabler-Icon: Platzhalter und Meldung, App läuft weiter', async ({ page }) => {
  await openImported(page, 'tabler-gibtesnicht');
  await expect(page.getByRole('alert')).toContainText('Ein Scribble oder Icon fehlt');
  await expect(page.getByLabel('Projektname')).toHaveValue('Unbekannt');
});

const CHUNK = '**/outline-*.js';

test('Datei lässt sich nicht laden: Projekt öffnet, Platzhalter und Meldung, Export bricht ab', async ({ page }) => {
  await page.route(CHUNK, (r) => r.abort());
  await openImported(page, 'tabler-home');
  await expect(page.getByLabel('Projektname')).toHaveValue('Unbekannt');
  await expect(page.getByRole('alert')).toContainText('Ein Scribble oder Icon fehlt');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Ein Scribble oder Icon fehlt');
  expect(downloaded).toBe(false);
});

test('Datei lädt langsam: Projekt öffnet erst danach, ohne Platzhalter und Meldung', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(CHUNK, async (r) => {
    await gate;
    await r.continue();
  });
  await openImported(page, 'tabler-home');
  await expect(page.getByLabel('Projektname')).toBeHidden();
  release();
  await expect(page.getByLabel('Projektname')).toHaveValue('Unbekannt');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Datei lädt langsam: Doppelklick auf «Öffnen» öffnet einmal, Knopf zeigt «Wird geöffnet …», Liste gesperrt', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(CHUNK, async (r) => {
    await gate;
    await r.continue();
  });
  await openImported(page, 'tabler-home');
  const row = page.getByRole('listitem').filter({ hasText: 'Unbekannt' });
  const open = row.getByRole('button', { name: /öffnen$/ });
  await expect(open).toHaveText('Wird geöffnet …');
  await expect(open).toHaveAttribute('aria-disabled', 'true');
  await expect(row.getByRole('button', { name: /duplizieren$/ })).toHaveAttribute('aria-disabled', 'true');
  await open.dispatchEvent('click'); // weitere Klicks während des Ladens (aria-disabled lässt dblclick ewig warten)
  await open.dispatchEvent('click');
  release();
  await expect(page.getByLabel('Projektname')).toHaveValue('Unbekannt');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Unbekannt' })).toHaveCount(1); // kein zweites Projekt, Seite wieder bedienbar
  await expect(open).toHaveText('Öffnen');
});
