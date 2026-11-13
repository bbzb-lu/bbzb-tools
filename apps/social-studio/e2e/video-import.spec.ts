import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LayoutPreset } from '../src/core/types';
import { addPhoto, elements, gradientPng, newProject, openAllSections, toScreen } from './fixtures';

const VID = resolve(`${import.meta.dirname}/fixtures/video`);
const HEIC = resolve(`${import.meta.dirname}/fixtures/photo-rot90.heic`);

test.beforeAll(() => {
  if (existsSync(`${VID}/rotated-90.mov`)) return;
  try {
    execFileSync('sh', [`${import.meta.dirname}/../scripts/make-test-videos.sh`], { stdio: 'pipe' });
  } catch {
    throw new Error('Testvideos fehlen und lassen sich nicht erzeugen: ffmpeg installieren, dann `sh scripts/make-test-videos.sh`.');
  }
});

const photo = { type: 'photo', role: 'foto', name: 'Foto', x: 72, y: 470, width: 936, height: 540, props: {} };
const preset: LayoutPreset = { id: 'q', label: 'Querformat', format: 'post', slides: 1, background: 'warmweiss', elements: [photo] };

const chooseVideo = async (page: Page, button: string, file: string) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button }).click();
  await (await chooser).setFiles(file);
};
const addVideo = (page: Page, file: string) => chooseVideo(page, 'Foto oder Video hinzufügen', file);

test('H.264-Hochformat: Element mit video, Asset mit Videomime und Anzeigemassen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page, `${VID}/portrait-h264-aac.mp4`);
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [el] = await elements(page);
  expect(el!.props).toMatchObject({ video: { start: 0, end: 10, sound: false }, grain: false, look: true });
  const assets = await page.evaluate(() => Object.values(window.__bbzbTest.project().assets));
  expect(assets).toMatchObject([{ mime: 'video/mp4', width: 1080, height: 1920 }]);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('MOV mit 90°-Drehung: Anzeigemasse 1080x1920', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page, `${VID}/rotated-90.mov`);
  await expect.poll(() => elements(page)).toHaveLength(1);
  const assets = await page.evaluate(() => Object.values(window.__bbzbTest.project().assets));
  expect(assets).toMatchObject([{ mime: 'video/quicktime', width: 1080, height: 1920 }]);
});

test('Clip über 60 s: Import klappt, Ausschnitt auf 60 s gekürzt, Warnung', async ({ page }, info) => {
  const long = info.outputPath('long.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x284:rate=1:duration=65', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', long]);
  await newProject(page, 'Post 4:5');
  await addVideo(page, long);
  await expect(page.getByRole('alert')).toContainText('Export und Vorschau werden langsam.');
  const [el] = await elements(page);
  expect(el!.props).toMatchObject({ video: { start: 0, end: 60 } });
  expect((el!.props as { video: { duration: number } }).video.duration).toBeGreaterThan(64);
});

test('HEIC (gedreht) wird im Browser zu JPEG umgewandelt, Hochformat, ohne Meldung', async ({ page }) => {
  // Edge/Chromium auf dem Mac öffnet HEIC selbst; ohne HEVC-Erweiterung (Windows) scheitert es: das nachstellen.
  await page.addInitScript(() => {
    const orig = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((src: ImageBitmapSource, ...a: unknown[]) =>
      src instanceof Blob && src.type !== 'image/jpeg' && src.type !== 'image/png'
        ? Promise.reject(new DOMException('no hevc', 'InvalidStateError'))
        : (orig as (...x: unknown[]) => Promise<ImageBitmap>)(src, ...a)) as typeof createImageBitmap;
  });
  await newProject(page, 'Post 4:5');
  await addPhoto(page, { name: 'IMG_1.HEIC', mimeType: 'image/heic', buffer: readFileSync(HEIC) });
  await expect.poll(() => elements(page), { timeout: 30_000 }).toHaveLength(1);
  const assets = await page.evaluate(() => Object.values(window.__bbzbTest.project().assets));
  expect(assets).toMatchObject([{ mime: 'image/jpeg', width: 32, height: 64 }]); // 64x32 mit irot 90
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Video in Platzhalter ziehen, mit Foto ersetzen, wieder mit Video ersetzen', async ({ page }, info) => {
  const small = info.outputPath('small.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x284:rate=10:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', small]);
  await newProject(page, 'Post 4:5');
  const [id] = await page.evaluate((p) => window.__bbzbTest.applyLayout(p, 0), preset);
  const prop = async () => (await elements(page)).find((e) => e.id === id)!.props as { video?: { end: number } };

  const at = await toScreen(page, 540, 740);
  const bytes = [...readFileSync(small)];
  const dataTransfer = await page.evaluateHandle((b) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(b)], 'clip.mp4', { type: 'video/mp4' }));
    return dt;
  }, bytes);
  await page.locator('.canvas-scroll').dispatchEvent('drop', { dataTransfer, clientX: at.x, clientY: at.y });
  await expect.poll(async () => (await prop()).video?.end).toBe(3);
  expect(await elements(page)).toHaveLength(1);
  await openAllSections(page);

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Video ersetzen' }).click();
  await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: gradientPng(300, 400) });
  await expect.poll(async () => (await prop()).video).toBeUndefined();
  await openAllSections(page); // «Bild» am Foto hat ein eigenes Auf/Zu (am Video liegt es in «Video»)

  await chooseVideo(page, 'Foto ersetzen', small);
  await expect.poll(async () => (await prop()).video?.end).toBe(3);
});

test('kaputte MP4-Datei: Meldung mit Anleitung, kein Element, nichts gespeichert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto oder Video hinzufügen' }).click();
  await (await chooser).setFiles({ name: 'kaputt.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 1) });
  await expect(page.getByRole('alert')).toContainText('Edge kann dieses Video nicht abspielen.');
  expect(await elements(page)).toEqual([]);
  const stored = await page.evaluate(async () => {
    let n = 0;
    for await (const _ of (await navigator.storage.getDirectory()).entries()) n++; // eslint-disable-line @typescript-eslint/no-unused-vars
    return n;
  });
  expect(stored).toBe(0);
});

test('Projektdatei sichern mit Video: Hinweis, dass Videos separat gesichert werden müssen; ohne Video kein Hinweis', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, { name: 'f.png', mimeType: 'image/png', buffer: gradientPng(400, 300) });
  const save = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
    await download;
  };
  await save();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto oder Video hinzufügen' }).click();
  await (await chooser).setFiles(`${VID}/landscape-h264-aac.mp4`);
  await expect.poll(() => elements(page)).toHaveLength(2);
  await save();
  await expect(page.getByRole('alert')).toHaveText('Videos sind nicht in der Projektdatei. Sichere sie separat.');
});
