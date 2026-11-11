import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { columnPng, effectRemove, elements, exportPng, frames, gradientPng, meanDiff, toScreen, toggleEffect } from './fixtures';
import { alphaPng, cutoutPng, openPhoto } from './photoProject';

// Rahmen 140/200 800 × 1000 auf Blau; Rand 24 ringsum (photoFrame.inset, gemessen in Beispiel_05): Bildbereich 164..916 × 224..1176
const M = 24;
const BOX = { x: 140, y: 200, width: 800, height: 1000 };
const AREA = { x0: BOX.x + M, x1: BOX.x + BOX.width - M, y0: BOX.y + M, y1: BOX.y + BOX.height - M };
const AW = BOX.width - 2 * M; // 752
const AH = BOX.height - 2 * M; // 952
const WARMWEISS = [251, 248, 243];
const ORANGE = [255, 78, 0];

type Props = Record<string, unknown>;
const open = (page: Page, name: string, props: Props, asset?: Buffer) => openPhoto(page, name, BOX, props, asset);

const px = (p: PNG, x: number, y: number) => [0, 1, 2].map((k) => p.data[(y * p.width + x) * 4 + k]!);
const near = (a: number[], b: number[], t = 3) => a.every((v, k) => Math.abs(v - b[k]!) <= t);
const sum = (a: number[]) => a[0]! + a[1]! + a[2]!;
/** Spalte des columnPng an diesem Exportpixel (B = 128 heisst: Bildpixel). */
const col = (p: PNG, x: number, y: number) => {
  const [r, g, b] = px(p, x, y);
  return b === 128 ? r! + (g! << 8) : -1;
};
/** Rahmen an = Zeile «Rahmen» unter «Effekte» (seit 4c Task 11 statt Schalter). */
const frameRow = (page: Page) => effectRemove(page, 'Rahmen');
const props = async (page: Page) => (await elements(page))[0]!.props as { frame?: boolean; frameOutside?: boolean; crop: { x: number; y: number; scale: number } };

test('Schalter «Rahmen» in beiden Modi, ein Undo-Schritt; Rahmen aussen ändert weder Box noch Ausschnitt', async ({ page }) => {
  const crop = { x: -100, y: -125, scale: 1 };
  await open(page, 'Schalter', { crop }, gradientPng(1000, 1250, ORANGE, ORANGE));
  const c = await toScreen(page, 540, 700);
  await page.mouse.click(c.x, c.y);
  await expect(frameRow(page)).toHaveCount(0);
  await toggleEffect(page, 'Rahmen');
  await expect(frameRow(page)).toHaveCount(1);
  // neu gesetzt: Rahmen aussen (Phase 2.5); der Bildbereich bleibt die Box, also auch der Ausschnitt
  expect(await props(page)).toMatchObject({ frame: true, frameOutside: true, crop });
  expect((await elements(page))[0]).toMatchObject(BOX);
  await page.keyboard.press('Control+z');
  await expect.poll(() => props(page)).toEqual({ crop, grain: false, look: false, assetId: expect.any(String) });
  await toggleEffect(page, 'Rahmen');
  await expect.poll(async () => (await props(page)).frameOutside).toBe(true);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).frame).toBeUndefined();
  expect((await props(page)).frameOutside).toBeUndefined();
});

test('Altprojekt mit Innenrahmen: aus löscht frame und frameOutside, an setzt den Rahmen aussen, der Ausschnitt bleibt deckend', async ({ page }) => {
  await open(page, 'Alt', { frame: true, crop: { x: 0, y: 0, scale: 0.96 } }, gradientPng(1000, 1000, ORANGE, ORANGE));
  const c = await toScreen(page, 540, 700);
  await page.mouse.click(c.x, c.y);
  await expect(frameRow(page)).toHaveCount(1);
  await toggleEffect(page, 'Rahmen');
  const off = await props(page);
  expect(off.frame).toBeUndefined();
  expect(off.frameOutside).toBeUndefined();
  // Bildbereich wächst auf die Box 800 × 1000: deckend
  expect(off.crop.y + 1000 * off.crop.scale).toBeGreaterThanOrEqual(BOX.height - 1e-6);
  await toggleEffect(page, 'Rahmen');
  expect(await props(page)).toMatchObject({ frame: true, frameOutside: true, crop: off.crop });
});

test('Rahmen aussen um ein Rechteckfoto: Export ragt 24 px über die Box, scharfe Ecken, Schatten darunter; gleich wie der alte Innenrahmen', async ({ page }) => {
  // Innenrahmen um BOX und Aussenrahmen um den Bildbereich derselben Fläche: dasselbe Bild (Altprojekt rendert unverändert)
  await open(page, 'Innen', { frame: true, crop: { x: -100, y: 0, scale: AH / 1000 } }, columnPng(1000, 1000));
  const [inner] = await exportPng(page);
  const AREA_BOX = { x: AREA.x0, y: AREA.y0, width: AW, height: AH };
  await openPhoto(page, 'Aussen', AREA_BOX, { frame: true, frameOutside: true, crop: { x: -100, y: 0, scale: AH / 1000 } }, columnPng(1000, 1000));
  expect((await elements(page))[0]).toMatchObject(AREA_BOX);
  const [outer] = await exportPng(page);
  let worst = 0;
  for (let i = 0; i < inner!.data.length; i++) worst = Math.max(worst, Math.abs(inner!.data[i]! - outer!.data[i]!));
  expect(worst, 'grösste Abweichung je Kanal').toBeLessThanOrEqual(1);
  // Rahmen aussen: 24 px um die Box warmweiss, bis in die Ecken; das Bild füllt die Box
  for (const [x, y] of [[AREA.x0 - 12, 700], [AREA.x1 + 12, 700], [540, AREA.y0 - 12], [540, AREA.y1 + 12], [AREA.x0 - 22, AREA.y0 - 22], [AREA.x1 + 21, AREA.y1 + 21]])
    expect(near(px(outer!, x!, y!), WARMWEISS), `Rahmen ${x}/${y}`).toBe(true);
  for (const [x, y] of [[AREA.x0, AREA.y0], [AREA.x1 - 1, AREA.y1 - 1]]) expect(col(outer!, x!, y!), `Bild ${x}/${y}`).toBeGreaterThanOrEqual(0);
  expect(near(px(outer!, AREA.x0 - 30, 700), WARMWEISS)).toBe(false);
  const free = sum(px(outer!, 540, 1340));
  expect(free - sum(px(outer!, 540, BOX.y + BOX.height + 8))).toBeGreaterThan(20);
  // Editor: Auswahlrahmen an der Box, der Rahmen ragt hinaus
  const c = await toScreen(page, 540, 700);
  await page.mouse.click(c.x, c.y);
  await expect(frameRow(page)).toHaveCount(1);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-23-phase-2-5-feinschliff/screens/task-10-editor-rechteck.png' });
});

test('Export: Rand warmweiss, Schatten ausserhalb, Foto füllt den Bildbereich; Klick auf den Rand wählt das Foto', async ({ page }) => {
  await open(page, 'Rahmen', { frame: true, crop: { x: 0, y: 0, scale: 0.96 } }, gradientPng(1000, 1000, ORANGE, ORANGE));
  // Auswahl passt zum Sichtbaren: der Rand gehört zum Foto
  const edge = await toScreen(page, BOX.x + 12, 700);
  expect(await page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [edge.x, edge.y])).toBe('e0');
  const [out] = await exportPng(page);
  for (const [x, y] of [[BOX.x + 3, 700], [AREA.x0 - 3, 700], [AREA.x1 + 3, 700], [540, BOX.y + 3], [540, AREA.y0 - 3], [540, AREA.y1 + 3], [540, BOX.y + BOX.height - 3]])
    expect(near(px(out!, x!, y!), WARMWEISS), `Rand ${x}/${y}`).toBe(true);
  for (const [x, y] of [[AREA.x0, AREA.y0], [AREA.x1 - 1, AREA.y0], [AREA.x0, AREA.y1 - 1], [AREA.x1 - 1, AREA.y1 - 1], [540, 700]])
    expect(near(px(out!, x!, y!), ORANGE, 2), `Bild ${x}/${y}`).toBe(true);
  // Schatten nach unten (Abstand 14): unter dem Rahmen dunkler als die freie blaue Fläche, darüber kaum
  const free = sum(px(out!, 540, 1340));
  expect(free - sum(px(out!, 540, BOX.y + BOX.height + 8))).toBeGreaterThan(20);
  expect(free - sum(px(out!, 540, BOX.y - 20))).toBeLessThan(free - sum(px(out!, 540, BOX.y + BOX.height + 8)));
  expect(near(px(out!, 1000, 30), px(out!, 1060, 30))).toBe(true); // weit weg: kein Schatten
});

test('Gedreht dreht der Rahmen mit (90°: Karte quer)', async ({ page }) => {
  await open(page, 'Gedreht', { frame: true, crop: { x: 0, y: 0, scale: 0.96 } }, gradientPng(1000, 1000, ORANGE, ORANGE));
  // 90° um die linke obere Ecke: die Karte liegt danach bei x 40..1040, y 275..1075
  await page.evaluate(() => window.__bbzbTest.patch('e0', { x: 1040, y: 275, rotation: 90 }));
  const [out] = await exportPng(page);
  for (const [x, y] of [[540, 275 + 10], [540, 1075 - 10], [40 + 10, 675], [1040 - 10, 675]]) expect(near(px(out!, x!, y!), WARMWEISS), `${x}/${y}`).toBe(true);
  expect(near(px(out!, 540, 675), ORANGE, 2)).toBe(true);
  expect(near(px(out!, 540, 250), WARMWEISS)).toBe(false); // ungedreht läge hier noch der Rahmen
});

test('Leerer Platzhalter mit Rahmen: Rahmen (warmweisse Karte) im Editor und im Export, ohne Platzhalter-Hinweis', async ({ page }) => {
  await open(page, 'Leer', { frame: true });
  const [out] = await exportPng(page);
  // wie bisher die weisse Fläche unter dem Platzhalter: die ganze Karte warmweiss, der gestrichelte Hinweis bleibt im Editor
  for (const [x, y] of [[BOX.x + 12, 700], [540, 700], [AREA.x0 + 2, AREA.y0 + 2]]) expect(near(px(out!, x!, y!), WARMWEISS), `${x}/${y}`).toBe(true);
  const c = await toScreen(page, BOX.x + 12, 700);
  await page.mouse.click(c.x, c.y);
  await expect(frameRow(page)).toHaveCount(1);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-22-phase-2-1-nachbesserungen/screens/task-2-placeholder.png' });
});

test('Mit Rahmen: Doppelklick-Ausschnitt und Spiegeln wirken im Bildbereich, ohne Lücke', async ({ page }) => {
  await open(page, 'Spiegel', { frame: true, crop: { x: -100, y: 0, scale: AH / 1000 } }, columnPng(1000, 1000));
  const c = await toScreen(page, 540, 700);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Waagrecht spiegeln' }).click();
  await expect(page.getByRole('button', { name: 'Waagrecht spiegeln' })).toHaveAttribute('aria-pressed', 'true');
  // Auswahlrahmen liegt auf dem Aussenrand des Rahmens
  await page.screenshot({ path: '.superpowers/sdd/2026-10-22-phase-2-1-nachbesserungen/screens/task-2-frame.png' });
  const [flipped] = await exportPng(page);
  const left = col(flipped!, AREA.x0, 700);
  const right = col(flipped!, AREA.x1 - 1, 700);
  expect(left).toBeGreaterThan(right); // gespiegelt
  expect(right).toBeGreaterThanOrEqual(0); // ohne Lücke bis an den Rand des Bildbereichs
  expect(near(px(flipped!, BOX.x + 12, 700), WARMWEISS)).toBe(true);

  await page.mouse.dblclick(c.x, c.y);
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toHaveAttribute('aria-pressed', 'true');
  await frames(page);
  const scale0 = (await props(page)).crop.scale;
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await props(page)).crop.scale).toBeGreaterThan(scale0);
  // ganz nach links ziehen: der Ausschnitt bleibt am Bildbereich begrenzt
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(c.x + i * 200, c.y);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const { crop } = await props(page);
  expect(crop.x).toBeLessThanOrEqual(0);
  expect(crop.x + 1000 * crop.scale).toBeGreaterThanOrEqual(AW - 1e-6);
  expect(crop.y + 1000 * crop.scale).toBeGreaterThanOrEqual(AH - 1e-6);
  const [moved] = await exportPng(page);
  for (const [x, y] of [[AREA.x0, AREA.y0], [AREA.x1 - 1, AREA.y1 - 1]]) expect(col(moved!, x!, y!)).toBeGreaterThanOrEqual(0);
  expect(col(moved!, AREA.x0, 700)).toBeGreaterThan(col(moved!, AREA.x1 - 1, 700)); // weiterhin gespiegelt
  expect(near(px(moved!, BOX.x + 12, 700), WARMWEISS)).toBe(true);
});

// Freisteller 1000 × 1000 in einer Box 800 × 800: Kreis Radius 320 mit Aussparung 120 um die Mitte (540/675)
const CUT = { x: 140, y: 275, width: 800, height: 800 };
const C = { x: 540, y: 675 };
const BLAU = [0, 159, 226];
const SCREENS = '.superpowers/sdd/2026-10-23-phase-2-5-feinschliff/screens';

test('Freisteller mit Rahmen: Kontur folgt der Form aussen und im Loch, Schatten folgt ihr; Golden', async ({ page }) => {
  await openPhoto(page, 'Freisteller', CUT, { frame: true, frameOutside: true, crop: { x: 0, y: 0, scale: 0.8 } }, cutoutPng(1000, 1000, ORANGE), [C.x + 220, C.y]);
  // gleich exportieren: der Export wartet auf die Kontur
  const [out] = await exportPng(page);
  const at = (dx: number, dy: number) => px(out!, C.x + dx, C.y + dy);
  for (const [dx, dy] of [[320 + 12, 0], [-320 - 12, 0], [0, -320 - 12], [0, 320 + 12], [240, 240], [120 - 12, 0], [0, -120 + 12]])
    expect(near(at(dx!, dy!), WARMWEISS), `Kontur ${dx}/${dy}`).toBe(true);
  expect(near(at(250, 0), ORANGE, 2)).toBe(true); // Inhalt bleibt sichtbar
  expect(near(at(0, 0), BLAU), 'Mitte des Lochs').toBe(true);
  expect(near(at(-320 - 40, 0), WARMWEISS)).toBe(false);
  // Boxecken (weit weg von der Form): kein Rahmen, kein Schatten
  for (const [x, y] of [[CUT.x + 5, CUT.y + 5], [CUT.x + CUT.width - 5, CUT.y + CUT.height - 5], [CUT.x - 20, CUT.y + CUT.height + 20]])
    expect(near(px(out!, x!, y!), BLAU), `Ecke ${x}/${y}`).toBe(true);
  // Schatten folgt der Kontur: unter dem Kreis dunkler als die freie Fläche
  const free = sum(px(out!, 60, C.y + 320 + 24 + 10));
  expect(free - sum(at(0, 320 + 24 + 10))).toBeGreaterThan(20);
  writeFileSync(`${SCREENS}/task-10-export-freisteller.png`, PNG.sync.write(out!));
  const golden = `${import.meta.dirname}/golden/rahmen-freisteller.png`;
  // Erzeugen: UPDATE_GOLDEN=1 npx playwright test photo-frame
  if (process.env.UPDATE_GOLDEN) writeFileSync(golden, PNG.sync.write(out!));
  meanDiff(out!, PNG.sync.read(readFileSync(golden))).forEach((d) => expect(d / 255).toBeLessThanOrEqual(0.02));
  // Editor: Auswahl bleibt an der Box, nicht an der Kontur
  const c = await toScreen(page, C.x + 250, C.y);
  await page.mouse.click(c.x, c.y);
  await expect(frameRow(page)).toHaveCount(1);
  const tr = await page.evaluate(() => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    const t = k.stages[0]!.findOne('Transformer') as import('konva').default.Transformer;
    return { width: t.width(), height: t.height(), scale: k.stages[0]!.scaleX() };
  });
  expect(tr.width / tr.scale).toBeCloseTo(CUT.width, 0);
  expect(tr.height / tr.scale).toBeCloseTo(CUT.height, 0);
  await page.screenshot({ path: `${SCREENS}/task-10-editor-freisteller.png` });
});

test('Gespiegelter Freisteller: Kontur spiegelt mit; ganz durchsichtig und 1 × 1 px: kein Absturz, kein Rahmen bzw. Rechteck', async ({ page }) => {
  // Halbkreis links im Bild: gespiegelt liegt er rechts, die Kontur auch
  const half = alphaPng(100, 100, ORANGE, (x, y) => (x < 50 && Math.hypot(x + 0.5 - 50, y + 0.5 - 50) <= 40 ? 255 : 0));
  await openPhoto(page, 'Halb', CUT, { frame: true, frameOutside: true, flipX: true, crop: { x: 0, y: 0, scale: 8 } }, half, [C.x + 100, C.y]);
  const [flipped] = await exportPng(page);
  expect(near(px(flipped!, C.x + 320 + 12, C.y), WARMWEISS)).toBe(true);
  expect(near(px(flipped!, C.x - 12 - 200, C.y), BLAU)).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, asset] of [['Leer', alphaPng(300, 300, ORANGE, () => 0)], ['Punkt', alphaPng(1, 1, ORANGE, () => 255)]] as const) {
    await openPhoto(page, name, CUT, { frame: true, frameOutside: true, crop: { x: 0, y: 0, scale: name === 'Leer' ? 8 / 3 : 800 } }, asset, [C.x, C.y]);
    const [out] = await exportPng(page);
    // ganz durchsichtig: nichts zu umranden; 1 × 1 deckend: Rechteckrahmen um die Box
    expect(near(px(out!, CUT.x - 12, C.y), name === 'Leer' ? BLAU : WARMWEISS), name).toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('Rahmen bleibt beim Ziehen eines Seiten-Anfassers gleich breit, auch mitten in der Geste', async ({ page }) => {
  await open(page, 'Live', { frame: true, frameOutside: true }, gradientPng(1000, 1250, ORANGE, ORANGE));
  const c = await toScreen(page, 540, 700);
  await page.mouse.click(c.x, c.y);
  const inset = () => page.evaluate(() => window.__bbzbTest.frameInset('e0'));
  const before = await inset();
  expect(before!.left).toBeCloseTo(M, 3);
  // rechter Seiten-Anfasser (Mitte der rechten Kante), nach rechts ziehen, nicht loslassen
  const h = await toScreen(page, BOX.x + BOX.width, BOX.y + BOX.height / 2);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(h.x + 20 * i, h.y);
  await frames(page);
  expect((await elements(page))[0]!.width).toBe(BOX.width); // noch nichts übernommen: die Geste läuft
  const during = await inset();
  expect(during!.left).toBeCloseTo(M, 3);
  expect(during!.top).toBeCloseTo(M, 3);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.width).toBeGreaterThan(BOX.width);
  await frames(page);
  expect(await inset()).toEqual(before);
});
