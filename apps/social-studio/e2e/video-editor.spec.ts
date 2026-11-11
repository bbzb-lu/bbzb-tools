import { expect, test, type Page } from '@playwright/test';
import { addScrim, bbzbsocial, elements, newProject, toggleEffect, toScreen } from './fixtures';
import { addVideo, probe, setStart, settled, twoTone } from './video';

test.beforeAll(twoTone);

test('Video zeigt das Startbild mit Look; anderer Start zeigt ein anderes Bild', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  const red = (await probe(page, id))!;
  expect(red.r).toBeGreaterThan(red.b + 60);
  await setStart(page, id, 3);
  await expect.poll(async () => (await probe(page, id))!.b).toBeGreaterThan(red.b + 60);
  const blue = (await probe(page, id))!;
  expect(blue.b).toBeGreaterThan(blue.r + 60);
  // Look wirkt: ohne ihn ist das Blau sichtbar anders (der Look wärmt)
  await page.getByRole('button', { name: 'BBZB-Look', exact: true }).click();
  await settled(page);
  const diff = async () => {
    const raw = (await probe(page, id))!;
    return Math.abs(raw.r - blue.r) + Math.abs(raw.g - blue.g) + Math.abs(raw.b - blue.b);
  };
  await expect.poll(diff).toBeGreaterThan(10);
});

test('Korn und Verlauf wirken auf das Video; Rahmen, Bildregler, Spiegeln fehlen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  const plain = (await probe(page, id))!;
  await toggleEffect(page, 'Korn');
  await settled(page);
  await expect.poll(async () => (await probe(page, id))!.sd).toBeGreaterThan(plain.sd + 1);
  await toggleEffect(page, 'Korn');
  await addScrim(page, 'Unten');
  await settled(page);
  await expect.poll(async () => (await probe(page, id))!.top - (await probe(page, id))!.bottom).toBeGreaterThan(10);

  // Effekt-Auswahl ohne Rahmen (Menü zu, die Einträge liegen schon im DOM)
  await expect(page.getByRole('menuitem', { name: /^Korn/, includeHidden: true })).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: /^Rahmen/, includeHidden: true })).toHaveCount(0);
  for (const name of ['Waagrecht spiegeln', 'Senkrecht spiegeln', 'Erweitert']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Helligkeit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toBeVisible();
  const el = (await elements(page))[0]!;
  const p = await toScreen(page, el.x + el.width / 2, el.y + el.height / 2);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Ausschnitt bearbeiten' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Spiegeln' })).toHaveCount(0);
});

test('Ausschnitt bearbeiten am Video: Zoomen ändert den Ausschnitt, Bild bleibt da', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  const scale = async () => ((await elements(page))[0]!.props as { crop: { scale: number } }).crop.scale;
  const before = await scale();
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  const el = (await elements(page))[0]!;
  const p = await toScreen(page, el.x + el.width / 2, el.y + el.height / 2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -100);
  await expect.poll(scale).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  await settled(page);
  expect((await probe(page, id))!.r).toBeGreaterThan(100);
});

test('Projekt neu laden: Video wieder da', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  await page.reload();
  await page.getByRole('listitem').first().getByRole('button', { name: 'Öffnen' }).click();
  await expect.poll(async () => (await probe(page, id))?.r ?? 0, { timeout: 15_000 }).toBeGreaterThan(100);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

const videoProject = (id: string, name: string) =>
  bbzbsocial({
    schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
    format: { id: 'post', width: 1080, height: 1350 },
    slides: [{ id: 's1', background: 'warmweiss' }],
    elements: {
      v: {
        id: 'v', type: 'photo', name: 'Foto 1', x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, visible: true, locked: false,
        props: { assetId: id, crop: { x: 0, y: 0, scale: 3.375 }, look: true, video: { start: 0, end: 4, sound: false, duration: 4 } },
      },
    },
    order: ['v'],
    assets: { [id]: { mime: 'video/mp4', width: 320, height: 400, name: 'clip.mp4' } },
  });
const missingNodes = (page: Page) =>
  page.evaluate(() => (window as unknown as { Konva: typeof import('konva').default }).Konva.stages[0]!.find('.missing-video').length);

test('Projektdatei ohne Video: Platzhalter mit Meldung, Export bricht ab', async ({ page }) => {
  const id = 'a'.repeat(64);
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: videoProject(id, 'Ohne Video') });
  await page.getByRole('button', { name: '«Ohne Video» öffnen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Video fehlt. Füge es neu ein.');
  await expect.poll(() => missingNodes(page)).toBe(1);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Video fehlt. Füge es neu ein.');
  expect(downloaded).toBe(false);
});

test('Video vorhanden, aber nicht dekodierbar: eigene Meldung, Export bricht ab, auch wenn das Dekodieren erst während des Exports scheitert', async ({ page }) => {
  const id = 'b'.repeat(64);
  // Das Lesen fürs Startbild wartet, bis der Export nach der ersten Platzhalter-Prüfung auf «effect-pending» wartet; der Export selbst liest sofort.
  await page.addInitScript((id) => {
    const w = window as unknown as { __exporting?: boolean; __release?: () => void };
    const held = new Promise<void>((r) => (w.__release = r));
    const orig = FileSystemFileHandle.prototype.getFile;
    FileSystemFileHandle.prototype.getFile = function (this: FileSystemFileHandle) {
      if (this.name !== id || w.__exporting) return orig.call(this);
      return held.then(() => orig.call(this));
    };
  }, id);
  await page.goto('');
  await page.evaluate(async (id) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('social-studio-assets', { create: true });
    const w = await (await dir.getFileHandle(id, { create: true })).createWritable();
    await w.write(new Blob(['kein Video, nur Text '.repeat(100)]));
    await w.close();
  }, id);
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: videoProject(id, 'Kaputt') });
  await page.getByRole('button', { name: '«Kaputt» öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.evaluate((pending) => {
    type K = typeof import('konva').default;
    const w = window as unknown as { __exporting: boolean; __release: () => void; Konva: K };
    w.__exporting = true;
    // Die Warteschleife des Exports fragt nach «effect-pending»: erst jetzt darf das Dekodieren des Startbilds scheitern
    const find = w.Konva.Container.prototype.findOne;
    w.Konva.Container.prototype.findOne = function (this: InstanceType<K['Container']>, sel: never) {
      if (sel === `.${pending}`) w.__release();
      return find.call(this, sel);
    } as typeof find;
  }, 'effect-pending');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Video lässt sich nicht abspielen. Füge es neu ein oder wandle es um.', { timeout: 15_000 });
  expect(downloaded).toBe(false);
  expect(await missingNodes(page)).toBe(1);
});
