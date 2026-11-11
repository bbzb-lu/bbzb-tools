import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { bbzbsocial, elements, toScreen, view } from './fixtures';

// Braveold bildet «st» (auch ct, fi, fl …) als Ligatur: das s bekommt einen Bogen über der x-Höhe, der ins t läuft.
// Der Test zählt dunkle Pixel über der x-Höhe im mittleren Teil jedes «s». Ohne Ligatur: keine.
const SIZE = 200;
const TEXT = 'Kunst Lust';
const X = 72;
const Y = 72;

const project = {
  schemaVersion: 1, id: 'lig', name: 'Ligatur', createdAt: 0, updatedAt: 0,
  format: { id: 'post', width: 1080, height: 1350 },
  slides: [{ id: 's1', background: 'warmweiss' }],
  elements: {
    t1: {
      id: 't1', type: 'text', name: 'Kommentar', x: X, y: Y, width: 936, height: 240,
      rotation: 0, opacity: 1, visible: true, locked: false,
      props: { text: TEXT, style: 'kommentar', color: 'blauschwarz', fontSize: SIZE, align: 'left' },
    },
  },
  order: ['t1'],
  assets: {},
};

type Ranges = { s: [number, number][]; u: [number, number] };

/** Spalten der «s» (mittlere 60 %) und des ersten «u», gemessen mit Canvas in der Kommentar-Schrift. */
const columns = (page: Page, spacing: number) =>
  page.evaluate(
    ({ text, size, spacing }) => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.font = `${size}px "BBZB Kommentar"`;
      const at = (i: number) => c.measureText(text.slice(0, i)).width + i * spacing;
      const range = (i: number, inset: number): [number, number] => {
        const a = at(i);
        const w = c.measureText(text[i]!).width;
        return [a + w * inset, a + w * (1 - inset)];
      };
      const s = [...text].flatMap((ch, i) => (ch === 's' ? [range(i, 0.2)] : []));
      return { s, u: range(text.indexOf('u'), 0.25) };
    },
    { text: TEXT, size: SIZE, spacing },
  );

/** Dunkle Pixel über der x-Höhe (oberste Tinte im «u» minus 3 px) in den s-Spalten, je «s». */
function inkAboveXHeight(png: PNG, r: Ranges, ox: number, oy: number, h: number): number[] {
  const dark = (x: number, y: number) => {
    const i = (Math.round(y) * png.width + Math.round(x)) * 4;
    const d = png.data;
    return d[i + 3]! > 128 && 0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]! < 100;
  };
  let xTop = oy + h;
  for (let y = oy; y < oy + h && xTop === oy + h; y++) {
    for (let x = ox + r.u[0]; x < ox + r.u[1]; x++) if (dark(x, y)) xTop = y;
  }
  expect(xTop).toBeLessThan(oy + h); // u gefunden
  return r.s.map(([a, b]) => {
    let n = 0;
    for (let y = oy; y < xTop - 3; y++) for (let x = ox + a; x < ox + b; x++) if (dark(x, y)) n++;
    return n;
  });
}

const decode = (dataUrl: string) => PNG.sync.read(Buffer.from(dataUrl.split(',')[1]!, 'base64'));

/** Kommentartext so, wie der Editor ihn zeichnet (Konva-Knoten, Massstab 1). */
// Knoten-Bild enthält den Massstab der Stage: mit 1 / Massstab in Slide-Pixeln (sonst hängt der Test von der Höhe der Leinwand ab).
const editorPng = async (page: Page) =>
  decode(
    await page.evaluate(() => {
      const stage = (window as unknown as { Konva: typeof import('konva').default }).Konva.stages[0]!;
      return stage.findOne('#t1')!.toDataURL({ pixelRatio: 1 / stage.scaleX() });
    }),
  );

async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  return PNG.sync.read(Buffer.from(Object.values(files)[0]!));
}

test('Messung erkennt die Ligatur, wenn der Browser sie bildet (Kontrolle)', async ({ page }) => {
  await page.goto('');
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family.includes('Kommentar') && f.status === 'loaded'));
  const url = await page.evaluate(
    ({ text, size }) => {
      const cv = document.createElement('canvas');
      cv.width = 936;
      cv.height = 300;
      const c = cv.getContext('2d')!;
      c.font = `${size}px "BBZB Kommentar"`;
      c.fillText(text, 0, size);
      return cv.toDataURL();
    },
    { text: TEXT, size: SIZE },
  );
  const ink = inkAboveXHeight(decode(url), await columns(page, 0), 0, 0, 300);
  expect(ink.every((n) => n > 50)).toBe(true);
});

// Laufweite des Stils (−10/1000 em) und 0 (Regler): bei 0 zeichnet Konva den Text in einem Stück, dann greifen Ligaturen.
for (const spacingEm of [-0.01, 0]) {
  test(`Kommentar «${TEXT}» ohne st-Ligatur in Editor und Export (Laufweite ${spacingEm} em)`, async ({ page }) => {
    await page.goto('');
    await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project) });
    await page.getByRole('button', { name: '«Ligatur» öffnen', exact: true }).click();
    await view(page);
    await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds())).toContain('t1');
    const spacing = spacingEm * SIZE;
    if (spacingEm === 0) {
      // über den Regler: Stil −10/1000 em, zehnmal +1
      const c = await toScreen(page, X + 100, Y + 100);
      await page.mouse.click(c.x, c.y);
      await page.getByRole('slider', { name: 'Laufweite' }).focus();
      for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
      await expect.poll(async () => (await elements(page))[0]!.props).toMatchObject({ tracking: 10 });
      await page.mouse.click(5, 5); // Auswahlrahmen nicht im Bild
    }
    // ZWNJ nur bei Laufweite 0; sonst zeichnet Konva je Zeichen, ein ZWNJ gäbe dort zusätzlichen Abstand.
    const node = await page.evaluate(() => {
      const t = (window as unknown as { Konva: typeof import('konva').default }).Konva.stages[0]!.findOne<import('konva').default.Group>('#t1')!.findOne<import('konva').default.Text>('Text')!;
      return { ls: t.letterSpacing(), zwnj: t.text().includes('\u200C') };
    });
    expect(node).toEqual({ ls: spacing, zwnj: spacingEm === 0 });
    const r = await columns(page, spacing);
    const { height } = (await elements(page))[0]!;
    expect(inkAboveXHeight(await editorPng(page), r, 0, 0, height)).toEqual([0, 0]);
    expect(inkAboveXHeight(await exportPng(page), r, X, Y, height)).toEqual([0, 0]);
    // Gespeicherter Text bleibt unverändert (kein unsichtbares Zeichen im Dokument).
    expect((await elements(page))[0]!.props).toMatchObject({ text: TEXT });
  });
}
