import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { LayoutPreset } from '../src/core/types';
import { dropPng, elements, exportPng, gradientPng, mean, meanDiff, newProject, addSlide } from './fixtures';

const DIR = `${import.meta.dirname}/../src/plugins/layouts/presets`;
const presets: LayoutPreset[] = readdirSync(DIR).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')));
// Beispielfotos ohne Personen (Ruling R1): Verläufe in Markenfarben, je Platzhalter ein anderer
const RGB = { orange: [255, 78, 0], blau: [0, 159, 226], warmweiss: [251, 248, 243], blauschwarz: [15, 27, 38] };
const samples = [
  gradientPng(600, 400, RGB.orange, RGB.blau),
  gradientPng(600, 400, RGB.warmweiss, RGB.blauschwarz),
  gradientPng(600, 400, RGB.blau, RGB.warmweiss),
  gradientPng(600, 400, RGB.blauschwarz, RGB.orange),
  gradientPng(600, 400, RGB.blau, RGB.blauschwarz),
];
const SCALE = 4; // Golden verkleinert (270 × 337 bzw. 270 × 480 je Slide): erkennt Versatz ab wenigen px, bleibt klein
const FORMAT = { post: { label: 'Post 4:5', height: 1350 }, story: { label: 'Story 9:16', height: 1920 } } as const;
const ZONE = { top: 250, bottom: 1920 - 340 }; // tokens.safeZones.story

/** Mittelwert je SCALE × SCALE-Block, Slides nebeneinander. */
function shrink(slides: PNG[]): PNG {
  const w = Math.floor(slides[0]!.width / SCALE);
  const h = Math.floor(slides[0]!.height / SCALE);
  const out = new PNG({ width: w * slides.length, height: h });
  slides.forEach((s, k) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sum = [0, 0, 0];
        for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) for (let c = 0; c < 3; c++) sum[c]! += s.data[((y * SCALE + dy) * s.width + x * SCALE + dx) * 4 + c]!;
        const o = (y * out.width + k * w + x) * 4;
        out.data.set([...sum.map((v) => Math.round(v / SCALE ** 2)), 255], o);
      }
    }
  });
  return out;
}

const inside = (e: { x: number; y: number; width: number; height: number }, px: number, py: number) =>
  px >= e.x && px <= e.x + e.width && py >= e.y && py <= e.y + e.height;

for (const preset of presets) {
  const format = FORMAT[preset.format as keyof typeof FORMAT];
  test(`Golden Image «${preset.label}» ${format.label} mit Beispielfotos, mittlere Abweichung je Kanal höchstens 2 %`, async ({ page }) => {
    await newProject(page, format.label);
    // eine Slide mehr als das Layout: sie muss leer bleiben (nichts ragt über den Rand des Layouts)
    for (let i = 0; i < preset.slides; i++) await addSlide(page);
    await page.evaluate((p) => window.__bbzbTest.applyLayout(p, 0), preset);

    // Jeden Foto-Platzhalter füllen: Ablagepunkt, den kein höherer Foto-Platzhalter verdeckt
    const photos = (await elements(page)).filter((e) => e.type === 'photo');
    for (const [i, ph] of photos.entries()) {
      const above = photos.slice(i + 1);
      const points = [0.5, 0.15, 0.85].flatMap((fy) => [0.5, 0.15, 0.85].map((fx) => [ph.x + ph.width * fx, ph.y + ph.height * fy] as const));
      const [px, py] = points.find(([px, py]) => py < format.height - 10 && !above.some((a) => inside(a, px, py)))!;
      await dropPng(page, px, py, samples[i % samples.length]!);
      await expect.poll(async () => (await elements(page)).find((e) => e.id === ph.id)!.props).toHaveProperty('assetId');
    }
    expect(await elements(page)).toHaveLength(preset.elements.length); // jeder Drop füllte einen Platzhalter, kein freies Foto
    // Story: gemessene Texte und Tags liegen in der Sicherheitszone (die Datenprüfung schätzt die Texthöhe nur)
    if (preset.format === 'story')
      for (const e of (await elements(page)).filter((e) => e.type === 'text' || e.type === 'tag')) {
        expect(e.y, `${e.name} oben`).toBeGreaterThanOrEqual(ZONE.top);
        expect(e.y + e.height, `${e.name} unten`).toBeLessThanOrEqual(ZONE.bottom);
      }

    const all = await exportPng(page);
    expect(all).toHaveLength(preset.slides + 1);
    const next = all.pop()!;
    for (const [c, v] of mean(next).entries()) expect(Math.abs(v - RGB.warmweiss[c]!), 'Nachbarslide bleibt warmweiss').toBeLessThan(0.01);
    const slides = all;
    if (process.env.LAYOUT_OUT) {
      mkdirSync(process.env.LAYOUT_OUT, { recursive: true });
      slides.forEach((s, i) => writeFileSync(`${process.env.LAYOUT_OUT}/${preset.id}-${i + 1}.png`, PNG.sync.write(s)));
    }
    const got = shrink(slides);
    const golden = `${import.meta.dirname}/golden/layout-${preset.id}.png`;
    // Erzeugen (Ruling R1): UPDATE_GOLDEN=1 npx playwright test layout-presets
    if (process.env.UPDATE_GOLDEN) writeFileSync(golden, PNG.sync.write(got));
    meanDiff(got, PNG.sync.read(readFileSync(golden))).forEach((d) => expect(d / 255).toBeLessThanOrEqual(0.02));
  });
}
