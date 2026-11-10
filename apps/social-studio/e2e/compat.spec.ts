import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { effectRemove, elements, exportPng, meanDiff, openAllSections, openLayers, view } from './fixtures';

// Mit dem Code von Phase 1.2 über «Projektdatei sichern» erzeugt (Foto, Titel, Kommentar). Nie neu erzeugen.
const phase12 = readFileSync(`${import.meta.dirname}/fixtures/phase-1-2.bbzbsocial`);

test('Projektdatei aus Phase 1.2 öffnet ohne Fehler, alle Elemente sind da', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'phase-1-2.bbzbsocial', mimeType: 'application/zip', buffer: phase12 });
  await page.getByRole('button', { name: '«Phase 1.2» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Phase 1.2');
  await expect.poll(() => elements(page)).toMatchObject([
    { type: 'photo', x: 0, y: 315, width: 1080, height: 720 },
    { type: 'text', props: { text: 'Sporttag 2026', style: 'titel', fontSize: 150 } },
    { type: 'text', props: { text: 'Kunst und Lust', style: 'kommentar', fontSize: 62 } },
  ]);
  await view(page); // wartet auf die Stage
  const ids = (await elements(page)).map((e) => e.id);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds())).toEqual(expect.arrayContaining(ids));
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Text aus Phase 1.2 hat Zeilenabstand und Laufweite des Stils', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'phase-1-2.bbzbsocial', mimeType: 'application/zip', buffer: phase12 });
  await page.getByRole('button', { name: '«Phase 1.2» öffnen', exact: true }).click();
  await view(page);
  const texts = (await elements(page)).filter((e) => e.type === 'text');
  expect(texts.map((e) => e.props)).toEqual([
    expect.not.objectContaining({ lineHeight: expect.anything(), tracking: expect.anything() }),
    expect.not.objectContaining({ lineHeight: expect.anything(), tracking: expect.anything() }),
  ]);
  // gezeichnet mit den Stilwerten (Titel 0.86 / −40, Kommentar 76/66 / −10, in 1/1000 em)
  const drawn = await page.evaluate((ids) => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    return ids.map((id) => {
      const t = k.stages[0]!.findOne<import('konva').default.Group>(`#${id}`)!.findOne<import('konva').default.Text>('Text')!;
      return { lh: t.lineHeight(), em: t.letterSpacing() / t.fontSize() };
    });
  }, texts.map((e) => e.id));
  expect(drawn[0]!.lh).toBeCloseTo(0.86);
  expect(drawn[0]!.em).toBeCloseTo(-0.04);
  expect(drawn[1]!.lh).toBeCloseTo(76 / 66);
  expect(drawn[1]!.em).toBeCloseTo(-0.01);
  // Zeilenabstand und Laufweite stehen auf dem Stilwert
  await openLayers(page);
  await page.getByRole('list', { name: 'Ebenen' }).getByRole('button', { name: 'Text 2', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Zeilenabstand' })).toHaveValue('100');
  await expect(page.getByRole('slider', { name: 'Laufweite' })).toHaveAttribute('aria-valuetext', '−10');
  // Foto aus Phase 1.2 hat kein Korn: sieht aus wie vorher
  await page.getByRole('list', { name: 'Ebenen' }).getByRole('button', { name: 'Foto 1', exact: true }).click();
  await openAllSections(page);
  await expect(effectRemove(page, 'Korn')).toHaveCount(0);
  expect((await elements(page))[0]!.props).not.toHaveProperty('grain');
  // ohne Look, Regler neutral, nicht gespiegelt: kein Filter läuft (Task 8)
  await expect(page.getByRole('button', { name: 'BBZB-Look', exact: true })).toHaveAttribute('aria-pressed', 'false');
  for (const name of ['Waagrecht spiegeln', 'Senkrecht spiegeln']) await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
  for (const name of ['Helligkeit', 'Kontrast', 'Sättigung', 'Wärme']) await expect(page.getByRole('slider', { name })).toHaveValue('0');
  for (const key of ['look', 'adjust', 'flipX', 'flipY']) expect((await elements(page))[0]!.props).not.toHaveProperty(key);
  expect(await page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
});

// Export der Fixture mit dem Code von Phase 1.2 (Stand 8e3b3a1, vor allen 2a-Änderungen). Nie neu erzeugen.
const golden12 = PNG.sync.read(readFileSync(`${import.meta.dirname}/golden/phase-1-2.png`));

test('Phase 1.2 sieht gleich aus wie vorher; sichern und wieder öffnen behält alles', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'phase-1-2.bbzbsocial', mimeType: 'application/zip', buffer: phase12 });
  await page.getByRole('button', { name: '«Phase 1.2» öffnen', exact: true }).click();
  await view(page);
  const [first] = await exportPng(page);
  expect([first!.width, first!.height]).toEqual([1080, 1350]);
  expect(Math.max(...meanDiff(first!, golden12))).toBeLessThan(0.1);

  const before = await elements(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
  const file = await readFile(await (await download).path());
  await page.getByLabel('Projektname').fill('Original');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'wieder.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await page.getByRole('listitem').filter({ hasText: 'Phase 1.2' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Phase 1.2');
  // keine neuen Felder beim Sichern hineingeschrieben: altes Projekt bleibt ein altes Projekt
  expect(await elements(page)).toEqual(before);
  const [again] = await exportPng(page);
  expect(Math.max(...meanDiff(again!, golden12))).toBeLessThan(0.1);
});
