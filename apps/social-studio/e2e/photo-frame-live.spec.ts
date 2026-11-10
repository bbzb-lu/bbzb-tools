import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, frames, newProject, png, toScreen } from './fixtures';
import { cutoutPng, openPhoto } from './photoProject';

const M = 24; // photoFrame.inset
const DARK = [15, 27, 38];
const inset = (page: Page, id = 'e0') => page.evaluate((i) => window.__bbzbTest.frameInset(i), id);

/** Mitte der rechten Kante, nach rechts ziehen, nicht loslassen. */
async function dragSide(page: Page, box: { x: number; y: number; width: number; height: number }, dx: number) {
  const h = await toScreen(page, box.x + box.width, box.y + box.height / 2);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(h.x + (dx * i) / 5, h.y);
  await frames(page);
}

/** Alle vier Randbreiten (Slide-px) liegen bei M. */
const expectEven = (r: { left: number; top: number; right: number; bottom: number } | null, tol: number, what: string) => {
  for (const k of ['left', 'top', 'right', 'bottom'] as const) expect(Math.abs(r![k] - M), `${what}: ${k} = ${r![k]}`).toBeLessThan(tol);
};

test('Kontur um einen Freisteller behält beim Seiten-Anfasser ihre Breite auf beiden Achsen, auch mitten in der Geste', async ({ page }) => {
  const box = { x: 200, y: 300, width: 500, height: 500 };
  await openPhoto(page, 'Kontur', box, { frame: true, frameOutside: true, crop: { x: 0, y: 0, scale: 0.5 } }, cutoutPng(1000, 1000, DARK), [450, 550]);
  const c = await toScreen(page, 450, 550);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const start = await inset(page);
  expectEven(start, 3, 'vorher');
  await dragSide(page, box, 200);
  expect((await elements(page))[0]!.width).toBe(box.width); // Geste läuft
  // Die Live-Kontur rechnet auf höchstens 320 px Länge (PREVIEW in liveRing.ts), gemessen wird die Polsterung ihrer Canvas:
  // die liegt bis zu ein Vorschau-Pixel daneben. Toleranz also ein Vorschau-Pixel in Slide-px, mindestens 3.
  const s = await page.evaluate(() => window.__bbzbTest.nodeScale('e0'));
  const live = Math.max(3, Math.max(box.width * s.x, box.height * s.y) / 320);
  expectEven(await inset(page), live, 'mitten in der Geste');
  await page.mouse.up();
  // sofort nach dem Loslassen, bevor die neue Kontur gerechnet ist: die Live-Kontur bleibt in echter Breite stehen (kein Rücksprung)
  const right = await page.evaluate(() => ({ inset: window.__bbzbTest.frameInset('e0'), w: window.__bbzbTest.elements()[0]!.width }));
  expect(right.w, 'Box übernommen').toBeGreaterThan(box.width);
  expectEven(right.inset, live, 'direkt nach dem Loslassen');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  await frames(page);
  expectEven(await inset(page), 3, 'nach dem Loslassen');
});

test('Alter Innenrahmen: Rand um das Bild behält beim Seiten-Anfasser seine Breite', async ({ page }) => {
  const box = { x: 140, y: 200, width: 800, height: 1000 };
  await openPhoto(page, 'Alt', box, { frame: true, crop: { x: 0, y: 0, scale: 0.7 } }, png(1000, 1250).buffer, [540, 700]);
  const c = await toScreen(page, 540, 700);
  await page.mouse.click(c.x, c.y);
  const before = await inset(page);
  expectEven(before, 0.5, 'vorher');
  await dragSide(page, box, 100);
  expect((await elements(page))[0]!.width).toBe(box.width);
  const during = await inset(page);
  expectEven(during, 0.5, 'mitten in der Geste');
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.width).toBeGreaterThan(box.width);
  await frames(page);
  expectEven(await inset(page), 0.5, 'nachher');
});

test('Mehrfachauswahl: Ecke mit Shift ziehen, die Rahmen beider Fotos behalten ihre Breite', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(2);
  const [a, b] = await elements(page);
  await page.evaluate(([x, y]) => {
    const t = window.__bbzbTest;
    const frame = (id: string, box: object) => t.patch(id, { ...box, props: { ...(t.elements().find((e) => e.id === id)!.props as object), frame: true, frameOutside: true } });
    frame(x!, { x: 100, y: 200, width: 400, height: 300 });
    frame(y!, { x: 600, y: 300, width: 300, height: 300 });
    t.selectIds([x!, y!]);
  }, [a!.id, b!.id]);
  await frames(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  const ia = await inset(page, a!.id);
  expect(ia!.left).toBeCloseTo(M, 1);
  // untere rechte Ecke der gemeinsamen Box (100..900 × 200..600), mit Shift frei ziehen
  const h = await page.evaluate(() => window.__bbzbTest.anchorScreen('bottom-right'));
  await page.mouse.move(h.x, h.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(h.x + 20 * i, h.y);
  await frames(page);
  const els = await elements(page);
  expect(els[0]!.width).toBe(400); // Geste läuft: noch nichts übernommen, aber die Knoten sind skaliert
  expect((await page.evaluate((i) => window.__bbzbTest.nodeScale(i), a!.id)).x).toBeGreaterThan(1.05);
  for (const id of [a!.id, b!.id]) {
    const during = await inset(page, id);
    expect(during!.left, id).toBeCloseTo(M, 1);
    expect(during!.top, id).toBeCloseTo(M, 1);
  }
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await elements(page))[0]!.width).toBeGreaterThan(400);
  await frames(page);
  expect((await inset(page, a!.id))!.left).toBeCloseTo(M, 1);
});

// Zeiten nur als Bericht (Annotation «perf»), hart nur mit PERF=1
for (const rate of [1, 4]) {
  test(`Kontur-Vorschau beim Ziehen, 4096-px-Freisteller, ${rate}× CPU-Drosselung: längste Blockade`, async ({ page }) => {
    const box = { x: 40, y: 300, width: 1000, height: 750 };
    await openPhoto(page, 'Gross', box, { frame: true, frameOutside: true, crop: { x: 0, y: 0, scale: 1000 / 4096 } }, cutoutPng(4096, 3072, DARK), [540, 675]);
    const c = await toScreen(page, 540, 675);
    await page.mouse.click(c.x, c.y);
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
    if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
    await page.evaluate(() => {
      const w = window as unknown as { __long: number };
      w.__long = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__long = Math.max(w.__long, e.duration)))).observe({ type: 'longtask' });
    });
    const h = await toScreen(page, box.x + box.width, box.y + box.height / 2);
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    const t = Date.now();
    for (let i = 1; i <= 30; i++) await page.mouse.move(h.x + 6 * i, h.y);
    const ms = Date.now() - t;
    await frames(page);
    const longest = Math.round(await page.evaluate(() => (window as unknown as { __long: number }).__long));
    await page.mouse.up();
    test.info().annotations.push({ type: 'perf', description: JSON.stringify({ rate, moves: 30, totalMs: ms, longestBlockMs: longest }) });
    if (process.env.PERF) expect(longest).toBeLessThan(rate * 150);
  });
}
