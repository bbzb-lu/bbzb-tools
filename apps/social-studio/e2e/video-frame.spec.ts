import { expect, test, type Page } from '@playwright/test';
import { elements, newProject } from './fixtures';
import { addVideo, settled } from './video';
import { b64, exportFiles, noOpenExport, setVideo } from './video-export';

// Box kleiner als die Slide (sonst läge der äussere Rahmen ausserhalb des Exports). Warmweisser Rahmen (photoFrame.color = warmweiss 251/248/243). Video: 2 s Rot, dann Blau.
const WARMWEISS = [251, 248, 243];
const W = 1080;
const H = 1350;

const probe = (page: Page, bytes: Uint8Array, t: number, pts: [number, number][]) =>
  page.evaluate(([s, t, pts]) => window.__bbzbTest.videoProbe(s, t, pts), [b64(bytes), t, pts] as const);
const px = (xs: number[][], i: number) => xs[i]!.slice(0, 3);
const near = (a: number[], b: number[], t = 6) => a.every((v, k) => Math.abs(v - b[k]!) <= t);

/** Video mit Rahmen (aussen oder innen) exportieren: erstes und letztes Bild an Punkten am Rand und in der Mitte. */
async function framed(page: Page, outside: boolean) {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  await setVideo(page, id, { start: 0, end: 2.5 });
  await page.evaluate(([id, outside]) => {
    const e = window.__bbzbTest.elements().find((x) => x.id === id)!;
    window.__bbzbTest.patch(id as string, { x: 200, y: 300, width: 680, height: 850, props: { ...e.props, frame: true, frameOutside: outside } } as never);
  }, [id, outside] as const);
  await settled(page);
  const e = (await elements(page)).find((x) => x.id === id)!;
  const rel = (x: number, y: number): [number, number] => [x / W, y / H];
  const cy = e.y + e.height / 2;
  // 8 px ausserhalb der Box, 8 px innerhalb, 60 px innerhalb, Mitte
  const pts = [rel(e.x - 8, cy), rel(e.x + 8, cy), rel(e.x + 60, cy), rel(e.x + e.width / 2, cy)];
  const files = await exportFiles(page);
  const mp4 = Object.entries(files).find(([n]) => n.endsWith('.mp4'))![1];
  const first = await probe(page, mp4, 0, pts);
  const last = await probe(page, mp4, 2.4, pts);
  await noOpenExport(page);
  return { first: first.pixels, last: last.pixels };
}

test('Rahmen aussen am Video: Rahmenfarbe ausserhalb der Box, Video innen, im ersten und letzten Bild', async ({ page }) => {
  const { first, last } = await framed(page, true);
  for (const f of [first, last]) {
    expect(near(px(f, 0), WARMWEISS)).toBe(true);
    for (const i of [1, 2, 3]) expect(near(px(f, i), WARMWEISS, 20)).toBe(false);
  }
});

test('Rahmen innen am Video: Rahmenfarbe am Rand, Video weiter innen, im ersten und letzten Bild', async ({ page }) => {
  const { first, last } = await framed(page, false);
  for (const f of [first, last]) {
    expect(near(px(f, 1), WARMWEISS)).toBe(true);
    for (const i of [2, 3]) expect(near(px(f, i), WARMWEISS, 20)).toBe(false);
  }
});
