import { expect, test, type Page } from '@playwright/test';
import { elements, frames, newProject, toScreen } from './fixtures';

/** n Texte nebeneinander auf Slide 1, alle gewählt. */
async function texts(page: Page, n: number) {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < n; i++) {
    await page.getByRole('button', { name: 'Text hinzufügen' }).click();
    const el = (await elements(page)).at(-1)!;
    await page.evaluate(([id, i]) => window.__bbzbTest.patch(id as string, { x: 100 + ((i as number) % 4) * 220, y: 150 + Math.floor((i as number) / 4) * 200, width: 200, height: 100 }), [el.id, i] as const);
    await page.keyboard.press('Escape');
  }
  const ids = (await elements(page)).map((e) => e.id);
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), ids);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(n);
  await frames(page);
}

// Zeiten nur als Bericht (Annotation «perf»), wie outline-perf. Hart geprüft: kein Store-Schreiben während des Ziehens.
for (const n of [1, 2, 8]) {
  test(`Ziehen von ${n} Element(en) mit 4× CPU-Drosselung: Bildabstand, kein Store-Schreiben pro Bewegung`, async ({ page }) => {
    await texts(page, n);
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const from = await toScreen(page, 150, 200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 5, from.y + 3);
    await page.evaluate(() => {
      const w = window as unknown as { perf: { gaps: number[]; writes: number; run: boolean; last: number; p: unknown } };
      w.perf = { gaps: [], writes: 0, run: true, last: performance.now(), p: window.__bbzbTest.project() };
      const tick = () => {
        const t = performance.now();
        w.perf.gaps.push(t - w.perf.last);
        w.perf.last = t;
        const p = window.__bbzbTest.project();
        if (p !== w.perf.p) w.perf.writes++;
        w.perf.p = p;
        if (w.perf.run) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (let i = 1; i <= 40; i++) await page.mouse.move(from.x + 5 + i * 6, from.y + 3 + i * 3);
    const r = await page.evaluate(() => {
      const w = window as unknown as { perf: { gaps: number[]; writes: number; run: boolean } };
      w.perf.run = false;
      const g = w.perf.gaps.slice(1);
      return { frames: g.length, meanMs: Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 10) / 10, maxMs: Math.round(Math.max(...g)), writes: w.perf.writes };
    });
    await page.mouse.up();
    test.info().annotations.push({ type: 'perf', description: JSON.stringify({ n, ...r }) });
    expect(r.writes, 'kein Store-Schreiben während des Ziehens').toBe(0);
    await expect.poll(async () => (await elements(page))[0]!.x).toBeGreaterThan(200);
  });
}
