import { expect, test, type Page } from '@playwright/test';
import { elements, newProject } from './fixtures';
import { addVideo, settled } from './video';
import { b64, exportFiles, noOpenExport, setVideo } from './video-export';

/** Bildschirmposition des Dreh-Ankers (Mitte). */
const rotater = (page: Page) =>
  page.evaluate(() => {
    const t = window.Konva.stages[0]!.findOne('Transformer')!;
    const a = (t as unknown as { findOne: (s: string) => { getClientRect: () => { x: number; y: number; width: number; height: number } } }).findOne('.rotater');
    const r = a.getClientRect();
    const b = window.Konva.stages[0]!.container().getBoundingClientRect();
    return { x: b.left + r.x + r.width / 2, y: b.top + r.y + r.height / 2 };
  });

test('Video mit der Maus drehen: Anker erreichbar, Drehung gesetzt, Vorschau und Export gedreht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  await setVideo(page, id, { start: 0, end: 2.5 });
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 0, y: 0, width: 1080, height: 1350 }), id);
  await settled(page);
  await page.evaluate((id) => window.__bbzbTest.select(id), id);
  expect(await page.evaluate(() => window.__bbzbTest.transformerAnchors())).toContain('rotater');
  const a = await rotater(page);
  // der Anker liegt auf der Leinwand, nicht unter Leiste oder Overlay
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [a.x, a.y])).toBe('CANVAS');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 80, a.y + 60, { steps: 6 });
  await page.mouse.move(a.x + 200, a.y + 150, { steps: 6 });
  await page.mouse.up();
  const el = (await elements(page)).find((e) => e.id === id)!;
  expect(el.rotation).not.toBe(0);
  // Vorschau: der Konva-Knoten dreht mit
  expect(await page.evaluate((id) => window.Konva.stages[0]!.findOne(`#${id}`)!.rotation(), id)).toBeCloseTo(el.rotation, 1);
  // Export: obere rechte Ecke liegt bei gedrehtem Video ausserhalb des Bilds (Hintergrund), ungedreht wäre sie Rot oder Blau
  const files = await exportFiles(page);
  const mp4 = Object.entries(files).find(([n]) => n.endsWith('.mp4'))![1];
  const pts: [number, number][] = [[0.995, 0.005], [0.2, 0.5]];
  const px = (await page.evaluate(([s, t, p]) => window.__bbzbTest.videoProbe(s, t, p), [b64(mp4), 0.5, pts] as const)).pixels;
  expect(px[0]!.slice(0, 3).every((v, k) => Math.abs(v - [251, 248, 243][k]!) <= 6)).toBe(true); // warmweiss
  expect(px[1]![0]).toBeGreaterThan(130); // Mitte: rotes Video
  await noOpenExport(page);
});
