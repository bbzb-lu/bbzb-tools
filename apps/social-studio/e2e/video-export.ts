import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { elements } from './fixtures';

/** Kürzung und Ton eines Video-Elements per Store setzen (ein Schritt). */
export const setVideo = (page: Page, id: string, patch: { start?: number; end?: number; sound?: boolean }) =>
  page.evaluate(([id, patch]) => {
    const props = window.__bbzbTest.elements().find((e) => e.id === id)!.props as { video: object };
    window.__bbzbTest.patch(id as string, { props: { ...props, video: { ...props.video, ...(patch as object) } } } as never);
  }, [id, patch] as const);

/** Export über den Dialog (JPEG), Dateien aus dem ZIP. */
export async function exportFiles(page: Page): Promise<Record<string, Uint8Array>> {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('JPEG').check();
  const download = page.waitForEvent('download', { timeout: 60_000 });
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  return files;
}

/** n × n Punkte im Bildbereich des Elements (10 bis 90 %), relativ zur Slide `index`. */
export async function pointsIn(page: Page, id: string, index: number, n = 5, size = { width: 1080, height: 1350 }): Promise<[number, number][]> {
  const e = (await elements(page)).find((x) => x.id === id)!;
  const f = Array.from({ length: n }, (_, i) => 0.1 + (0.8 * i) / (n - 1));
  return f.flatMap((fy) => f.map((fx): [number, number] => [(e.x + fx * e.width - index * size.width) / size.width, (e.y + fy * e.height) / size.height]));
}

const q = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * p))]!;

/**
 * Farbvergleich zweier Fleck-Listen (je 5 × 5 px RGB). H.264 (4:2:0) verwischt Kanten, deshalb zählen für die Farbe die in `a`
 * gleichmässigen Flecken (Spannweite je Kanal ≤ 4): `bias` = mittlere Abweichung je Kanal mit Vorzeichen (Farbraumfehler wären
 * hier 5 bis 20), `p50`/`p90` = Abweichung des Fleckmittels (grösster Kanal). `pixel` = grösste Einzelpixel-Abweichung überall.
 */
export function colourDiff(a: number[][], b: number[][]) {
  const ch = (p: number[], c: number) => p.filter((_, j) => j % 3 === c);
  const avg = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
  let pixel = 0;
  a.forEach((pa, i) => pa.forEach((v, j) => (pixel = Math.max(pixel, Math.abs(v - b[i]![j]!)))));
  const flat = a.map((pa, i) => [pa, b[i]!]).filter(([pa]) => [0, 1, 2].every((c) => Math.max(...ch(pa!, c)) - Math.min(...ch(pa!, c)) <= 4));
  const signed = flat.map(([pa, pb]) => [0, 1, 2].map((c) => avg(ch(pb!, c)) - avg(ch(pa!, c))));
  const worst = signed.map((d) => Math.max(...d.map(Math.abs)));
  return { flat: flat.length, bias: Math.max(...[0, 1, 2].map((c) => Math.abs(avg(signed.map((d) => d[c]!))))), p50: q(worst, 0.5), p90: q(worst, 0.9), pixel };
}

export const fmt = (d: ReturnType<typeof colourDiff>) =>
  `${d.flat} gleichmässige Flecken, Abweichung je Kanal mit Vorzeichen ${d.bias.toFixed(2)}, Fleckmittel Median ${d.p50.toFixed(2)}, 90 % ${d.p90.toFixed(2)}, Einzelpixel max ${d.pixel}`;

/**
 * Editor und Export stimmen in der Farbe überein: Toleranz 3 je Kanal für die Abweichung mit Vorzeichen, Median der Flecken höchstens 2.
 * Das 90-%-Quantil liegt bei Testbildern mit vielen Kanten bei 3 (Kompression), es wird nur berichtet.
 */
export function expectSameColour(d: ReturnType<typeof colourDiff>) {
  expect(d.flat).toBeGreaterThan(10);
  expect(d.bias).toBeLessThanOrEqual(3);
  expect(d.p50).toBeLessThanOrEqual(2);
}

export const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** Kein Video-Export offen (Decoder, Encoder, Canvases freigegeben). */
export const noOpenExport = (page: Page) => expect.poll(() => page.evaluate(() => window.__bbzbTest.videoExportOpen())).toBe(0);
