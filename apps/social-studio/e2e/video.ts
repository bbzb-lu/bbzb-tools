import { expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { elements, openSectionsOf } from './fixtures';

const DIR = resolve(`${import.meta.dirname}/fixtures/video`);
// 2 s Rot, dann 2 s Blau, beide mittelhell (Korn wirkt im Modus «overlay» nicht auf reine Farben): das Bild hängt von `video.start` ab
const CLIP = `${DIR}/two-tone.mp4`;

type Probe = { r: number; g: number; b: number; sd: number; top: number; bottom: number };
/** Bild, das der Video-Knoten gerade zeigt (Effekt-Canvas oder Rohbild): Mittelwerte, Streuung der Helligkeit, Helligkeit oben/unten. */
export const probe = (page: Page, id: string) =>
  page.evaluate((id) => {
    type K = typeof import('konva').default;
    const k = (window as unknown as { Konva: K }).Konva;
    const grp = k.stages[0]?.findOne<InstanceType<K['Group']>>(`#${id}`);
    const imgs = grp ? grp.find<InstanceType<K['Image']>>('Image').filter((n) => n.isVisible()) : [];
    const node = imgs[imgs.length - 1];
    if (!node) return null;
    const src = node.image() as HTMLCanvasElement;
    const crop = node.crop();
    const box = crop.width ? crop : { x: 0, y: 0, width: src.width, height: src.height };
    const sample = (sx: number, sy: number, sw: number, sh: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = 100;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, 100, 100);
      return ctx.getImageData(0, 0, 100, 100).data;
    };
    const d = sample(box.x, box.y, box.width, box.height);
    // Streuung (Korn) in Originalauflösung aus der Bildmitte, nicht verkleinert
    const f = sample(box.x + box.width / 2 - 50, box.y + box.height / 2 - 50, 100, 100);
    const m = [0, 0, 0];
    const lum = [0, 0];
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < d.length; i += 4) {
      for (let j = 0; j < 3; j++) m[j]! += d[i + j]!;
      lum[i < d.length / 2 ? 0 : 1]! += d[i]! + d[i + 1]! + d[i + 2]!;
      const l = f[i]! + f[i + 1]! + f[i + 2]!;
      s1 += l;
      s2 += l * l;
    }
    const n = d.length / 4;
    const [r, g, b] = m.map((v) => v / n) as [number, number, number];
    return { r, g, b, sd: Math.sqrt(s2 / n - (s1 / n) ** 2), top: lum[0]! / (n / 2), bottom: lum[1]! / (n / 2) };
  }, id) as Promise<Probe | null>;

export const settled = (page: Page) => expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);

/** Fügt ein Video in die aktuelle Slide ein (Standard: der rot-blaue Testclip) und wartet auf sein Startbild. */
export async function addVideo(page: Page, clip = CLIP): Promise<string> {
  const before = (await elements(page)).length;
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto oder Video hinzufügen' }).click();
  await (await chooser).setFiles(clip);
  await expect.poll(() => elements(page)).toHaveLength(before + 1);
  const id = (await elements(page)).at(-1)!.id;
  await expect.poll(async () => (await probe(page, id))?.r ?? 0).toBeGreaterThan(clip === CLIP ? 100 : 0);
  await settled(page);
  await openSectionsOf(page, id); // Inspector-Abschnitte offen (seit 4c einklappbar)
  return id;
}

export const setStart = (page: Page, id: string, start: number) =>
  page.evaluate(([id, start]) => {
    const props = window.__bbzbTest.elements().find((e) => e.id === id)!.props as { video: object };
    window.__bbzbTest.patch(id as string, { props: { ...props, video: { ...props.video, start } } } as never);
  }, [id, start] as const);

