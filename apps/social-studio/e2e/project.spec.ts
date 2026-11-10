import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { addPhoto, bbzbsocial, elements, gradientPng, newProject, png } from './fixtures';

const chooseFile = (page: Page, buffer: Buffer) =>
  page.locator('input[type=file]').setInputFiles({ name: 'test.bbzbsocial', mimeType: 'application/zip', buffer });

test('neues Projekt überlebt Neuladen, auch direkt nach Umbenennen', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.getByLabel('Projektname').fill('Sporttag');
  await page.getByLabel('Projektname').press('Enter');
  await page.reload(); // kein Warten auf Debounce
  await expect(page.getByRole('listitem').filter({ hasText: 'Sporttag' })).toBeVisible();
});

test('neues Projekt heisst «Projekt TT.MM.JJJJ», Übersicht führt zurück', async ({ page }) => {
  await newProject(page, 'Story 9:16');
  const today = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  await expect(page.getByLabel('Projektname')).toHaveValue(`Projekt ${today}`);
  await page.getByRole('button', { name: 'Übersicht' }).click();
  const item = page.getByRole('listitem');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(`Projekt ${today}`);
  await expect(item).toContainText('Story 9:16');
  await item.getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(`Projekt ${today}`);
});

test('Löschen fragt nach und entfernt das Projekt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Weg damit');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  // Jede Zeile nennt ihr Projekt, damit der Screenreader die Knöpfe unterscheidet.
  await expect(page.getByRole('button', { name: '«Weg damit» öffnen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '«Weg damit» löschen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('«Weg damit» löschen? Das lässt sich nicht rückgängig machen.');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('listitem').getByRole('button', { name: 'Löschen' }).click();
  await dialog.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByText('Noch keine Projekte.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Noch keine Projekte.')).toBeVisible();
});

test('kaputte Projektdatei zeigt Meldung, Liste bleibt gleich', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await chooseFile(page, Buffer.from('kaputt'));
  await expect(page.getByRole('alert')).toHaveText('Diese Datei ist keine BBZB-Projektdatei.');
  await expect(page.getByRole('listitem')).toHaveCount(1);
});

test('gültige Projektdatei wird als neues Projekt importiert', async ({ page }) => {
  const png = gradientPng(400, 200);
  const id = createHash('sha256').update(png).digest('hex');
  const project = {
    schemaVersion: 1,
    id: 'fremd',
    name: 'Importiert',
    format: { id: 'post', width: 1080, height: 1350 },
    createdAt: 0,
    updatedAt: 0,
    slides: [{ id: 's1', background: 'warmweiss' }],
    elements: {
      e1: {
        id: 'e1', type: 'photo', name: 'Foto', x: 0, y: 0, width: 1080, height: 540,
        rotation: 0, opacity: 1, visible: true, locked: false,
        props: { assetId: id, crop: { x: 0, y: 0, scale: 1 } },
      },
    },
    order: ['e1'],
    assets: { [id]: { mime: 'image/png', width: 400, height: 200, name: 'verlauf.png' } },
  };
  await page.goto('');
  await chooseFile(page, bbzbsocial(project, { [id]: png }));
  await expect(page.getByRole('listitem').filter({ hasText: 'Importiert' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const stored = await page.evaluate(async (name) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('social-studio-assets');
    return (await (await dir.getFileHandle(name)).getFile()).size;
  }, id);
  expect(stored).toBe(png.length);
});

test('Schriften sind geladen', async ({ page }) => {
  await page.goto('');
  const status = (family: string) =>
    page.evaluate((f) => [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f).map((x) => x.status), family);
  await expect.poll(() => status('BBZB Titel')).toEqual(['loaded']);
  await expect.poll(() => status('BBZB Kommentar')).toEqual(['loaded']);
});

test('fehlende Schrift zeigt dauerhaftes Banner im Editor', async ({ page }) => {
  await page.route('**/seguibl-*.ttf', (r) => r.abort());
  await newProject(page, 'Post 4:5');
  await expect(page.getByRole('alert')).toHaveText('Schrift «Segoe UI Black» fehlt. Export ist gesperrt. Lade die Seite neu.');
});

test('Duplizieren: Kopie steht oben, überlebt das Löschen des Originals samt Foto', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 200));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.getByLabel('Projektname').fill('Sporttag');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: '«Sporttag» duplizieren', exact: true }).click();
  const items = page.getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Sporttag (Kopie)');
  await page.getByRole('button', { name: '«Sporttag» löschen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(items).toHaveCount(1);
  await page.reload(); // die Kopie behält ihre Asset-IDs, auch nachdem das Original weg ist (GC-Teilen: storage.test.ts)
  await page.getByRole('button', { name: '«Sporttag (Kopie)» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Sporttag (Kopie)');
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await download;
  await expect(page.getByText('Ein Bild fehlt im Speicher.')).toHaveCount(0);
});

test('Duplizieren: Doppelklick erzeugt genau eine Kopie', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Doppel');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: '«Doppel» duplizieren', exact: true }).dblclick();
  await expect(page.getByRole('button', { name: '«Doppel (Kopie)» öffnen', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Doppel (Kopie)' })).toHaveCount(1);
  await expect(page.getByRole('listitem')).toHaveCount(2);
});
