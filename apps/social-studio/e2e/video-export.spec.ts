import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { addPhoto, addSlide, newProject, png } from './fixtures';
import { addVideo, settled, twoTone } from './video';
import { b64, colourDiff, expectSameColour, exportFiles, fmt, noOpenExport, pointsIn, setVideo } from './video-export';

// Ton als Opus statt AAC: muss neu kodiert werden
const OPUS = `${import.meta.dirname}/fixtures/video/opus-audio.mp4`;
// Querformat mit feinem Gitter (2 px Linien alle 8 px): Unschärfe durch zu kleines Dekodieren fällt sofort auf
const GRID = `${import.meta.dirname}/fixtures/video/landscape-grid.mp4`;
// Wie two-tone (2 s Rot, 2 s Blau), aber mit Ton
const TWO_TONE_AAC = `${import.meta.dirname}/fixtures/video/two-tone-aac.mp4`;
test.beforeAll(() => {
  twoTone();
  if (!existsSync(TWO_TONE_AAC)) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${import.meta.dirname}/fixtures/video/two-tone.mp4`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4',
      '-c:v', 'copy', '-c:a', 'aac', '-shortest', TWO_TONE_AAC]);
  }
  if (!existsSync(GRID)) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:r=30:d=3,drawgrid=w=8:h=8:t=2:c=white',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', GRID]);
  }
  if (existsSync(OPUS)) return;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x400:rate=30:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-shortest', OPUS]);
});

const probe = (page: Page, bytes: Uint8Array, t: number, pts: [number, number][]) =>
  page.evaluate(([s, t, pts]) => window.__bbzbTest.videoProbe(s, t, pts), [b64(bytes), t, pts] as const);
/** Dateien ohne den Projektnamen (Datum), in ZIP-Reihenfolge. */
const suffixes = (files: Record<string, Uint8Array>) => Object.keys(files).map((n) => n.slice(n.lastIndexOf('_')));
const file = (files: Record<string, Uint8Array>, suffix: string) => Object.entries(files).find(([n]) => n.endsWith(suffix))![1];
const slidePixels = (page: Page, i: number, pts: [number, number][]) =>
  page.evaluate(([i, pts]) => window.__bbzbTest.slidePixels(i, pts), [i, pts] as const);

/** Slide 1 Foto, Slide 2 Video (rot 0 bis 2 s, dann blau). */
async function mixed(page: Page, trim: { start: number; end: number }) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1080, 1350));
  await addSlide(page);
  const id = await addVideo(page);
  await setVideo(page, id, trim);
  await settled(page);
  return id;
}

test('gemischtes Projekt: _01.jpg und _02.mp4, MP4 mit gekürzter Dauer, 1080 px, 30 fps, ohne Ton', async ({ page }) => {
  const id = await mixed(page, { start: 1, end: 3.5 });
  const pts = await pointsIn(page, id, 1);
  const editor = await slidePixels(page, 1, pts);
  const files = await exportFiles(page);
  expect(suffixes(files)).toEqual(['_01.jpg', '_02.mp4']);
  const mp4 = file(files, '_02.mp4');
  const first = await probe(page, mp4, 0, pts);
  expect([first.width, first.height]).toEqual([1080, 1350]);
  expect(first.frames).toBe(75); // 2.5 s × 30, konstant
  expect(Math.abs(first.duration - 2.5)).toBeLessThanOrEqual(1 / 30);
  expect(first.audio).toBeNull();
  // erstes Bild = Startbild im Editor (Look an)
  const d = colourDiff(editor, first.pixels);
  console.log(`two-tone Start 1 s, Editor gegen Export: ${fmt(d)}`);
  expectSameColour(d);
  // bei 1.5 s im MP4 läuft schon das Blau (Quelle 2.5 s): Zeiten ab dem Start
  const later = await probe(page, mp4, 1.5, pts);
  const [r, , b] = later.pixels[12]!;
  expect(b! - r!).toBeGreaterThan(60);
  await noOpenExport(page);
});

test('gekürzter Start > 0: erstes Bild ist das Startbild (blau), nicht der Dateianfang', async ({ page }) => {
  const id = await mixed(page, { start: 2.5, end: 3.5 });
  const pts = await pointsIn(page, id, 1);
  const editor = await slidePixels(page, 1, pts);
  const mp4 = file(await exportFiles(page), '_02.mp4');
  const first = await probe(page, mp4, 0, pts);
  const [r, , b] = first.pixels[12]!;
  expect(b! - r!).toBeGreaterThan(60);
  expectSameColour(colourDiff(editor, first.pixels));
  expect(first.frames).toBe(30);
});

test('Ton nur, wenn eingeschaltet: AAC, Länge wie das gekürzte Stück', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, `${import.meta.dirname}/fixtures/video/landscape-h264-aac.mp4`);
  await setVideo(page, id, { start: 2, end: 5 });
  await settled(page);
  const pts = await pointsIn(page, id, 0);
  const silent = file(await exportFiles(page), '_01.mp4');
  expect((await probe(page, silent, 0, pts)).audio).toBeNull();
  await setVideo(page, id, { sound: true });
  const loud = await probe(page, file(await exportFiles(page), '_01.mp4'), 0, pts);
  expect(loud.audio).toBe('aac');
  expect(Math.abs(loud.audioDuration! - 3)).toBeLessThanOrEqual(0.05); // kopiert: höchstens ein AAC-Frame länger
  expect(Math.abs(loud.duration - 3)).toBeLessThanOrEqual(0.05);
  expect(loud.frames).toBe(90);
});

test('Abbrechen: kein ZIP, alles freigegeben, danach klappt der Export', async ({ page }) => {
  await mixed(page, { start: 0, end: 4 });
  const r = await page.evaluate(() => window.__bbzbTest.runExport('jpeg', 20));
  expect(r.error).toMatch(/^AbortError/);
  expect(r.files).toBeUndefined();
  expect(r.progress).toBeLessThan(60); // stoppt bei 20 % von 120 Frames, nicht erst am Ende
  await noOpenExport(page);
  expect(suffixes(await exportFiles(page))).toEqual(['_01.jpg', '_02.mp4']);
});

test('ohne H.264-Encoder: Meldung vor der ersten Slide, nichts exportiert', async ({ page }) => {
  await page.addInitScript(() => {
    VideoEncoder.isConfigSupported = async (config) => ({ supported: false, config });
  });
  await mixed(page, { start: 0, end: 2 });
  const r = await page.evaluate(() => window.__bbzbTest.runExport('jpeg'));
  expect(r.error).toContain('keine Videos erzeugen');
  expect(r.progress).toBe(0);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Edge kann auf diesem Gerät keine Videos erzeugen');
  expect(downloaded).toBe(false);
  await noOpenExport(page);
});

test('Ton ohne AAC in der Quelle: neu als AAC kodiert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, OPUS);
  await setVideo(page, id, { start: 0.5, end: 2.5, sound: true });
  await settled(page);
  const out = await probe(page, file(await exportFiles(page), '_01.mp4'), 0, [[0.5, 0.5]]);
  expect(out.audio).toBe('aac');
  expect(Math.abs(out.audioDuration! - 2)).toBeLessThanOrEqual(0.1); // neu kodiert: bis ~2 AAC-Frames länger (Task 1)
});

test('Ton ohne AAC in der Quelle und ohne AAC-Encoder: Meldung vor der ersten Slide', async ({ page }) => {
  await page.addInitScript(() => {
    AudioEncoder.isConfigSupported = async (config) => ({ supported: false, config });
  });
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, OPUS);
  await setVideo(page, id, { sound: true });
  const r = await page.evaluate(() => window.__bbzbTest.runExport('jpeg'));
  expect(r.error).toContain('Ton dieses Videos auf diesem Gerät nicht verarbeiten');
  expect(r.progress).toBe(0);
  // ohne Ton geht es
  await setVideo(page, id, { sound: false });
  expect((await page.evaluate(() => window.__bbzbTest.runExport('jpeg'))).files).toHaveLength(1);
  await noOpenExport(page);
});

test('Export beendet die laufende Vorschau', async ({ page }) => {
  await mixed(page, { start: 0, end: 2 });
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.preview().open)).toBe(1);
  expect((await page.evaluate(() => window.__bbzbTest.runExport('jpeg'))).files).toHaveLength(2);
  expect(await page.evaluate(() => window.__bbzbTest.preview().open)).toBe(0);
});

test('Querformat im Vollbild einer Hochformat-Slide bleibt scharf (dekodiert in voller Breite)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, GRID);
  // Vollbild 1080 × 1350, deckend: 1920 × 1080 × 1.25, waagrecht zentriert; ohne Effekte, damit nur die Schärfe zählt
  await page.evaluate((id) => {
    const props = window.__bbzbTest.elements().find((e) => e.id === id)!.props as object;
    const crop = { x: (1080 - 1920 * 1.25) / 2, y: 0, scale: 1.25 };
    window.__bbzbTest.patch(id, { x: 0, y: 0, width: 1080, height: 1350, props: { ...props, crop, look: false, grain: false } } as never);
  }, id);
  await setVideo(page, id, { start: 1, end: 2 });
  await settled(page);
  const f = Array.from({ length: 12 }, (_, i) => 0.1 + (0.8 * i) / 11);
  const pts = f.flatMap((y) => f.map((x): [number, number] => [x, y]));
  const out = await probe(page, file(await exportFiles(page), '_01.mp4'), 0, pts);
  // Soll: Quelle in voller Grösse um 1.25 vergrössert (2400 × 1350), Ausschnitt ab x = 660
  const src = b64(readFileSync(GRID));
  const ref = await page.evaluate(([s, pts]) => window.__bbzbTest.videoProbe(s, 1, pts, 2400),
    [src, pts.map(([x, y]): [number, number] => [(660 + x * 1080) / 2400, y])] as const);
  const diff = out.pixels.flatMap((p, i) => p.map((v, j) => Math.abs(v - ref.pixels[i]![j]!)));
  const mean = diff.reduce((a, b) => a + b, 0) / diff.length;
  console.log(`Querformat im Vollbild: mittlere Abweichung zum scharfen Soll ${mean.toFixed(2)}`);
  expect(mean).toBeLessThan(12); // gemessen 3.6, mit der alten Grenze 1080 px 40
});

test('zwei Videos auf einer Slide: längstes bestimmt die Dauer, kürzeres bleibt stehen, Ton nur vom ersten mit Ton', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  // unten (zuerst eingefügt): 1 s Rot mit Ton; darüber: 3 s Querformat mit Ton
  const short = await addVideo(page, TWO_TONE_AAC);
  const long = await addVideo(page, `${import.meta.dirname}/fixtures/video/landscape-h264-aac.mp4`);
  const place = (id: string, x: number, y: number, w: number, h: number) =>
    page.evaluate(([id, x, y, w, h]) => {
      const e = window.__bbzbTest.elements().find((e) => e.id === id)!;
      const props = e.props as { crop: object };
      const meta = window.__bbzbTest.project().assets[(e.props as { assetId: string }).assetId]!;
      const scale = Math.max(w / meta.width, h / meta.height);
      const crop = { x: (w - meta.width * scale) / 2, y: (h - meta.height * scale) / 2, scale };
      window.__bbzbTest.patch(id, { x, y, width: w, height: h, props: { ...props, crop } } as never);
    }, [id, x, y, w, h] as const);
  await place(short, 0, 0, 540, 675);
  await place(long, 540, 675, 540, 675);
  await setVideo(page, short, { start: 1, end: 2, sound: true });
  await setVideo(page, long, { start: 0, end: 3, sound: true });
  await settled(page);
  const pts = await pointsIn(page, short, 0);
  const mp4 = file(await exportFiles(page), '_01.mp4');
  const out = await probe(page, mp4, 0, pts);
  expect(out.frames).toBe(90); // 3 s × 30 vom längeren Video
  expect(out.audio).toBe('aac');
  expect(Math.abs(out.audioDuration! - 1)).toBeLessThanOrEqual(0.05); // Ton vom unteren Video (1 s), nicht vom oberen (3 s)
  // bei 2.5 s ist das kurze Video vorbei: sein letztes Bild (Rot) bleibt stehen, weiterlaufen ergäbe Blau (Quelle 3.5 s)
  const late = await probe(page, mp4, 2.5, pts);
  for (const [r, , b] of late.pixels) expect(r! - b!).toBeGreaterThan(60);
  expectSameColour(colourDiff((await probe(page, mp4, 29 / 30, pts)).pixels, late.pixels));
  await noOpenExport(page);
});
