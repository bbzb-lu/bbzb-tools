import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { addPhoto, bbzbsocial, columnPng, effectRemove, elements, exportPng, frames, gradientPng, mean, meanDiff, newProject, openAllSections, openSectionsOf, png, toScreen, view } from './fixtures';

const look = (page: Page) => page.getByRole('button', { name: 'BBZB-Look', exact: true });
const warmth = (p: PNG) => {
  const [r, , b] = mean(p);
  return r! - b!;
};
/** Bild-Knoten, die eine Effekt-Canvas statt des Rohbilds zeigen. */
const fxCanvases = (page: Page) =>
  page.evaluate(() => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    return k.stages[0]!.find('Image').filter((n) => (n as import('konva').default.Image).image() instanceof HTMLCanvasElement).length;
  });

type Photo = { y: number; height: number; asset: Buffer; props: object };
/** Ein Slide 1080 × 1350 mit den angegebenen Fotos über die ganze Breite. */
function project(name: string, photos: Photo[], frameWidth = 1080) {
  const elements: Record<string, object> = {};
  const assets: Record<string, Buffer> = {};
  const meta: Record<string, object> = {};
  photos.forEach((p, i) => {
    const id = createHash('sha256').update(p.asset).digest('hex');
    const { width, height } = PNG.sync.read(p.asset);
    assets[id] = p.asset;
    meta[id] = { mime: 'image/png', width, height, name: 'foto.png' };
    elements[`e${i}`] = {
      id: `e${i}`, type: 'photo', name: `Foto ${i + 1}`, x: 0, y: p.y, width: frameWidth, height: p.height,
      rotation: 0, opacity: 1, visible: true, locked: false, props: { assetId: id, ...p.props },
    };
  });
  return bbzbsocial(
    {
      schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [{ id: 's1', background: 'warmweiss' }],
      elements,
      order: Object.keys(elements),
      assets: meta,
    },
    assets,
  );
}
async function open(page: Page, name: string, photos: Photo[]) {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: project(name, photos) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page); // wartet auf die Stage
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds().length)).toBe(1 + photos.length);
  await openSectionsOf(page, 'e0'); // Inspector-Abschnitte offen (seit 4c einklappbar)
}

test('Neues Foto hat BBZB-Look: Export wärmer als ohne; Bildregler stehen auf 0', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1080, 1350));
  await expect.poll(async () => (await elements(page))[0]?.props).toMatchObject({ look: true, grain: false });
  await openAllSections(page);
  await expect(look(page)).toHaveAttribute('aria-pressed', 'true');
  // Deckkraft, die vier Bildregler und «Weiche Kante» im Abschnitt «Maske»
  await expect(page.getByRole('slider')).toHaveCount(6);
  await expect(page.getByRole('slider', { name: 'Weiche Kante' })).toHaveCount(1);
  await expect(effectRemove(page, 'Korn')).toHaveCount(0);
  const [on] = await exportPng(page);
  await look(page).click();
  await expect(look(page)).toHaveAttribute('aria-pressed', 'false');
  const [off] = await exportPng(page);
  console.log(`BBZB-Look: Rot − Blau im Mittel ${warmth(off!).toFixed(1)} ohne, ${warmth(on!).toFixed(1)} mit Look`);
  expect(warmth(on!) - warmth(off!)).toBeGreaterThan(5);
  // Luminanz erhalten: Helligkeit bleibt im Mittel
  const lum = (p: PNG) => mean(p).reduce((s, v, k) => s + v * [0.299, 0.587, 0.114][k]!, 0);
  expect(Math.abs(lum(on!) - lum(off!))).toBeLessThan(2);
  await page.keyboard.press('Control+z');
  await expect(look(page)).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Helligkeit', 'Kontrast', 'Sättigung', 'Wärme']) await expect(page.getByRole('slider', { name })).toHaveValue('0');
});

test('Bildregler: eine Bewegung = ein Undo-Schritt, Wärme wirkt im Export', async ({ page }) => {
  await open(page, 'Regler', [{ y: 0, height: 1350, asset: gradientPng(1080, 1350), props: { crop: { x: 0, y: 0, scale: 1 }, look: false } }]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  const [before] = await exportPng(page);
  const slider = page.getByRole('slider', { name: 'Wärme' });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.5 + i * 0.06), y);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.props).toMatchObject({ adjust: { warmth: 50, brightness: 0 } });
  await expect(slider).toHaveAttribute('aria-valuetext', '+50');
  const [warm] = await exportPng(page);
  expect(warmth(warm!) - warmth(before!)).toBeGreaterThan(20);
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.props).not.toHaveProperty('adjust');
});

/** Je Bild: Breite der sichtbaren Effekt-Canvas (0 = keine) und ob das Rohbild sichtbar ist. */
const sampleFrames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { Konva: typeof import('konva').default; frames_: [number, boolean][]; stop_: boolean };
    w.frames_ = [];
    w.stop_ = false;
    const tick = () => {
      const imgs = (w.Konva.stages[0]!.findOne('#e0') as import('konva').default.Group).find('Image') as import('konva').default.Image[];
      const fx = imgs.find((n) => n.isVisible() && n.image() instanceof HTMLCanvasElement);
      const raw = imgs.some((n) => n.isVisible() && !(n.image() instanceof HTMLCanvasElement));
      w.frames_.push([fx ? (fx.image() as HTMLCanvasElement).width : 0, raw]);
      if (!w.stop_) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const stopFrames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { frames_: [number, boolean][]; stop_: boolean };
    w.stop_ = true;
    return w.frames_;
  });

test('Regler ziehen: Vorschau in kleiner Auflösung ohne Aufblitzen des Rohbilds, danach volle Auflösung', async ({ page }) => {
  await open(page, 'Vorschau', [{ y: 0, height: 1350, asset: gradientPng(1080, 1350), props: { crop: { x: 0, y: 0, scale: 1 }, look: true, grain: true } }]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const slider = page.getByRole('slider', { name: 'Kontrast' });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await sampleFrames(page);
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * (0.5 + i * 0.02), y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const during = await stopFrames(page);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  await sampleFrames(page);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const after = await stopFrames(page);
  // Rohbild nie sichtbar; bis zur ersten Vorschau bleibt die alte Canvas (1080), danach nur noch Vorschau (432 × 540)
  expect(during.filter(([, raw]) => raw)).toEqual([]);
  const first = during.findIndex(([w]) => w === 432);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(new Set(during.slice(first).map(([w]) => w))).toEqual(new Set([432]));
  expect(after.at(-1)).toEqual([1080, false]);
  await expect.poll(async () => ((await elements(page))[0]!.props as { adjust?: { contrast: number } }).adjust?.contrast).toBeGreaterThan(10);
});

const fxWidth = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { Konva: typeof import('konva').default };
    const imgs = (w.Konva.stages[0]!.findOne('#e0') as import('konva').default.Group).find('Image') as import('konva').default.Image[];
    const fx = imgs.find((n) => n.isVisible() && n.image() instanceof HTMLCanvasElement);
    return fx ? (fx.image() as HTMLCanvasElement).width : 0;
  });

test('Regler kurz antippen (Klick, Taste): volle Auflösung kommt, Export läuft durch', async ({ page }) => {
  await open(page, 'Antippen', [{ y: 0, height: 1350, asset: gradientPng(1080, 1350), props: { crop: { x: 0, y: 0, scale: 1 }, look: true, grain: true } }]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  const slider = page.getByRole('slider', { name: 'Helligkeit' });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  // Klick auf die Spur: loslassen, bevor die Vorschau fertig ist
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  await expect.poll(async () => ((await elements(page))[0]!.props as { adjust?: { brightness: number } }).adjust?.brightness).toBeGreaterThan(10);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  await expect.poll(() => fxWidth(page)).toBe(1080);
  // Taste antippen
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  await expect.poll(() => fxWidth(page)).toBe(1080);
  const [got] = await exportPng(page);
  expect([got!.width, got!.height]).toEqual([1080, 1350]);
});

/** Export mitten in einer Tastatur-Geste: nimmt nicht die Vorschau, sondern rechnet voll. */
test('Export während einer Regler-Geste nutzt die volle Auflösung', async ({ page }) => {
  await open(page, 'Mitten', [{ y: 0, height: 1350, asset: gradientPng(1080, 1350), props: { crop: { x: 0, y: 0, scale: 1 }, look: true, grain: true } }]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  const slider = page.getByRole('slider', { name: 'Wärme' });
  await slider.focus();
  await page.keyboard.down('ArrowRight'); // Taste bleibt gedrückt: Geste offen
  await expect.poll(() => fxWidth(page)).toBe(432);
  const [got] = await exportPng(page);
  await page.keyboard.up('ArrowRight');
  const [ref] = await exportPng(page);
  expect(Math.max(...meanDiff(got!, ref!))).toBeLessThan(0.5);
});

test('Look aus und Regler neutral: kein Filter läuft, Export = Rohbild', async ({ page }) => {
  const raw = gradientPng(1080, 675);
  const neutral = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
  await open(page, 'Neutral', [
    { y: 0, height: 675, asset: raw, props: { crop: { x: 0, y: 0, scale: 1 }, look: false, grain: false, adjust: neutral } },
    { y: 675, height: 675, asset: raw, props: { crop: { x: 0, y: 0, scale: 1 } } }, // altes Projekt: nichts gesetzt
  ]);
  expect(await fxCanvases(page)).toBe(0);
  const [got] = await exportPng(page);
  expect(Math.max(...meanDiff(got!, PNG.sync.read(gradientPng(1080, 1350))))).toBeLessThan(0.5);
});

/** Spalte im Export: columnPng trägt die Bildspalte in R (low) und G (high). */
const col = (p: PNG, x: number) => p.data[(675 * 1080 + x) * 4]! + 256 * p.data[(675 * 1080 + x) * 4 + 1]!;

test('Spiegeln: Export spiegelt den Inhalt; Ausschnitt ziehen und zoomen folgen der Maus', async ({ page }) => {
  test.fixme(process.platform === 'win32', 'Windows: 2 statt 1 Spalte Abweichung, github.com/bbzb-lu/bbzb-tools/issues/9');
  // 2160 breit, mittig: Spalte 540 links im Rahmen
  await open(page, 'Spiegel', [{ y: 0, height: 1350, asset: columnPng(2160, 1350), props: { crop: { x: -540, y: 0, scale: 1 } } }]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Waagrecht spiegeln' }).click();
  await expect(page.getByRole('button', { name: 'Waagrecht spiegeln' })).toHaveAttribute('aria-pressed', 'true');
  const [flipped] = await exportPng(page);
  for (const x of [0, 300, 1079]) expect(col(flipped!, x)).toBe(540 + 1079 - x);

  // Ausschnittmodus: um 100 Slide-Pixel nach rechts ziehen, das Bild folgt sichtbar nach rechts
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toHaveAttribute('aria-pressed', 'true');
  // bis Konva neu zeichnet, trifft die Maus noch das alte, nicht ziehbare Bild (unter Last scheiterte das Ziehen)
  await frames(page);
  const to = await toScreen(page, 640, 675);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(c.x + ((to.x - c.x) * i) / 5, c.y);
  await page.mouse.up();
  await expect.poll(async () => ((await elements(page))[0]!.props as { crop: { x: number } }).crop.x).not.toBe(-540);
  // Rad zoomt um den Punkt unter der Maus: die Spalte dort bleibt
  const at = await toScreen(page, 300, 675);
  await page.mouse.move(at.x, at.y);
  const scale0 = ((await elements(page))[0]!.props as { crop: { scale: number } }).crop.scale;
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => ((await elements(page))[0]!.props as { crop: { scale: number } }).crop.scale).toBeGreaterThan(scale0);
  await page.keyboard.press('Escape');
  const [moved] = await exportPng(page);
  expect(Math.abs(col(moved!, 300) - col(flipped!, 200))).toBeLessThanOrEqual(1);
  // weiterhin gespiegelt; 10 Pixel Abstand, denn bei Zoom 1.1 zeigen einzelne Nachbarpixel auf dieselbe Quellspalte
  expect(col(moved!, 310)).toBeLessThan(col(moved!, 300));
  expect(await elements(page)).toMatchObject([{ x: 0, y: 0, props: { flipX: true } }]); // Rahmen blieb stehen
});

/** Bildzeile y in R (low) und G (high), wie columnPng quer. */
function rowPng(width: number, height: number): Buffer {
  const p = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) p.data.set([y & 255, y >> 8, 128, 255], (y * width + x) * 4);
  return PNG.sync.write(p);
}
const row = (p: PNG, y: number) => p.data[(y * 1080 + 540) * 4]! + 256 * p.data[(y * 1080 + 540) * 4 + 1]!;

test('Senkrecht spiegeln: Export spiegelt den Inhalt von oben nach unten, auch zusammen mit waagrecht', async ({ page }) => {
  // 2700 hoch, mittig: Zeile 675 oben im Rahmen
  await open(page, 'Kopf', [{ y: 0, height: 1350, asset: rowPng(1080, 2700), props: { crop: { x: 0, y: -675, scale: 1 }, flipY: true } }]);
  const [flipped] = await exportPng(page);
  for (const y of [0, 400, 1349]) expect(row(flipped!, y)).toBe(675 + 1349 - y);
  await page.evaluate(() => window.__bbzbTest.patch('e0', { props: { ...(window.__bbzbTest.elements()[0]!.props as object), flipX: true } }));
  const [both] = await exportPng(page);
  for (const y of [0, 400, 1349]) expect(row(both!, y)).toBe(675 + 1349 - y);
});

/** Farbverlauf und Grauverlauf, je mit Look und mit Look + Reglern (ohne Korn: verlustfrei klein). */
const goldenPhotos = (): Photo[] => {
  const colour = gradientPng(1080, 338);
  const grey = gradientPng(1080, 337, [255, 255, 255], [0, 0, 0]);
  const sliders = { brightness: 10, contrast: 20, saturation: -20, warmth: 30 };
  const base = { crop: { x: 0, y: 0, scale: 1 }, look: true, grain: false };
  return [
    { y: 0, height: 338, asset: colour, props: base },
    { y: 338, height: 337, asset: grey, props: base },
    { y: 675, height: 338, asset: colour, props: { ...base, adjust: sliders } },
    { y: 1013, height: 337, asset: grey, props: { ...base, adjust: sliders } },
  ];
};
const ROWS = [169, 506, 844, 1181]; // je Foto eine Zeile: die Verläufe sind senkrecht gleich
const GOLDEN = `${import.meta.dirname}/golden/look.png`;

test('Golden Image: BBZB-Look und Regler, mittlere Abweichung je Kanal höchstens 2 %', async ({ page }) => {
  await open(page, 'Look', goldenPhotos());
  const [full] = await exportPng(page);
  const got = new PNG({ width: 1080, height: ROWS.length });
  ROWS.forEach((y, i) => full!.data.copy(got.data, i * 1080 * 4, y * 1080 * 4, (y + 1) * 1080 * 4));
  // Erzeugen (Ruling R4): UPDATE_GOLDEN=1 npx playwright test look
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, PNG.sync.write(got));
  const want = PNG.sync.read(readFileSync(GOLDEN));
  meanDiff(got, want).forEach((d) => expect(d / 255).toBeLessThanOrEqual(0.02));
  // Grau wird warm: Rot über Blau in der Look-Zeile des Grauverlaufs
  const [r, , b] = mean(got, 1, 2);
  expect(r! - b!).toBeGreaterThan(5);
});
