import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { addSlide, newProject } from './fixtures';
import { addVideo, settled } from './video';
import { exportFiles, setVideo } from './video-export';

const DIR = `${import.meta.dirname}/fixtures/video`;
const W = 1080;
const ff = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 28 });

/** Exportierte Dateien eines Projekts als MP4 auf die Platte (Testordner). */
function save(files: Record<string, Uint8Array>, dir: string, suffix: string) {
  mkdirSync(dir, { recursive: true });
  const [name, bytes] = Object.entries(files).find(([n]) => n.endsWith(suffix))!;
  const path = `${dir}/${name.slice(name.lastIndexOf('_'))}`;
  writeFileSync(path, bytes);
  return path;
}

/** Ein Bild bei `t` als RGB (Zeilen von oben, 3 Byte je Pixel). */
const frame = (mp4: string, t: number) => ff(['-ss', String(t), '-i', mp4, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);

const stream = (mp4: string, entries: string) =>
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1:nk=1', mp4]).toString().trim().split('\n').map(Number);

/** Bild Nr. `k` (30 fps); die Suchzeit liegt knapp vor dem Zeitstempel, damit ffmpeg dieses und nicht das nächste Bild liefert. */
const frameAt = (mp4: string, k: number) => frame(mp4, Math.max(0, (k - 0.4) / 30));
/** Grösste Kanalabweichung zwischen Spalte W-1 links und Spalte `dx` rechts, Zeilen 320 bis 820 (das Testbild ändert sich nur in x). */
const seamDiff = (left: Buffer, right: Buffer, dx: number) => {
  let worst = 0;
  for (let y = 320; y < 820; y++) {
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(left[(y * W + W - 1) * 3 + c]! - right[(y * W + dx) * 3 + c]!));
  }
  return worst;
};

test('Video über der Naht: beide MP4 gleich lang, beginnen bei 0, Spalte 1079 passt zu Spalte 0 (gleiches Bild)', async ({ page }, info) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, `${DIR}/seam-ramp.mp4`);
  await addSlide(page);
  // 960 × 540 (Massstab 0.5), Naht bei 40 %; Ausschnitt füllt die Fläche
  await page.evaluate(([id, w, h]) => {
    const e = window.__bbzbTest.elements().find((e) => e.id === id)!;
    const props = e.props as { crop: object; assetId: string };
    const meta = window.__bbzbTest.project().assets[props.assetId]!;
    const scale = Math.max(w! / meta.width, h! / meta.height);
    const crop = { x: (w! - meta.width * scale) / 2, y: (h! - meta.height * scale) / 2, scale };
    window.__bbzbTest.patch(id as string, { x: 1080 - 0.4 * w!, y: 300, width: w, height: h, props: { ...props, crop } } as never);
  }, [id, 960, 540] as const);
  await setVideo(page, id, { start: 0, end: 2 });
  await settled(page);
  const files = await exportFiles(page);
  const a = save(files, info.outputPath(), '_01.mp4');
  const b = save(files, info.outputPath(), '_02.mp4');

  const [durA, durB] = [a, b].map((f) => stream(f, 'format=duration')[0]!);
  expect(Math.abs(durA! - durB!)).toBeLessThanOrEqual(1 / 30);
  for (const f of [a, b]) expect(stream(f, 'stream=start_time')[0]).toBeCloseTo(0, 2);

  // Das Testbild (Skript: 0.55 Stufen je Quellpixel, Welle wandert 30 px je Bild, ohne Spitze nahe der Naht): gleiches Bild und
  // richtige Spalte liegen unter der Grenze von 8 (gemessen 2 bis 4), 16 Pixel Versatz (gemessen 21 bis 24) und zwei Bilder Versatz
  // (40 bis 45) deutlich darüber, auch mit einem anderen Encoder (Windows-CI).
  for (const k of [0, 15]) {
    const left = frameAt(a, k);
    const right = frameAt(b, k);
    const real = seamDiff(left, right, 0);
    const shifted = seamDiff(left, right, 16);
    const next = seamDiff(left, frameAt(b, k + 2), 0);
    const msg = `Bild ${k}: Naht ${real}, 16 px verschoben ${shifted}, übernächstes Bild ${next}`;
    expect(real, msg).toBeLessThanOrEqual(8);
    expect(shifted, msg).toBeGreaterThan(8);
    expect(next, msg).toBeGreaterThan(8);
  }
});

test('Ton-Versatz: Farbwechsel im Bild und Einsatz des Tons liegen nach dem Kürzen beide bei 1 s (höchstens 50 ms Abstand)', async ({ page }, info) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, `${DIR}/beep-flash.mp4`); // Wechsel Rot zu Blau und Ton bei 3 s
  await setVideo(page, id, { start: 2, end: 5, sound: true });
  await settled(page);
  const mp4 = save(await exportFiles(page), info.outputPath(), '_01.mp4');

  // Bild: Mittelfarbe jedes Bildes; erstes blaues Bild. Auflösung 1/30 s, also bis 33 ms Unschärfe
  const px = ff(['-i', mp4, '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  let n = 0;
  while (n * 3 < px.length && px[n * 3]! >= px[n * 3 + 2]!) n++;
  const picture = n / 30;
  // Ton: erster Abtastwert über der Hörschwelle (Sinus hat Amplitude ~4000, Stille ist 0)
  const pcm = ff(['-i', mp4, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', '-']);
  let s = 0;
  while ((s + 1) * 2 <= pcm.length && Math.abs(pcm.readInt16LE(s * 2)) < 500) s++;
  const tone = s / 48000;
  const msg = `Bildwechsel ${picture.toFixed(3)} s, Tonbeginn ${tone.toFixed(3)} s`;
  expect(Math.abs(picture - 1), msg).toBeLessThanOrEqual(0.1);
  expect(Math.abs(picture - tone), msg).toBeLessThanOrEqual(0.05);
});
