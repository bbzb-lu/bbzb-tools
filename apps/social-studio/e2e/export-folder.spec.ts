import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { addPhoto, addSlide, newProject, png } from './fixtures';

const SHOTS = process.env.SHOTS; // Screenshots nur auf Wunsch
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

async function open(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1080, 1350));
  await addSlide(page);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  return dialog;
}
const files = (page: Page, clear = false) => page.evaluate((c) => window.__bbzbTest.folderFiles(c), clear);

test('Ordner-Export: gleiche Dateinamen und Bytes wie im ZIP, Meldung nennt den Ordner', async ({ page }) => {
  const dialog = await open(page);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const zip = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await page.evaluate(() => window.__bbzbTest.fakePicker('opfs'));
  try {
    await files(page, true);
    await dialog.getByRole('button', { name: 'In Ordner speichern' }).click();
    await expect(dialog.getByRole('status')).toContainText(/Gespeichert in «.+»\./);
    const written = await files(page);
    expect(Object.keys(written)).toHaveLength(2);
    const stripped = Object.fromEntries(Object.entries(written).map(([k, v]) => [k.slice(k.indexOf('/') + 1), v]));
    expect(stripped).toEqual(Object.fromEntries(Object.entries(zip).map(([k, v]) => [k, sha(v)])));
    expect(Object.keys(written)[0]).toMatch(new RegExp(`^${Object.keys(zip)[0]!.replace(/_01\.png$/, '')}/`));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-10-folder.png` });
  } finally {
    await files(page, true);
  }
});

test('Ordnerdialog abgebrochen: keine Meldung, nichts läuft', async ({ page }) => {
  const dialog = await open(page);
  await page.evaluate(() => window.__bbzbTest.fakePicker('abort'));
  await dialog.getByRole('button', { name: 'In Ordner speichern' }).click();
  await expect(dialog.getByRole('button', { name: 'In Ordner speichern' })).toBeEnabled();
  await expect(dialog.getByRole('status')).toBeEmpty();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('Ordnerzugriff verweigert: Meldung, ZIP-Knopf bleibt aktiv', async ({ page }) => {
  const dialog = await open(page);
  await page.evaluate(() => window.__bbzbTest.fakePicker('security'));
  await dialog.getByRole('button', { name: 'In Ordner speichern' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Edge erlaubt hier keinen Ordnerzugriff. Nimm «ZIP herunterladen».');
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
});

test('Abbrechen in der Vorbereitung wirkt innert 500 ms, danach klappt ein zweiter Export', async ({ page }) => {
  const dialog = await open(page);
  await page.evaluate(() => window.__bbzbTest.holdEffects(true));
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Export wird vorbereitet …');
  const bar = dialog.getByRole('progressbar');
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(bar).toHaveAttribute('aria-valuetext', 'Export wird vorbereitet …');
  await expect(dialog.getByRole('group', { name: 'Format' })).toContainText('Während des Exports gesperrt.');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Export abgebrochen.', { timeout: 500 });
  await page.evaluate(() => window.__bbzbTest.holdEffects(false));
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(await (await download).path()))))).toHaveLength(2);
});

test('Fortschrittsbalken: aria-valuenow vorhanden, aria-valuetext gleich dem sichtbaren Text', async ({ page }) => {
  const dialog = await open(page);
  const busyFreeWidth = await dialog.locator('.segmented').first().evaluate((e) => e.getBoundingClientRect().width);
  await page.evaluate(() => window.__bbzbTest.holdEffects(true));
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuetext', await dialog.getByRole('status').innerText());
  // Format gesperrt: Hinweis hängt per aria-describedby an der Option; Auswahlfläche liegt auf der gewählten Option, Breite wie im Leerlauf
  const group = dialog.getByRole('group', { name: 'Format' });
  const hintId = await group.getByRole('radio', { name: 'PNG' }).getAttribute('aria-describedby');
  await expect(dialog.locator(`[id="${hintId}"]`)).toHaveText('Während des Exports gesperrt.');
  await page.waitForTimeout(1000);
  const box = (l: ReturnType<Page['locator']>) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.width] as [number, number]; });
  const [hx, hw] = await box(group.locator('.slide-hl'));
  const [ox, ow] = await box(group.locator('label:has(input:checked)').first());
  expect(Math.abs(hx - ox)).toBeLessThan(1);
  expect(Math.abs(hw - ow)).toBeLessThan(1);
  expect((await box(group.locator('.segmented').first()))[1]).toBe(busyFreeWidth);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-10-busy.png` });
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await page.evaluate(() => window.__bbzbTest.holdEffects(false));
});
