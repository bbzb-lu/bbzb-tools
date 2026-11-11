import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { addEffect, addScrim, bbzbsocial, elements, exportPng, frames, gradientPng, openAllSections, toScreen, view } from './fixtures';

// Werte aus src/tokens.ts (scrim): leicht 0.45 × 0.25, stark 0.7, Reichweite Standard 56 %
const LEICHT = 0.45 * 0.25;
const STARK = 0.7;
const GREY = [128, 128, 128];
const BLAUSCHWARZ = [15, 27, 38];
const WARMWEISS = [251, 248, 243];
const grey = (w: number, h: number) => gradientPng(w, h, GREY, GREY);
/** Erwartete Farbe: Foto-Grau, darüber die Palettenfarbe mit Alpha a. */
const over = (c: number[], a: number) => GREY.map((g, k) => g * (1 - a) + c[k]! * a);

type Props = Record<string, unknown>;
type Box = { x: number; y: number; width: number; height: number; rotation?: number };
const FULL: Box = { x: 0, y: 0, width: 1080, height: 1350 };

/** `slides` Post-Slides (Warmweiss) mit einem grauen Foto in `box`; `extra` sind weitere Elemente darüber. */
function project(name: string, box: Box, props: Props, asset: Buffer, extra: Record<string, object>, slides: number) {
  const id = createHash('sha256').update(asset).digest('hex');
  const { width, height } = PNG.sync.read(asset);
  return bbzbsocial(
    {
      schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: Array.from({ length: slides }, (_, i) => ({ id: `s${i + 1}`, background: 'warmweiss' })),
      elements: {
        e0: {
          id: 'e0', type: 'photo', name: 'Foto', rotation: 0, ...box, opacity: 1, visible: true, locked: false,
          props: { assetId: id, crop: { x: 0, y: 0, scale: 1 }, grain: false, look: false, ...props },
        },
        ...extra,
      },
      order: ['e0', ...Object.keys(extra)],
      assets: { [id]: { mime: 'image/png', width, height, name: 'foto.png' } },
    },
    { [id]: asset },
  );
}
async function open(page: Page, name: string, box: Box, props: Props, asset = grey(box.width, box.height), extra: Record<string, object> = {}, slides = 1) {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: project(name, box, props, asset, extra, slides) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds().length)).toBe(slides + 1 + Object.keys(extra).length);
}

const px = (p: PNG, x: number, y: number) => [0, 1, 2].map((k) => p.data[(y * p.width + x) * 4 + k]!);
const near = (a: number[], b: number[], t = 2) => a.every((v, k) => Math.abs(v - b[k]!) <= t);
const scrimOf = async (page: Page) => ((await elements(page))[0]!.props as { scrims?: object[] }).scrims?.[0];

const scrimsProp = async (page: Page) => ((await elements(page))[0]!.props as { scrim?: unknown; scrims?: object[] });
const selectPhoto = async (page: Page) => {
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await openAllSections(page);
};
/** Effekt-Zeile eines Verlaufs (seit 4c Task 11 wie an der Slide). */
const row = (page: Page, name: string) => page.getByRole('region', { name: `Verlauf ${name}`, exact: true });
const remove = (page: Page, name: string) => page.getByRole('button', { name: `Verlauf ${name} entfernen`, exact: true });

test('Verlauf über «+»: Seite, Stärke und Hell sind je ein Undo-Schritt, Reichweite in jeder Zeile; Entfernen nimmt nur diese', async ({ page }) => {
  await open(page, 'Bedienung', FULL, {});
  await selectPhoto(page);
  await addEffect(page, 'Verlauf');
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'unten', strength: 'mittel' }); // erste freie Seite
  await row(page, 'Unten').getByRole('combobox', { name: 'Seite' }).selectOption({ label: 'Oben links' });
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'obenLinks', strength: 'mittel' });
  const r = row(page, 'Oben links');
  await expect(r).toBeVisible();
  await expect(r.getByRole('slider', { name: 'Reichweite' })).toHaveValue('56');

  await r.getByRole('radio', { name: 'Stark' }).check();
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'obenLinks', strength: 'stark' });
  await r.getByRole('radio', { name: 'Hell' }).check();
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'obenLinks', strength: 'stark', light: true });
  await expect(r.getByRole('radio', { name: 'Dunkel' })).not.toBeChecked();
  await page.keyboard.press('Control+z');
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'obenLinks', strength: 'stark' });
  await page.keyboard.press('Control+z');
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'obenLinks', strength: 'mittel' });
  await page.keyboard.press('Control+z'); // die Seite
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'unten', strength: 'mittel' });
  await page.keyboard.press('Control+z'); // das Anlegen
  await expect.poll(async () => (await scrimsProp(page)).scrims).toBeUndefined();
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  await expect.poll(() => scrimOf(page)).toEqual({ side: 'obenLinks', strength: 'mittel' });

  await addScrim(page, 'Unten');
  await expect.poll(async () => (await scrimsProp(page)).scrims).toEqual([{ side: 'obenLinks', strength: 'mittel' }, { side: 'unten', strength: 'mittel' }]);
  const slider = row(page, 'Unten').getByRole('slider', { name: 'Reichweite' });
  await expect(slider).toHaveValue('56');
  await expect(slider).toHaveAttribute('aria-valuetext', '56 %');
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.4, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.4 + i * 0.075), y);
  await page.mouse.up();
  await expect.poll(async () => (await scrimsProp(page)).scrims).toEqual([{ side: 'obenLinks', strength: 'mittel' }, { side: 'unten', strength: 'mittel', reach: 100 }]);
  await page.keyboard.press('Control+z'); // die ganze Regler-Geste auf einmal
  await expect.poll(async () => (await scrimsProp(page)).scrims).toEqual([{ side: 'obenLinks', strength: 'mittel' }, { side: 'unten', strength: 'mittel' }]);

  await remove(page, 'Oben links').click();
  await expect.poll(async () => (await scrimsProp(page)).scrims).toEqual([{ side: 'unten', strength: 'mittel' }]);
  await expect(row(page, 'Oben links')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Effekt hinzufügen', exact: true })).toBeFocused(); // Fokus bleibt im Abschnitt
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await scrimsProp(page)).scrims).toHaveLength(2);
});

test('Zwei Ecken im Export: oben links dunkler, unten rechts mit «Hell» heller; Entfernen der einen lässt die andere', async ({ page }) => {
  await open(page, 'Ecken', FULL, {});
  await selectPhoto(page);
  const [plain] = await exportPng(page);
  expect(near(px(plain!, 0, 0), GREY, 1)).toBe(true);
  await addScrim(page, 'Oben links');
  await addScrim(page, 'Unten rechts');
  await row(page, 'Unten rechts').getByRole('radio', { name: 'Hell' }).check();
  const [both] = await exportPng(page);
  expect(px(both!, 2, 2)[0], `oben links ${px(both!, 2, 2)}`).toBeLessThan(110);
  expect(px(both!, 1077, 1347)[0], `unten rechts ${px(both!, 1077, 1347)}`).toBeGreaterThan(150);
  await remove(page, 'Oben links').click();
  const [one] = await exportPng(page);
  expect(near(px(one!, 2, 2), GREY, 1), `oben links ${px(one!, 2, 2)}`).toBe(true);
  expect(px(one!, 1077, 1347)[0]).toBeGreaterThan(150);
});

test('Seite: belegte Seiten sind in jeder Zeile gesperrt, die eigene bleibt wählbar', async ({ page }) => {
  await open(page, 'Seiten', FULL, {});
  await selectPhoto(page);
  await addEffect(page, 'Verlauf');
  await addEffect(page, 'Verlauf');
  await expect.poll(async () => (await scrimsProp(page)).scrims).toEqual([{ side: 'unten', strength: 'mittel' }, { side: 'oben', strength: 'mittel' }]);
  const side = row(page, 'Unten').getByRole('combobox', { name: 'Seite' });
  await expect(side.locator('option', { hasText: /^Oben$/ })).toBeDisabled();
  await expect(side.locator('option', { hasText: /^Unten$/ })).toBeEnabled();
  await expect(side.locator('option', { hasText: /^Links$/ })).toBeEnabled();
});

test('Ein fünfter Verlauf wird verweigert: Eintrag im Menü gesperrt mit Hinweis, nichts geschrieben', async ({ page }) => {
  await open(page, 'Vier', FULL, {});
  await selectPhoto(page);
  for (let i = 0; i < 4; i++) await addEffect(page, 'Verlauf');
  await expect.poll(async () => (await scrimsProp(page)).scrims).toHaveLength(4);
  await page.getByRole('button', { name: 'Effekt hinzufügen', exact: true }).click();
  const item = page.getByRole('menuitem', { name: /^Verlauf/ });
  await expect(item).toHaveAttribute('aria-disabled', 'true');
  await expect(item).toContainText('Höchstens 4 Verläufe');
  await item.click({ force: true });
  expect((await scrimsProp(page)).scrims).toHaveLength(4);
  await page.getByRole('button', { name: 'Effekt hinzufügen', exact: true }).click(); // Menü zu
  await remove(page, 'Rechts').click();
  await expect.poll(async () => (await scrimsProp(page)).scrims).toHaveLength(3);
  await expect(page.getByRole('menuitem', { name: /^Verlauf/, includeHidden: true })).not.toHaveAttribute('aria-disabled', 'true');
});

test('Altes Einzelfeld «scrim» wird beim ersten Ändern zu «scrims»: nichts geht verloren, «scrim» ist weg (ein Undo-Schritt)', async ({ page }) => {
  await open(page, 'Alt', FULL, { scrim: { side: 'unten', strength: 'stark' } });
  await selectPhoto(page);
  await expect(row(page, 'Unten')).toBeVisible();
  await addScrim(page, 'Oben');
  await expect.poll(() => scrimsProp(page)).toEqual({ assetId: expect.any(String), crop: expect.anything(), grain: false, look: false, scrims: [{ side: 'unten', strength: 'stark' }, { side: 'oben', strength: 'mittel' }] });
  await page.keyboard.press('Control+z');
  await expect.poll(() => scrimsProp(page)).toMatchObject({ scrim: { side: 'unten', strength: 'stark' } });
  expect((await scrimsProp(page)).scrims).toBeUndefined();
});

test('Export: Kante um den Token-Wert dunkler, ab der Reichweite unverändert; Aufhellen heller; leicht oben', async ({ page }) => {
  await open(page, 'Pixel', FULL, { scrim: { side: 'unten', strength: 'stark' } });
  const [dark] = await exportPng(page);
  expect(near(px(dark!, 540, 1349), over(BLAUSCHWARZ, STARK)), `Kante ${px(dark!, 540, 1349)}`).toBe(true);
  // Ende der Reichweite 56 %: ab y = 1350 × 0.44 = 594 aufwärts unverändert
  for (const y of [0, 300, 590]) expect(near(px(dark!, 540, y), GREY, 1), `y ${y}`).toBe(true);
  // dazwischen dunkler als oben, heller als die Kante
  expect(px(dark!, 540, 1000)[0]).toBeLessThan(126);
  expect(px(dark!, 540, 1000)[0]).toBeGreaterThan(px(dark!, 540, 1349)[0]!);

  const el = (await elements(page))[0]! as { props: object };
  await page.evaluate((p) => window.__bbzbTest.patch('e0', { props: p }), { ...el.props, scrim: { side: 'unten', strength: 'stark', light: true } });
  const [light] = await exportPng(page);
  expect(near(px(light!, 540, 1349), over(WARMWEISS, STARK)), `hell ${px(light!, 540, 1349)}`).toBe(true);
  expect(near(px(light!, 540, 300), GREY, 1)).toBe(true);

  await page.evaluate((p) => window.__bbzbTest.patch('e0', { props: p }), { ...el.props, scrim: { side: 'oben', strength: 'leicht', reach: 30 } });
  const [top] = await exportPng(page);
  expect(near(px(top!, 540, 0), over(BLAUSCHWARZ, LEICHT)), `leicht ${px(top!, 540, 0)}`).toBe(true);
  for (const y of [410, 1349]) expect(near(px(top!, 540, y), GREY, 1), `y ${y}`).toBe(true);
});

test('Gespiegelt bleibt der Verlauf an der gewählten Seite; verschobener Ausschnitt ändert nichts', async ({ page }) => {
  // Bild doppelt so breit, Ausschnitt in die Mitte verschoben, gespiegelt, Verlauf links
  await open(page, 'Spiegel', FULL, { flipX: true, crop: { x: -540, y: 0, scale: 1 }, scrim: { side: 'links', strength: 'stark' } }, grey(2160, 1350));
  const [out] = await exportPng(page);
  expect(near(px(out!, 0, 675), over(BLAUSCHWARZ, STARK)), `links ${px(out!, 0, 675)}`).toBe(true);
  for (const x of [700, 1079]) expect(near(px(out!, x, 675), GREY, 1), `x ${x}`).toBe(true);
});

test('Gedreht dreht der Verlauf mit (90°: «unten» des Fotos liegt links)', async ({ page }) => {
  // 800 × 800, 90° um die linke obere Ecke: liegt danach bei x 140..940, y 275..1075, die Unterkante links
  await open(page, 'Gedreht', { x: 940, y: 275, width: 800, height: 800, rotation: 90 }, { scrim: { side: 'unten', strength: 'stark' } });
  const [out] = await exportPng(page);
  expect(near(px(out!, 141, 675), over(BLAUSCHWARZ, STARK), 4), `links ${px(out!, 141, 675)}`).toBe(true);
  for (const [x, y] of [[930, 675], [900, 285], [900, 1065]]) expect(near(px(out!, x!, y!), GREY, 1), `${x}/${y}`).toBe(true);
});

test('Mit Rahmen liegt der Verlauf im Bildbereich, der Rand bleibt warmweiss', async ({ page }) => {
  // Box 140/200 800 × 1000, Rand 24: Bildbereich y 224..1176
  await open(page, 'Rahmen', { x: 140, y: 200, width: 800, height: 1000 }, { frame: true, scrim: { side: 'unten', strength: 'stark' } }, grey(752, 952));
  const [out] = await exportPng(page);
  expect(near(px(out!, 540, 1175), over(BLAUSCHWARZ, STARK)), `Bildkante ${px(out!, 540, 1175)}`).toBe(true);
  expect(near(px(out!, 540, 1188), WARMWEISS, 3), `Rand ${px(out!, 540, 1188)}`).toBe(true);
  // Reichweite 56 % der Bildhöhe 952: oberhalb von 1176 − 533 unverändert
  expect(near(px(out!, 540, 630), GREY, 1)).toBe(true);
});

test('Titel über einem Foto mit starkem Verlauf bleibt im Export reines Warmweiss', async ({ page }) => {
  const title = {
    id: 't1', type: 'text', name: 'Titel', x: 72, y: 1000, width: 936, height: 300, rotation: 0, opacity: 1, visible: true, locked: false,
    props: { text: 'HELL', style: 'titel', color: 'warmweiss', fontSize: 280, align: 'left' },
  };
  await open(page, 'Titel', FULL, { scrim: { side: 'unten', strength: 'stark', reach: 100 } }, undefined, { t1: title });
  const [out] = await exportPng(page);
  let white = 0;
  for (let y = 1000; y < 1300; y++) for (let x = 72; x < 1008; x++) if (near(px(out!, x, y), WARMWEISS, 2)) white++;
  // abgedunkelt wäre der Titel höchstens 251 × 0.3 + 15 × 0.7 ≈ 86 hell; so liegen viele Pixel exakt auf Warmweiss
  expect(white).toBeGreaterThan(5000);
});

test('Panorama über zwei Slides, Verlauf rechts: Slide 1 unverändert, Slide 2 rechts dunkel, Titel hell; Klicks gehen durch', async ({ page }) => {
  const title = {
    id: 't1', type: 'text', name: 'Titel', x: 1180, y: 40, width: 880, height: 200, rotation: 0, opacity: 1, visible: true, locked: false,
    props: { text: 'HALLO', style: 'titel', color: 'warmweiss', fontSize: 160, align: 'left' },
  };
  await open(page, 'Panorama', { x: 0, y: 0, width: 2160, height: 1350 }, { scrim: { side: 'rechts', strength: 'stark' } }, undefined, { t1: title }, 2);
  const [left, right] = await exportPng(page);
  // Reichweite 56 % der ganzen Fotobreite 2160 ab der rechten Kante: links von x 950 (global) unverändert
  for (const x of [0, 250, 500, 900]) expect(near(px(left!, x, 675), GREY, 1), `Slide 1 x ${x}`).toBe(true);
  expect(near(px(right!, 1079, 675), over(BLAUSCHWARZ, STARK)), `Slide 2 rechts ${px(right!, 1079, 675)}`).toBe(true);
  expect(px(right!, 540, 675)[0]).toBeLessThan(120);
  let white = 0;
  for (let y = 40; y < 240; y++) for (let x = 100; x < 980; x++) if (near(px(right!, x, y), WARMWEISS, 0)) white++;
  expect(white).toBeGreaterThan(500);
  // Der Verlauf ist Teil des Fotos und fängt keine eigenen Klicks: Titel und Foto bleiben wählbar
  await page.getByRole('list', { name: 'Slides' }).getByRole('button').nth(1).click(); // Slide 2 ganz ins Bild (seit 4c ist die Leinwand höher)
  await frames(page);
  const t = await toScreen(page, 1300, 120);
  const f = await toScreen(page, 1900, 900);
  expect(await page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [t.x, t.y])).toBe('t1');
  expect(await page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [f.x, f.y])).toBe('e0');
});
