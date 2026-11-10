import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { bbzbsocial, openSectionsOf, toScreen, view } from './fixtures';

export type Box = { x: number; y: number; width: number; height: number };
type Props = Record<string, unknown>;

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Ein Slide (Blau) mit einem Foto in `box`; ohne `asset` ein leerer Platzhalter aus einem Layout. `mask`: Maskendatei (Graustufen-PNG). */
export function photoProject(name: string, box: Box, props: Props, asset?: Buffer, mask?: Buffer) {
  const id = asset && sha(asset);
  const meta = asset && PNG.sync.read(asset);
  const mid = mask && sha(mask);
  // Maske: Grösse aus der Datei, wenn lesbar (eine absichtlich kaputte Datei bekommt 1 × 1)
  const mmeta = (() => {
    try {
      return mask && PNG.sync.read(mask);
    } catch {
      return { width: 1, height: 1 };
    }
  })();
  return bbzbsocial(
    {
      schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [{ id: 's1', background: 'blau' }],
      elements: {
        e0: {
          id: 'e0', type: 'photo', name: 'Foto', ...box, rotation: 0, opacity: 1, visible: true, locked: false,
          ...(asset ? {} : { role: 'foto' }),
          props: { ...(id && { assetId: id }), ...(mid && { mask: mid }), crop: { x: 0, y: 0, scale: 1 }, grain: false, look: false, ...props },
        },
      },
      order: ['e0'],
      assets: {
        ...(id && { [id]: { mime: 'image/png', width: meta!.width, height: meta!.height, name: 'foto.png' } }),
        ...(mid && { [mid]: { mime: 'image/png', width: mmeta!.width, height: mmeta!.height, name: 'Maske' } }),
      },
    },
    { ...(id && { [id]: asset! }), ...(mid && { [mid]: mask! }) },
  );
}

/** Projekt öffnen und warten, bis das Foto steht; `hitAt` (Weltpunkt) muss das Foto treffen (Bild geladen und gezeichnet). */
export async function openPhoto(page: Page, name: string, box: Box, props: Props, asset?: Buffer, hitAt = [540, 700], mask?: Buffer) {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: photoProject(name, box, props, asset, mask) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds().length)).toBe(2);
  const c = await toScreen(page, hitAt[0]!, hitAt[1]!);
  await expect.poll(() => page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [c.x, c.y])).toBe('e0');
  await openSectionsOf(page, 'e0'); // Inspector-Abschnitte offen (seit 4c einklappbar)
}

/** RGBA-PNG: `alpha(x, y)` je Pixel, Farbe `rgb`. */
export function alphaPng(width: number, height: number, rgb: number[], alpha: (x: number, y: number) => number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) png.data.set([...rgb, alpha(x, y)], (y * width + x) * 4);
  return PNG.sync.write(png);
}

/** Freisteller: Kreis (Radius 40 % der kürzeren Seite) mit runder Aussparung (15 %), Rand durchsichtig. */
export function cutoutPng(width: number, height: number, rgb: number[]): Buffer {
  const cx = width / 2, cy = height / 2, m = Math.min(width, height);
  return alphaPng(width, height, rgb, (x, y) => {
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    return r <= 0.4 * m && r > 0.15 * m ? 255 : 0;
  });
}

/** Maskendatei wie saveMask: Graustufen-PNG (R = G = B = `value(x, y)`, 255 = sichtbar), deckend. */
export function maskPng(width: number, height: number, value: (x: number, y: number) => number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = value(x, y);
    png.data.set([v, v, v, 255], (y * width + x) * 4);
  }
  return PNG.sync.write(png);
}
