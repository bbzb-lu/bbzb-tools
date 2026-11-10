import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { bbzbsocial, exportPng, gradientPng, meanDiff } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Streuung des Grünkanals über die ganze Slide (blaue Fläche: nur Korn streut). */
function spread(p: PNG) {
  let s = 0, q = 0;
  const n = p.width * p.height;
  for (let i = 0; i < n; i++) {
    const g = p.data[i * 4 + 1]!;
    s += g;
    q += g * g;
  }
  return Math.sqrt(q / n - (s / n) ** 2);
}

/** Je Slide eine Variante: Hintergrund Blau mit Korn (alt, 40, 0, 100), dann Foto ohne Korn, Korn alt, 14, 100. */
function strengthProject() {
  const photo = gradientPng(1080, 1350);
  const id = createHash('sha256').update(photo).digest('hex');
  const bg = [{ grain: true }, { grain: true, grainStrength: 40 }, { grain: true, grainStrength: 0 }, { grain: true, grainStrength: 100 }];
  const fx = [{ grain: false }, { grain: true }, { grain: true, grainStrength: 14 }, { grain: true, grainStrength: 100 }];
  const base = { rotation: 0, opacity: 1, visible: true, locked: false, y: 0, width: 1080, height: 1350, type: 'photo', name: 'Foto' };
  const elements = Object.fromEntries(fx.map((p, k) => [`f${k}`, { ...base, id: `f${k}`, x: (4 + k) * 1080, props: { assetId: id, crop: { x: 0, y: 0, scale: 1 }, ...p } }]));
  return bbzbsocial(
    {
      schemaVersion: 1, id: 'st', name: 'Stärke', createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [...bg.map((g, k) => ({ id: `b${k}`, background: 'blau', ...g })), ...fx.map((_, k) => ({ id: `p${k}`, background: 'blau' }))],
      elements, order: Object.keys(elements),
      assets: { [id]: { mime: 'image/png', width: 1080, height: 1350, name: 'verlauf.png' } },
    },
    { [id]: photo },
  );
}

test('Export: Stärke fehlt = Standard (pixelgleich), 0 = kein Korn, 100 stärker als der Standard; Slide und Foto', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'st.bbzbsocial', mimeType: 'application/zip', buffer: strengthProject() });
  await page.getByRole('button', { name: '«Stärke» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Stärke');
  const [old, forty, zero, full, raw, fotoOld, foto14, foto100] = await exportPng(page);
  // altes Projekt (nur grain: true) und Standard 40 bzw. 14: dieselben Pixel
  expect(Buffer.compare(old!.data, forty!.data)).toBe(0);
  expect(Buffer.compare(fotoOld!.data, foto14!.data)).toBe(0);
  // 0: reines Blau wie ohne Korn
  expect(spread(zero!)).toBe(0);
  expect([...zero!.data.subarray(0, 3)]).toEqual(rgb(colors.blau));
  // 100: deutlich mehr Streuung als 40, am Foto mehr Abweichung vom Rohbild als 14
  const s40 = spread(forty!), s100 = spread(full!);
  console.log(`Streuung Grün Blau+Korn: 40 % → ${s40.toFixed(2)}, 100 % → ${s100.toFixed(2)}`);
  expect(s40).toBeGreaterThan(1);
  expect(s100).toBeGreaterThan(2 * s40);
  const d14 = Math.min(...meanDiff(foto14!, raw!)), d100 = Math.min(...meanDiff(foto100!, raw!));
  console.log(`Abweichung Foto vom Rohbild: 14 % → ${d14.toFixed(2)}, 100 % → ${d100.toFixed(2)}`);
  expect(d14).toBeGreaterThan(0.5);
  expect(d100).toBeGreaterThan(3 * d14);
});
