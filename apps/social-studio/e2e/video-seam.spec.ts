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

test('Video über der Naht: beide MP4 gleich lang, beginnen bei 0, Spalte 1079 passt zu Spalte 0 (gleiches Bild)', async ({ page }, info) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page, `${DIR}/landscape-h264-aac.mp4`);
  await addSlide(page);
  // 1000 × 600, die Naht liegt bei 40 % (mitten in einem Farbbalken des Testbilds, nicht auf einer Kante); Ausschnitt füllt die Fläche
  await page.evaluate(([id, w, h]) => {
    const e = window.__bbzbTest.elements().find((e) => e.id === id)!;
    const props = e.props as { crop: object; assetId: string };
    const meta = window.__bbzbTest.project().assets[props.assetId]!;
    const scale = Math.max(w! / meta.width, h! / meta.height);
    const crop = { x: (w! - meta.width * scale) / 2, y: (h! - meta.height * scale) / 2, scale };
    window.__bbzbTest.patch(id as string, { x: 1080 - 0.4 * w!, y: 300, width: w, height: h, props: { ...props, crop } } as never);
  }, [id, 1000, 600] as const);
  await setVideo(page, id, { start: 1, end: 3 });
  await settled(page);
  const files = await exportFiles(page);
  const a = save(files, info.outputPath(), '_01.mp4');
  const b = save(files, info.outputPath(), '_02.mp4');

  const [durA, durB] = [a, b].map((f) => stream(f, 'format=duration')[0]!);
  expect(Math.abs(durA! - durB!)).toBeLessThanOrEqual(1 / 30);
  for (const f of [a, b]) expect(stream(f, 'stream=start_time')[0]).toBeCloseTo(0, 2);

  for (const t of [0, 1]) {
    const left = frame(a, t);
    const right = frame(b, t);
    let worst = 0;
    // nur Zeilen 320 bis 700: darunter kreuzt die schräge Linie des Testbilds die Naht (echte Kante, ab Zeile 714)
    for (let y = 320; y < 700; y++) {
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(left[(y * W + W - 1) * 3 + c]! - right[y * W * 3 + c]!));
    }
    console.log(`Naht bei ${t} s: grösste Abweichung je Kanal ${worst}`);
    expect(worst).toBeLessThanOrEqual(8);
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
  console.log(`Bildwechsel ${picture.toFixed(3)} s, Tonbeginn ${tone.toFixed(3)} s`);
  expect(Math.abs(picture - 1)).toBeLessThanOrEqual(0.1);
  expect(Math.abs(picture - tone)).toBeLessThanOrEqual(0.05);
});
