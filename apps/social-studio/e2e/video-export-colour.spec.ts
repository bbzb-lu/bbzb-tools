import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { newProject } from './fixtures';
import { addVideo, settled } from './video';
import { b64, colourDiff, expectSameColour, exportFiles, fmt, pointsIn, setVideo } from './video-export';

const DIR = `${import.meta.dirname}/fixtures/video`;
// Farbbalken mit BT.709-Angaben im Container (die übrigen Testclips haben keine Farbangaben)
const TAGGED = `${DIR}/tagged-bt709.mp4`;
test.beforeAll(() => {
  if (existsSync(TAGGED)) return;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', TAGGED]);
});

const T = 1; // Start des gekürzten Stücks

/** Bild der Quelldatei bei `t` über ein `<video>` (wie die Vorschau im Inspector), RGB-Flecken an relativen Punkten. */
const htmlVideo = (page: Page, s: string, t: number, pts: [number, number][]) =>
  page.evaluate(async ([s, t, pts]) => {
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))]));
    await new Promise((r) => v.addEventListener('loadeddata', r, { once: true }));
    v.currentTime = t;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    URL.revokeObjectURL(v.src);
    return pts.map(([x, y]) => Array.from(ctx.getImageData(Math.round(x * c.width) - 2, Math.round(y * c.height) - 2, 5, 5).data).filter((_, i) => i % 4 !== 3));
  }, [s, t, pts] as const);

const f = Array.from({ length: 15 }, (_, i) => 0.05 + (0.9 * i) / 14);
const grid = f.flatMap((y) => f.map((x): [number, number] => [x, y]));

for (const clip of ['landscape-h264-aac.mp4', 'tagged-bt709.mp4', 'rotated-90.mov']) {
  test(`Farben: Editor-Startbild und erstes MP4-Bild stimmen überein (${clip})`, async ({ page }) => {
    test.fixme(process.platform === 'win32' && clip === 'tagged-bt709.mp4', 'Windows: <video> zeigt BT.709 anders, github.com/bbzb-lu/bbzb-tools/issues/6');
    await newProject(page, 'Post 4:5');
    const id = await addVideo(page, `${DIR}/${clip}`);
    await setVideo(page, id, { start: T, end: T + 1 });
    await settled(page);
    const pts = await pointsIn(page, id, 0, 15);
    const editor = await page.evaluate((pts) => window.__bbzbTest.slidePixels(0, pts), pts);
    const mp4 = Object.values(await exportFiles(page))[0]!;
    const exported = await page.evaluate(([s, pts]) => window.__bbzbTest.videoProbe(s, 0, pts), [b64(mp4), pts] as const);
    const d = colourDiff(editor, exported.pixels);
    // Vorschau-Quelle (<video>) gegen Mediabunny (Editor), beide ohne Effekte, an derselben Stelle der Quelle
    const src = b64(readFileSync(`${DIR}/${clip}`));
    const raw = await page.evaluate(([s, t, pts]) => window.__bbzbTest.videoProbe(s, t, pts), [src, T, grid] as const);
    const v = colourDiff(raw.pixels, await htmlVideo(page, src, T, grid));
    console.log(`${clip}: Editor gegen Export: ${fmt(d)}. <video> gegen Mediabunny: ${fmt(v)}`);
    expectSameColour(d);
    expectSameColour(v); // gemessen 0.00: Vorschau und Export dekodieren gleich
  });
}

test('Leistung: 10-s-Slide mit 4× CPU-Drosselung', async ({ page }) => {
  test.fixme(process.platform === 'win32', 'Windows-Runner ohne GPU ist kein Zielgerät: github.com/bbzb-lu/bbzb-tools/issues/10');
  test.setTimeout(120_000);
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, `${DIR}/portrait-h264-aac.mp4`);
  await setVideo(page, id, { start: 0, end: 10 });
  await settled(page);
  // Encoder anwärmen wie beim ersten Export einer Sitzung, dann messen
  await page.evaluate(() => window.__bbzbTest.runExport('jpeg'));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  const r = await page.evaluate(() => window.__bbzbTest.runExport('jpeg'));
  const s = (Date.now() - t0) / 1000;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`10-s-Slide, 4× gedrosselt: ${s.toFixed(1)} s`);
  expect(r.files?.length).toBe(1);
  expect(s).toBeLessThan(40); // höchstens 4× Videolänge
});
