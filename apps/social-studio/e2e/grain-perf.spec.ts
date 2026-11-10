import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { bbzbsocial, dropPng, frames, gradientPng, newProject, toScreen, view } from './fixtures';

/** 10 Slides, je ein Foto (2160 × 2700) mit oder ohne Korn (und BBZB-Look, Rahmen). */
function tenSlides(name: string, grain: boolean, look = false, frame = false) {
  const photo = gradientPng(2160, 2700);
  const id = createHash('sha256').update(photo).digest('hex');
  const elements: Record<string, object> = {};
  for (let i = 0; i < 10; i++) {
    elements[`e${i}`] = {
      id: `e${i}`, type: 'photo', name: `Foto ${i + 1}`, x: i * 1080 + 140, y: 200, width: 800, height: 1000,
      rotation: 0, opacity: 1, visible: true, locked: false,
      props: { assetId: id, crop: { x: 0, y: 0, scale: 1000 / 2700 }, grain, look, frame },
    };
  }
  return bbzbsocial(
    {
      schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, background: 'warmweiss' })),
      elements,
      order: Object.keys(elements),
      assets: { [id]: { mime: 'image/png', width: 2160, height: 2700, name: 'verlauf.png' } },
    },
    { [id]: photo },
  );
}

async function open(page: Page, name: string, grain: boolean, look = false, frame = false) {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: tenSlides(name, grain, look, frame) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  const t = Date.now();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page); // wartet auf die Stage
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds().length)).toBe(20); // 10 Hintergründe + 10 Fotos
  // Effekt-Canvas statt Rohbild: so viele Bild-Knoten zeigen eine Canvas
  const canvases = () =>
    page.evaluate(() => {
      const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
      return k.stages[0]!.find('Image').filter((n) => (n as import('konva').default.Image).image() instanceof HTMLCanvasElement).length;
    });
  await expect.poll(canvases, { intervals: [20] }).toBe(grain || look ? 10 : 0);
  expect(await page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  return Date.now() - t;
}

/** Foto am Weltpunkt (Standard: Slide 1) in 60 Schritten ziehen, Bildabstände (ms) während des Ziehens. */
async function dragFrames(page: Page, wx = 540, wy = 700) {
  const p = await toScreen(page, wx, wy);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; stop_: boolean };
    w.frames_ = [];
    w.stop_ = false;
    const tick = (t: number) => {
      w.frames_.push(t);
      if (!w.stop_) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 1; i <= 60; i++) await page.mouse.move(p.x + i * 3, p.y + i * 2);
  const t = await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; stop_: boolean };
    w.stop_ = true;
    return w.frames_;
  });
  await page.mouse.up();
  const d = t.slice(1).map((v, i) => v - t[i]!).sort((a, b) => a - b);
  return { median: d[Math.floor(d.length / 2)]!, p95: d[Math.floor(d.length * 0.95)]!, max: d.at(-1)!, frames: d.length };
}

// Rahmen: Schatten (Blur 30) zeichnet Konva bei jedem Neuzeichnen; die Messung zeigt, dass das billig bleibt
for (const [grain, look, label, frame] of [[true, true, 'Korn und Look', false], [true, false, 'Korn', false], [false, false, 'ohne Effekte', false], [true, true, 'Korn, Look und Rahmen', true]] as const) {
  test(`Ziehen mit 4× CPU-Drosselung, 10 Fotos, ${label}: flüssig, kein Neuberechnen`, async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const ms = await open(page, label, grain, look, frame);
    if (grain) console.log(`4× Drosselung: ${label} für 10 Fotos ab «Öffnen» angezeigt nach ${ms} ms (einmalig, inkl. Laden und Textur)`);
    const r = await dragFrames(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`4× Drosselung, ${label}: Median ${r.median.toFixed(1)} ms, p95 ${r.p95.toFixed(1)} ms, max ${r.max.toFixed(1)} ms, ${r.frames} Bilder`);
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.elements()[0]!.x)).toBeGreaterThan(140 + 100);
    // Verschieben ändert keine Eingabe der Effekt-Canvas
    expect(await page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
    expect(r.p95).toBeLessThan(50);
  });
}

test('Ziehen mit 4× CPU-Drosselung auf der Collage: Schatten des Fotorahmens (Blur 30) kostet kaum', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await page.getByRole('button', { name: 'Slide 5', exact: true }).click(); // Collage
  const x0 = 4 * 1080;
  await dropPng(page, x0 + 520, 690, gradientPng(1600, 2000));
  await dropPng(page, x0 + 690, 1100, gradientPng(1200, 1400));
  const filled = () => page.evaluate((x) => window.__bbzbTest.elements().filter((e) => e.x > x && 'assetId' in (e.props as object)).length, x0);
  await expect.poll(filled).toBe(2); // Foto und Sticker gefüllt
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const els = await page.evaluate(() => window.__bbzbTest.elements());
  const foto = els.find((e) => e.role === 'foto' && e.x > x0 && e.x < x0 + 1080)!;
  const cdp = await page.context().newCDPSession(page);
  const run = async () => {
    await frames(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await dragFrames(page, x0 + 300, 400); // Foto mit Rahmen
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const moved = await page.evaluate((id) => window.__bbzbTest.project().elements[id]!.x, foto.id);
    expect(moved).toBeGreaterThan(foto.x + 100); // das Foto mit Rahmen wurde gezogen
    await page.keyboard.press('Control+z');
    return r;
  };
  expect(foto.props).toMatchObject({ frame: true });
  const shadow = await run();
  await page.evaluate((id) => {
    const t = window.__bbzbTest;
    t.patch(id, { props: { ...(t.project().elements[id]!.props as object), frame: false } });
  }, foto.id);
  const plain = await run();
  console.log(`4× Drosselung, Collage: mit Schatten p95 ${shadow.p95.toFixed(1)} ms (Median ${shadow.median.toFixed(1)}), ohne p95 ${plain.p95.toFixed(1)} ms (Median ${plain.median.toFixed(1)})`);
  expect(shadow.p95).toBeLessThan(50);
});

test('Export: 10 Slides mit Foto, Korn und Look, ohne Speicherproblem', async ({ page }) => {
  await open(page, 'Zehn', true, true);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  // JS-Heap alle 20 ms (performance.memory, nur Chromium/Edge): Spitze während des Exports
  const heap = () => page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 2 ** 20);
  const base = await heap();
  await page.evaluate(() => {
    const w = window as unknown as { peak_: number; timer_: number };
    const m = () => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 2 ** 20;
    w.peak_ = m();
    w.timer_ = window.setInterval(() => (w.peak_ = Math.max(w.peak_, m())), 20);
  });
  const t = Date.now();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const path = await (await download).path();
  const ms = Date.now() - t;
  const peak = await page.evaluate(() => {
    const w = window as unknown as { peak_: number; timer_: number };
    clearInterval(w.timer_);
    return w.peak_;
  });
  console.log(`Export 10 Slides mit Korn und Look: ${ms} ms, JS-Heap vorher ${base.toFixed(0)} MB, Spitze ${peak.toFixed(0)} MB, danach ${(await heap()).toFixed(0)} MB`);
  // Speicherproblem hiesse: der Export hält alle Slides gleichzeitig als Bilddaten im Heap (10 × 1080 × 1350 × 4 B ≈ 56 MB)
  expect(peak - base).toBeLessThan(56);
  const files = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(files)).toHaveLength(10);
  for (const f of Object.values(files)) {
    const png = PNG.sync.read(Buffer.from(f));
    expect([png.width, png.height]).toEqual([1080, 1350]);
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
});
