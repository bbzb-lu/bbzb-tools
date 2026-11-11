import { expect, test, type Page } from '@playwright/test';
import { alphaPng, openPhoto, type Box } from './photoProject';

// Freisteller 4096 × 3072 (Kreis mit Aussparung, Rand durchsichtig): die Kontur rechnet in Boxgrösse, höchstens 2048 px lang
const W = 4096, H = 3072;
const photo = alphaPng(W, H, [255, 78, 0], (x, y) => {
  const r = Math.hypot(x - W / 2, y - H / 2);
  return r <= 1400 && r > 500 ? 255 : 0;
});

/**
 * Box ändern und messen: Rechnung angestossen (Export wartet), Zeit bis fertig, längste Blockade des Hauptthreads. Die Markierung
 * steht nur vom Rendern bis zum nächsten Bild; unter Last läuft dazwischen kein setTimeout. Darum schaut zusätzlich eine
 * rAF-Kette nach: vor dem Ändern angemeldet, läuft sie in jedem Bild vor der Rechnung (die erst nach dem Rendern angemeldet wird).
 */
async function remeasure(page: Page, box: Partial<Box>) {
  return page.evaluate(async (box) => {
    let longest = 0;
    const obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => (longest = Math.max(longest, e.duration))));
    obs.observe({ type: 'longtask' });
    let pending = 0;
    let watching = true;
    const look = () => void (pending = Math.max(pending, window.__bbzbTest.pendingEffects()));
    const chain = () => {
      look();
      if (watching) requestAnimationFrame(chain);
    };
    requestAnimationFrame(chain);
    const t = performance.now();
    window.__bbzbTest.patch('e0', box);
    while (!pending && performance.now() - t < 1000) {
      await new Promise((r) => setTimeout(r, 0));
      look();
    }
    while (window.__bbzbTest.pendingEffects() > 0) await new Promise((r) => requestAnimationFrame(r));
    const total = Math.round(performance.now() - t);
    watching = false;
    await new Promise((r) => setTimeout(r, 50)); // Longtask-Einträge kommen gesammelt
    obs.disconnect();
    return { pending, total, longest: Math.round(longest) };
  }, box);
}

// Zeiten nur als Bericht (Annotation «perf»); als harte Grenze nur mit PERF=1, sonst schwanken sie mit der Maschine.
for (const [label, rate, budget] of [['ohne Drosselung', 1, 300], ['4× CPU-Drosselung', 4, 1500]] as const) {
  test(`Kontur eines 4096-px-Freistellers ${label}: einmal gerechnet, Export wartet (Budget ${budget} ms mit PERF)`, async ({ page }) => {
    const box = { x: 40, y: 300, width: 1000, height: 750 };
    await openPhoto(page, 'Gross', box, { frame: true, frameOutside: true, crop: { x: 0, y: 0, scale: 1000 / W } }, photo, [540 + 400, 675]);
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
    if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
    const results = [];
    // typische Box und die grösste Rechen-Canvas (2048 px lang)
    for (const b of [{ ...box, width: 1001 }, { ...box, x: -500, y: -100, width: 2048, height: 1536 }]) {
      const r = await remeasure(page, b);
      expect(r.pending, 'Export wartet auf die Kontur').toBe(1);
      results.push({ box: `${b.width}x${b.height}`, ...r });
      if (process.env.PERF) expect(r.total, JSON.stringify(r)).toBeLessThan(budget);
    }
    test.info().annotations.push({ type: 'perf', description: JSON.stringify(results) });
    // gleicher Schlüssel (nur verschoben): keine neue Rechnung, eine Sekunde lang keine Markierung
    const again = (await remeasure(page, { x: -499 })).pending;
    expect(again, 'nur verschoben: nichts zu rechnen').toBe(0);
  });
}
