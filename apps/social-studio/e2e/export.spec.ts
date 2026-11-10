import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { addPhoto, bbzbsocial, columnPng, elements, exportPng, gradientPng, meanDiff, newProject, toScreen, view, addSlide, openSection } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const px = (png: PNG, x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
const maxChannelDiff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

/** Breite × Höhe aus dem SOF-Marker (Baseline oder Progressive). */
function jpegSize(b: Uint8Array): [number, number] {
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xc2) return [(b[i + 7]! << 8) | b[i + 8]!, (b[i + 5]! << 8) | b[i + 6]!];
    i += 2 + ((b[i + 2]! << 8) | b[i + 3]!);
  }
  throw new Error('kein SOF');
}

async function importAndOpen(page: Page, file: Buffer, name: string) {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
}

async function exportZip(page: Page, format: 'JPEG' | 'PNG') {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(format).check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const d = await download;
  return { zipName: d.suggestedFilename(), files: unzipSync(new Uint8Array(await readFile(await d.path()))) };
}

/** 2 Slides auf Blauschwarz, Verlauf 2160 × 1350 mit Ausschnitt 0/0/1 in einem Rahmen der Breite `frameWidth`. */
function twoSlides(name: string, frameWidth: number, png = gradientPng(2160, 1350)) {
  const id = createHash('sha256').update(png).digest('hex');
  const project = {
    schemaVersion: 1, id: 'p', name, createdAt: 0, updatedAt: 0,
    format: { id: 'post', width: 1080, height: 1350 },
    slides: [{ id: 's1', background: 'blauschwarz' }, { id: 's2', background: 'blauschwarz' }],
    elements: {
      e1: {
        id: 'e1', type: 'photo', name: 'Foto', x: 0, y: 0, width: frameWidth, height: 1350,
        rotation: 0, opacity: 1, visible: true, locked: false,
        props: { assetId: id, crop: { x: 0, y: 0, scale: 1 } },
      },
    },
    order: ['e1'],
    assets: { [id]: { mime: 'image/png', width: 2160, height: 1350, name: 'verlauf.png' } },
  };
  return { id, file: bbzbsocial(project, { [id]: png }) };
}

test('Foto über die Naht: Slides schliessen lückenlos an', async ({ page }) => {
  await importAndOpen(page, twoSlides('Nahttest', 2160).file, 'Nahttest');
  const { zipName, files } = await exportZip(page, 'PNG');
  expect(zipName).toBe('Nahttest.zip');
  expect(Object.keys(files)).toEqual(['Nahttest_01.png', 'Nahttest_02.png']);
  const [a, b] = Object.values(files).map((f) => PNG.sync.read(Buffer.from(f)));
  expect([a!.width, a!.height]).toEqual([1080, 1350]);
  expect([b!.width, b!.height]).toEqual([1080, 1350]);
  for (let y = 0; y < 1350; y += 50) {
    const last = px(a!, 1079, y);
    const first = px(b!, 0, y);
    expect(maxChannelDiff(last, first)).toBeLessThanOrEqual(3);
    expect(last).not.toEqual(rgb(colors.blauschwarz));
    expect(first).not.toEqual(rgb(colors.blauschwarz));
  }
});

for (const clicks of [0, 4]) {
test(`Naht spaltengenau: jede Slide zeigt genau ihre 1080 Quellspalten (${clicks ? 'Zoom 244 %' : 'Einpassen'})`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 }); // zwei Slides passen eingepasst nebeneinander (seit 4c ohne Werkzeugleiste über der Leinwand)
  await importAndOpen(page, twoSlides('Spalten', 2160, columnPng(2160, 1350)).file, 'Spalten');
  if (clicks) {
    for (let i = 0; i < clicks; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
    await expect(page.locator('.zoom-value')).toHaveText('244 %');
  } else expect((await view(page)).x).toBeGreaterThan(24); // zwei Slides passen: Ansicht zentriert
  const { files } = await exportZip(page, 'PNG');
  const [a, b] = Object.values(files).map((f) => PNG.sync.read(Buffer.from(f)));
  const column = (png: PNG, x: number, y: number) => {
    const [r, g] = px(png, x, y);
    return r! + g! * 256;
  };
  for (let y = 0; y < 1350; y += 50) {
    expect([column(a!, 0, y), column(a!, 1079, y), column(b!, 0, y), column(b!, 1079, y)]).toEqual([0, 1079, 1080, 2159]);
  }
});
}

test('Export bei Zoom 300 %: unverändert spaltengenau, 1080 × 1350', async ({ page }) => {
  await importAndOpen(page, twoSlides('Zoom', 2160, columnPng(2160, 1350)).file, 'Zoom');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(page.locator('.zoom-value')).toHaveText('305 %');
  const { files } = await exportZip(page, 'PNG');
  const [a, b] = Object.values(files).map((f) => PNG.sync.read(Buffer.from(f)));
  expect([a!.width, a!.height, b!.width, b!.height]).toEqual([1080, 1350, 1080, 1350]);
  for (let y = 0; y < 1350; y += 50) {
    expect([px(a!, 0, y), px(a!, 1079, y), px(b!, 0, y), px(b!, 1079, y)].map(([r, g]) => r! + g! * 256)).toEqual([0, 1079, 1080, 2159]);
  }
});

test('JPEG-Export: Namen, Grösse 1080 × 1350, keine Auswahlrahmen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Sporttag');
  await page.getByLabel('Projektname').press('Enter');
  // Slide zuerst: ein Slide-Wechsel hebt die Auswahl eines Elements ausserhalb der neuen Slide auf.
  await addSlide(page);
  await page.getByRole('button', { name: 'Slide 1', exact: true }).click();
  // Blau → Warmweiss: nirgends Orange, die Transformer-Farbe würde also auffallen.
  await addPhoto(page, { name: 'f.png', mimeType: 'image/png', buffer: gradientPng(800, 1000, rgb(colors.blau), rgb(colors.warmweiss)) });
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  const { zipName, files } = await exportZip(page, 'JPEG');
  expect(zipName).toBe('Sporttag.zip');
  expect(Object.keys(files)).toEqual(['Sporttag_01.jpg', 'Sporttag_02.jpg']);
  const jpg = files['Sporttag_01.jpg']!;
  expect(jpegSize(jpg)).toEqual([1080, 1350]);
  const orange = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! > 180 && d[i + 1]! < 150 && d[i + 2]! < 110) n++;
    return n;
  }, Array.from(jpg));
  expect(orange).toBe(0);
  // Auswahl bleibt nach dem Export bestehen.
  expect(await page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
});

test('Story-Export ist 1080 × 1920', async ({ page }) => {
  await newProject(page, 'Story 9:16');
  await page.getByLabel('Projektname').fill('Story');
  await page.getByLabel('Projektname').press('Enter');
  const { files } = await exportZip(page, 'JPEG');
  expect(Object.keys(files)).toEqual(['Story_01.jpg']);
  expect(jpegSize(files['Story_01.jpg']!)).toEqual([1080, 1920]);
});

test('fehlende Schrift sperrt den Export', async ({ page }) => {
  await page.route('**/seguibl*.ttf', (r) => r.fulfill({ status: 404 }));
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toHaveText('Schrift «Segoe UI Black» fehlt. Export abgebrochen. Lade die Seite neu.');
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeDisabled();
});

test('Projektdatei sichern und wieder öffnen ergibt dieselben Elemente', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Bühne: Sicherung');
  await page.getByLabel('Projektname').press('Enter');
  await addPhoto(page, { name: 'f.png', mimeType: 'image/png', buffer: gradientPng(600, 400) });
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  const before = await elements(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('Buehne-Sicherung.bbzbsocial');
  const file = await readFile(await d.path());

  await page.getByLabel('Projektname').fill('Original');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: d.suggestedFilename(), mimeType: 'application/zip', buffer: file });
  await page.getByRole('listitem').filter({ hasText: 'Bühne: Sicherung' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Bühne: Sicherung');
  expect(await elements(page)).toEqual(before);
});

test('Ausschnittmodus landet nicht im Export', async ({ page }) => {
  // Rahmen nur auf Slide 1: der halbtransparente Rest des Bildes läge im Ausschnittmodus auf Slide 2.
  await importAndOpen(page, twoSlides('Ausschnitt', 1080).file, 'Ausschnitt');
  const p = await toScreen(page, 200, 200);
  // erst klicken, wenn das Bild geladen ist (vorher trifft der Klick nichts)
  await expect.poll(() => page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [p.x, p.y])).toBe('e1');
  await page.mouse.dblclick(p.x, p.y);
  await openSection(page, 'Bild');
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toHaveAttribute('aria-pressed', 'true');
  const { files } = await exportZip(page, 'PNG');
  const b = PNG.sync.read(Buffer.from(files['Ausschnitt_02.png']!));
  for (let x = 0; x < 1080; x += 60) expect(px(b, x, 600)).toEqual(rgb(colors.blauschwarz));
});

test('fehlendes Bild bricht den Export mit Meldung ab', async ({ page }) => {
  const { id, file } = twoSlides('Ohne Bild', 2160);
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await expect(page.getByRole('listitem').filter({ hasText: 'Ohne Bild' })).toBeVisible();
  await page.evaluate(async (id) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('social-studio-assets');
    await dir.removeEntry(id);
  }, id);
  await page.getByRole('listitem').filter({ hasText: 'Ohne Bild' }).getByRole('button', { name: 'Öffnen' }).click();
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Ein Bild fehlt im Speicher. Öffne die Projektdatei erneut.');
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
  expect(downloaded).toBe(false);
});

test('während Schriften laden ist der Export gesperrt', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/seguibl*.ttf', async (r) => {
    await held;
    await r.continue();
  });
  await page.goto('', { waitUntil: 'commit' }); // «load» wartet auf die zurückgehaltene Schrift
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.keyboard.press('Escape'); // Layout-Wahl zum Start schliessen
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Schriften werden geladen …' })).toBeDisabled();
  release();
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
});

test('während des Exports bleibt der Dialog offen und zeigt den Fortschritt', async ({ page }) => {
  const project = {
    schemaVersion: 1, id: 'p', name: 'Viele', createdAt: 0, updatedAt: 0,
    format: { id: 'story', width: 1080, height: 1920 },
    slides: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, background: 'blau' })),
    elements: {}, order: [], assets: {},
  };
  await importAndOpen(page, bbzbsocial(project), 'Viele');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('status')).toHaveText(/^Slide \d+ von 20$/);
  await expect(dialog.getByRole('button', { name: 'Schliessen' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  expect(Object.keys(files)).toHaveLength(20);
  expect(Object.keys(files)[19]).toBe('Viele_20.png');
});

test('Golden Image: zwei Verläufe (dunkel oben links, hell unten rechts), mittlere Abweichung je Kanal höchstens 2 %', async ({ page }) => {
  const photo = gradientPng(1080, 1350, [128, 128, 128], [128, 128, 128]);
  const id = createHash('sha256').update(photo).digest('hex');
  const scrims = [{ side: 'obenLinks', strength: 'stark' }, { side: 'untenRechts', strength: 'stark', light: true }];
  const file = bbzbsocial(
    {
      schemaVersion: 1, id: 'v', name: 'Verlaeufe', createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [{ id: 's1', background: 'warmweiss' }],
      elements: {
        f: {
          id: 'f', type: 'photo', name: 'Foto', x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, visible: true, locked: false,
          props: { assetId: id, crop: { x: 0, y: 0, scale: 1 }, grain: false, look: false, scrims },
        },
      },
      order: ['f'],
      assets: { [id]: { mime: 'image/png', width: 1080, height: 1350, name: 'grau.png' } },
    },
    { [id]: photo },
  );
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'v.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await page.getByRole('button', { name: '«Verlaeufe» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Verlaeufe');
  const [got] = await exportPng(page);
  const golden = `${import.meta.dirname}/golden/verlaeufe-zwei.png`;
  // Erzeugen: UPDATE_GOLDEN=1 npx playwright test export
  if (process.env.UPDATE_GOLDEN) writeFileSync(golden, PNG.sync.write(got!));
  meanDiff(got!, PNG.sync.read(readFileSync(golden))).forEach((d) => expect(d / 255).toBeLessThanOrEqual(0.02));
  // Ecken: oben links dunkler, unten rechts heller als das Foto-Grau; die Gegenecken liegen schräg im auslaufenden Rand beider Verläufe
  expect(px(got!, 0, 0)[0]).toBeLessThan(60);
  expect(px(got!, 1079, 1349)[0]).toBeGreaterThan(190);
  expect(px(got!, 1079, 0)[0]).toBeLessThan(128);
  expect(px(got!, 1079, 0)[0]).toBeGreaterThan(60);
  expect(px(got!, 0, 1349)[0]).toBeGreaterThan(128);
  expect(px(got!, 0, 1349)[0]).toBeLessThan(190);
});
