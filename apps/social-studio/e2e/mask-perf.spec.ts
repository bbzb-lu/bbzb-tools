import { expect, test, type Page } from '@playwright/test';
import { frames, toScreen } from './fixtures';
import { alphaPng, maskPng, openPhoto } from './photoProject';

// Grösstes Foto (4096 × 3072) mit Maske in voller Maskenauflösung (2048 × 1536, linke Hälfte aus), Look und Korn an
const W = 4096, H = 3072;
const photo = alphaPng(W, H, [15, 27, 38], () => 255);
const mask = maskPng(2048, 1536, (x) => (x < 1024 ? 0 : 255));
const BOX = { x: 40, y: 300, width: 1000, height: 750 };

/** Bildabstände (rAF) und längste Blockade, während `act` läuft. */
async function watch(page: Page, act: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { gaps: number[]; longest: number; stop: () => void } };
    const gaps: number[] = [];
    let last = performance.now();
    let on = true;
    const obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__perf.longest = Math.max(w.__perf.longest, e.duration))));
    obs.observe({ type: 'longtask' });
    const tick = (t: number) => {
      gaps.push(t - last);
      last = t;
      if (on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    w.__perf = { gaps, longest: 0, stop: () => ((on = false), obs.disconnect()) };
  });
  await act();
  return page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 50)); // Longtask-Einträge kommen gesammelt
    const w = window as unknown as { __perf: { gaps: number[]; longest: number; stop: () => void } };
    w.__perf.stop();
    const g = w.__perf.gaps.slice(1).sort((a, b) => a - b);
    return { frames: g.length, p95: Math.round(g[Math.floor(g.length * 0.95)] ?? 0), max: Math.round(g.at(-1) ?? 0), longest: Math.round(w.__perf.longest) };
  });
}

for (const withMask of [false, true]) {
  test(`Skalieren mit 4× CPU-Drosselung ${withMask ? 'mit' : 'ohne'} Maske: Bildabstände als Bericht`, async ({ page }) => {
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await openPhoto(page, 'Perf', BOX, { crop: { x: 0, y: 0, scale: 1000 / W }, look: true, grain: true }, photo, [800, 675], withMask ? mask : undefined);
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects()), { timeout: 30000 }).toBe(0);
    // längste Blockade seit dem Laden der Seite (Foto dekodieren, Maske lesen und anwenden, Effekte)
    const openLongest = await page.evaluate(
      () => new Promise<number>((r) => new PerformanceObserver((l, o) => (o.disconnect(), r(Math.round(Math.max(0, ...l.getEntries().map((e) => e.duration))))))
        .observe({ type: 'longtask', buffered: true })),
    );
    const c = await toScreen(page, 800, 675);
    await page.mouse.click(c.x, c.y);
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
    const h = await toScreen(page, BOX.x + BOX.width, BOX.y + BOX.height / 2);
    const k = (await toScreen(page, 1, 0)).x - (await toScreen(page, 0, 0)).x;
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    const scale = await watch(page, async () => {
      for (let i = 1; i <= 30; i++) await page.mouse.move(h.x - 300 * k * (i / 30), h.y);
      await frames(page);
    });
    // Loslassen: Effekte und Kontur in voller Auflösung neu (mit Maske: Deckkraft zurücksetzen); längste Blockade dabei
    const settle = await watch(page, async () => {
      await page.mouse.up();
      await frames(page);
      await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects()), { timeout: 30000 }).toBe(0);
      await frames(page);
    });
    expect(await page.evaluate(() => window.__bbzbTest.elements()[0]!.width)).toBeLessThan(BOX.width - 100);
    const drag = await watch(page, async () => {
      const m = await toScreen(page, 600, 675);
      await page.mouse.move(m.x, m.y);
      await page.mouse.down();
      for (let i = 1; i <= 30; i++) await page.mouse.move(m.x + 200 * k * (i / 30), m.y + 100 * k * (i / 30));
      await page.mouse.up();
      await frames(page);
    });
    test.info().annotations.push({ type: 'perf', description: JSON.stringify({ mask: withMask, openLongest, scale, settle, drag }) });
    expect(scale.frames).toBeGreaterThan(0);
  });
}

for (const view of ['Rote Folie', 'Ergebnis']) {
test(`Malen mit 4× CPU-Drosselung (grösstes Foto, Maske 2048 × 1536, Ansicht ${view}): Bildabstände als Bericht`, async ({ page }) => {
  await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await openPhoto(page, 'Malen', BOX, { crop: { x: 0, y: 0, scale: 1000 / W }, look: true, grain: true }, photo, [800, 675], mask);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects()), { timeout: 30000 }).toBe(0);
  const c = await toScreen(page, 800, 675);
  await page.mouse.click(c.x, c.y);
  const open = await watch(page, async () => {
    await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils()), { timeout: 30000 }).toBe(1);
    await frames(page);
  });
  if (view === 'Ergebnis') {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: view }).click();
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(0);
  }
  const k = (await toScreen(page, 1, 0)).x - (await toScreen(page, 0, 0)).x;
  const s = await toScreen(page, 200, 500);
  await page.mouse.move(s.x, s.y);
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  await page.mouse.down();
  // 60 Bewegungen, Zickzack über das Foto, Pinsel 80 px (Standard)
  const paint = await watch(page, async () => {
    for (let i = 1; i <= 60; i++) await page.mouse.move(s.x + 700 * k * (i / 60), s.y + 300 * k * Math.abs(Math.sin(i / 6)));
    await frames(page);
  });
  const end = await watch(page, async () => {
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.history()), { timeout: 30000 }).toBe(h0 + 1);
    await frames(page);
  });
  const leave = await watch(page, async () => {
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects()), { timeout: 30000 }).toBe(0);
    await frames(page);
  });
  test.info().annotations.push({ type: 'perf', description: JSON.stringify({ view, open, paint, end, leave }) });
  expect(paint.frames).toBeGreaterThan(0);
});
}
