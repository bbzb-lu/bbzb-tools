import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, newProject, overlayVsElement, png, toScreen, openSection } from './fixtures';

const IMPORT_ERROR =
  'Dieses Bild kann Edge nicht öffnen. Schick es als JPEG, auf dem iPhone unter Einstellungen › Kamera › Formate «Maximale Kompatibilität» wählen.';
const STORAGE_FULL = 'Speicher voll. Sichere ältere Projekte als Datei und lösche sie hier.';

test('Foto per Dateiauswahl wird im Originalformat in die aktuelle Slide gesetzt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(() => elements(page)).toMatchObject([{ type: 'photo', x: 0, y: 315, width: 1080, height: 720 }]);
  // Bild liegt im OPFS und wird ohne Fehlermeldung angezeigt
  const ids = await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('social-studio-assets');
    const out: string[] = [];
    for await (const name of dir.keys()) out.push(name);
    return out;
  });
  const [el] = await elements(page);
  expect(ids).toContain((el!.props as { assetId: string }).assetId);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('48-MP-Foto wird auf 4096 px verkleinert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(8000, 6000));
  await expect.poll(() => elements(page), { timeout: 30_000 }).toHaveLength(1);
  const assets = await page.evaluate(() => Object.values(window.__bbzbTest.project().assets));
  expect(assets).toMatchObject([{ width: 4096, height: 3072, mime: 'image/png' }]);
});

test('nicht lesbare Datei zeigt Meldung', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
  await addPhoto(page, { name: 'foto.heic', mimeType: 'image/heic', buffer: heic });
  await expect(page.getByRole('alert')).toHaveText(IMPORT_ERROR);
  expect(await elements(page)).toEqual([]);
});

test('Speicher voll: Meldung, kein Element', async ({ page }) => {
  await page.addInitScript(() => {
    FileSystemWritableFileStream.prototype.write = () => Promise.reject(new DOMException('quota', 'QuotaExceededError'));
  });
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect(page.getByRole('alert')).toHaveText(STORAGE_FULL);
  expect(await elements(page)).toEqual([]);
});

test('Ziehen ergibt einen Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const o = await toScreen(page, 0, 0);
  await page.mouse.move(o.x + 126, o.y + 126);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(o.x + 126 + i * 20, o.y + 126);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.x).toBeGreaterThan(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(0);
  expect(await elements(page)).toHaveLength(1);
});

test('Ausschnitt: Mausrad-Zoom ist ein Undo-Schritt, Escape beendet', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const crop = async () => ((await elements(page))[0]!.props as { crop: { scale: number } }).crop;
  const before = await crop();
  const o = await toScreen(page, 0, 0);
  await openSection(page, 'Bild');
  await page.mouse.dblclick(o.x + 176, o.y + 176);
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await crop()).scale).toBeGreaterThan(before.scale);
  await page.waitForTimeout(400); // Geste endet 300 ms nach dem letzten Rad-Event
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+z');
  await expect.poll(crop).toEqual(before);
});

test('Skalieren am Anfasser: neue Grösse, Ausschnitt bleibt deckend, ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const scale = await page.evaluate(() => {
    const p = window.__bbzbTest.project();
    return (document.querySelector('.canvas-scroll')!.clientHeight - 48) / p.format.height;
  });
  const o = await toScreen(page, 0, 0);
  // rechter mittlerer Anfasser: x = 24 + 1080 × Massstab, y = 24 + 675 × Massstab
  const ax = o.x + 1080 * scale;
  const ay = o.y + 675 * scale;
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(ax + i * 20, ay);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.width).toBeGreaterThan(1080);
  const [el] = await elements(page);
  const { crop } = el!.props as { crop: { x: number; y: number; scale: number } };
  expect(1200 * crop.scale).toBeGreaterThanOrEqual(el!.width - 0.001);
  expect(el!.height).toBeCloseTo(1350);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.width).toBe(1080);
});

const canvasScale = (page: Page) =>
  page.evaluate(() => (document.querySelector('.canvas-scroll')!.clientHeight - 48) / window.__bbzbTest.project().format.height);

test('EXIF-Daten landen nicht im Speicher', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const jpeg = Buffer.from(
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(200, 100);
      c.getContext('2d')!.fillRect(0, 0, 200, 100);
      return [...new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg' })).arrayBuffer())];
    }),
  );
  // minimales APP1-Segment: «Exif\0\0» + TIFF-Kopf (MM, 42, IFD bei 8) + leeres IFD
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0])]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0, body.length + 2]), body]);
  const withExif = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
  expect(withExif.includes('Exif')).toBe(true);
  await addPhoto(page, { name: 'handy.jpg', mimeType: 'image/jpeg', buffer: withExif });
  await expect.poll(() => elements(page)).toHaveLength(1);
  const stored = await page.evaluate(async () => {
    const id = (window.__bbzbTest.elements()[0]!.props as { assetId: string }).assetId;
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('social-studio-assets');
    const bytes = new Uint8Array(await (await (await dir.getFileHandle(id)).getFile()).arrayBuffer());
    return { exif: new TextDecoder('latin1').decode(bytes).includes('Exif'), size: bytes.length };
  });
  expect(stored.size).toBeGreaterThan(0);
  expect(stored.exif).toBe(false);
});

test('Datei ohne passenden Typ: Hinweis beim Ablegen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['hallo'], 'notiz.txt', { type: 'text/plain' }));
    return dt;
  });
  await page.locator('.canvas-scroll').dispatchEvent('drop', { dataTransfer });
  await expect(page.getByRole('alert')).toHaveText('Diese Datei kann ich nicht verwenden. Erlaubt sind Fotos.');
  expect(await elements(page)).toEqual([]);
});

test('Ausschnitt bis an den Rand ziehen: Bild deckt den Rahmen weiter ab', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(2160, 2700)); // genau 4:5: füllt die Slide
  await expect.poll(() => elements(page)).toHaveLength(1);
  const o = await toScreen(page, 0, 0);
  const x0 = o.x + 176;
  const y0 = o.y + 276;
  await page.mouse.dblclick(x0, y0);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100); // hineinzoomen, sonst gibt es nichts zu verschieben
  await expect.poll(async () => ((await elements(page))[0]!.props as { crop: { scale: number } }).crop.scale).toBeGreaterThan(0.5);
  for (const dx of [2000, -4000]) {
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (dx * i) / 10, y0 + (dx * i) / 20);
    await page.mouse.up();
    const [el] = await elements(page);
    const { crop } = el!.props as { crop: { x: number; y: number; scale: number } };
    expect(crop.x).toBeLessThanOrEqual(0);
    expect(crop.y).toBeLessThanOrEqual(0);
    expect(crop.x + 2160 * crop.scale).toBeGreaterThanOrEqual(1080 - 0.001);
    expect(crop.y + 2700 * crop.scale).toBeGreaterThanOrEqual(1350 - 0.001);
  }
  const { crop } = (await elements(page))[0]!.props as { crop: { x: number; scale: number } };
  expect(crop.x).toBeCloseTo(1080 - 2160 * crop.scale); // am linken Anschlag
});

test('Drehen am Drehanfasser ist ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  const ax = o.x + 540 * scale;
  const ay = o.y - 16; // Drehanfasser 16 px über der Mitte oben
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(ax + i * 40, ay + i * 20);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.rotation).not.toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.rotation).toBe(0);
});

type TextProps = { text: string; style: string; color: string; fontSize: number; align: string; lineHeight?: number };
const textProps = async (page: Page) => (await elements(page))[0]!.props as TextProps;
const textOf = (page: Page) => async () => (await textProps(page)).text;

/** Bildschirmpunkt in der Mitte des ersten Elements. */
async function elementCenter(page: Page) {
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  const [el] = await elements(page);
  return { x: o.x + (el!.x + el!.width / 2) * scale, y: o.y + (el!.y + el!.height / 2) * scale };
}

async function addText(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
}

test('Text hinzufügen, auf der Leinwand bearbeiten, Undo', async ({ page }) => {
  await addText(page);
  const [el] = await elements(page);
  // Rand 72, Breite 1080 − 2 × 72, Höhe gemessen (eine Zeile Titel: 150 × 0.86)
  expect(el).toMatchObject({ type: 'text', x: 72, y: 72, width: 936 });
  expect(el!.height).toBeCloseTo(129, 0);
  expect(el!.props).toEqual({ text: 'Titel', style: 'titel', color: 'blauschwarz', fontSize: 150, align: 'left' });
  const c = await elementCenter(page);
  await page.mouse.dblclick(c.x, c.y);
  await expect(page.locator('textarea')).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Sporttag 2026');
  await page.mouse.click(5, 5); // Blur
  await expect.poll(textOf(page)).toBe('Sporttag 2026');
  await expect(page.locator('textarea')).toHaveCount(0);
  await page.keyboard.press('Control+Z');
  await expect.poll(textOf(page)).toBe('Titel');
});

test('Escape verwirft, Ctrl+Enter übernimmt, leerer Text löscht', async ({ page }) => {
  await addText(page);
  const c = await elementCenter(page);
  await page.mouse.dblclick(c.x, c.y);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('weg damit');
  await page.keyboard.press('Escape');
  await expect(page.locator('textarea')).toHaveCount(0);
  expect(await textOf(page)()).toBe('Titel');
  // lange Zeile bricht um: Höhe wird neu gemessen
  await page.mouse.dblclick(c.x, c.y);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Sporttag in Luzern am Mittwoch');
  await page.keyboard.press('Control+Enter');
  await expect.poll(textOf(page)).toBe('Sporttag in Luzern am Mittwoch');
  expect((await elements(page))[0]!.height).toBeGreaterThan(200);
  await page.mouse.dblclick(c.x, c.y);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+Enter');
  await expect.poll(() => elements(page)).toHaveLength(0);
  await page.keyboard.press('Control+Z');
  await expect.poll(textOf(page)).toBe('Sporttag in Luzern am Mittwoch');
});

test('Stil Kommentar und Farbe Orange wirken', async ({ page }) => {
  await addText(page);
  await page.getByRole('radio', { name: 'Kommentar' }).check();
  await page.getByRole('radio', { name: 'Orange' }).check();
  await expect.poll(() => textProps(page)).toMatchObject({ style: 'kommentar', color: 'orange', fontSize: 62 });
  expect((await elements(page))[0]!.height).toBeCloseTo(62 * (76 / 66), 0);
  // Pfeiltasten wechseln die Farbe in der Radiogruppe
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await textProps(page)).color).toBe('warmweiss');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await textProps(page)).color).toBe('orange');
  // Orange ist auf der Leinwand gezeichnet (Inhaltsebene); gross, damit volle Pixel ohne Kantenglättung entstehen
  await page.getByRole('spinbutton', { name: 'Grösse' }).fill('300');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(300);
  const hasOrange = () =>
    page.evaluate(() => {
      const cv = document.querySelector<HTMLCanvasElement>('.konvajs-content canvas')!;
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i]! > 240 && Math.abs(d[i + 1]! - 78) < 16 && d[i + 2]! < 30) return true;
      return false;
    });
  await expect.poll(hasOrange).toBe(true);
  await page.getByRole('radio', { name: 'Mitte' }).check();
  await expect.poll(async () => (await textProps(page)).align).toBe('center');
});

test('Grössenregler erzeugt einen Undo-Schritt', async ({ page }) => {
  await addText(page);
  const slider = page.getByRole('slider', { name: 'Grösse' });
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.24, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.24 + i * 0.05), y);
  await page.mouse.up();
  await expect.poll(async () => (await textProps(page)).fontSize).toBeGreaterThan(250);
  expect(await page.getByRole('spinbutton', { name: 'Grösse' }).inputValue()).toBe(String((await textProps(page)).fontSize));
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(150);
  expect(await elements(page)).toHaveLength(1);
  // Tastatur: Pfeil auf dem Regler, danach ist die Geste beendet und Undo wirkt
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(151);
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(150);
  // Zahlenfeld: übernimmt erst bei Enter bzw. Blur, als ein Schritt
  const field = page.getByRole('spinbutton', { name: 'Grösse' });
  await field.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('120');
  expect((await textProps(page)).fontSize).toBe(150);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(120);
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(150);
  // ausserhalb des Bereichs: auf 8..600 begrenzt
  await field.fill('9999');
  await field.blur();
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(600);
  // ungültig: Feld zeigt wieder den gespeicherten Wert
  await field.fill('');
  await field.blur();
  await expect(field).toHaveValue('600');
  expect((await textProps(page)).fontSize).toBe(600);
});

test('Tab über den Grössenregler lässt keine Geste offen', async ({ page }) => {
  await addText(page);
  const slider = page.getByRole('slider', { name: 'Grösse' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  // Das Zahlenfeld steht rechts neben der Bahn (nach dem Regler in der Tab-Reihenfolge): zwei Tabs bis zum Regler
  // «Zeilenabstand» (seit Phase 4c immer sichtbar), der keyup landet schon dort
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('slider', { name: 'Zeilenabstand' })).toBeFocused();
  await expect.poll(async () => (await textProps(page)).fontSize).toBe(151);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await textProps(page)).lineHeight).toBe(101);
  // nur per Tastatur, ohne Maus: Fokus verlassen, dann Undo
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await textProps(page)).lineHeight ?? 100).toBe(100);
  expect((await textProps(page)).fontSize).toBe(151);
});

test('Übersicht während der Textbearbeitung behält den Text', async ({ page }) => {
  await addText(page);
  const name = await page.getByLabel('Projektname').inputValue();
  const c = await elementCenter(page);
  await page.mouse.dblclick(c.x, c.y);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Bleibt da');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await expect.poll(textOf(page)).toBe('Bleibt da');
});

for (const style of ['Titel', 'Kommentar'] as const) {
  test(`Textarea liegt deckungsgleich auf dem Text (${style})`, async ({ page }) => {
    await addText(page);
    if (style === 'Kommentar') await page.getByText('Kommentar', { exact: true }).click();
    await expect.poll(async () => (await textProps(page)).style).toBe(style.toLowerCase());
    const c = await elementCenter(page);
    await page.mouse.dblclick(c.x, c.y);
    const { ta, el } = await overlayVsElement(page);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(ta[k] - el[k]), k).toBeLessThanOrEqual(1.5);
  });
}

test('gedrehter Text: Textarea dreht gleich', async ({ page }) => {
  await addText(page);
  const id = (await elements(page))[0]!.id;
  await page.evaluate((i) => window.__bbzbTest.patch(i, { rotation: 15 }), id);
  await expect.poll(async () => (await elements(page))[0]!.rotation).toBe(15);
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  const [e] = await elements(page);
  const r = (15 * Math.PI) / 180;
  const [hx, hy] = [e!.width / 2, e!.height / 2];
  await page.mouse.dblclick(o.x + (e!.x + hx * Math.cos(r) - hy * Math.sin(r)) * scale, o.y + (e!.y + hx * Math.sin(r) + hy * Math.cos(r)) * scale);
  const { ta, el } = await overlayVsElement(page);
  expect(ta.deg).toBeCloseTo(el.deg, 3);
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(ta[k] - el[k]), k).toBeLessThanOrEqual(1.5);
});
