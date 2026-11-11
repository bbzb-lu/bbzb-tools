import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addSlide, channelBtn, newProject, png, selectCta } from './fixtures';
import { addVideo, settled, twoTone } from './video';
import { noOpenExport } from './video-export';

const SHOTS = process.env.SHOTS; // Screenshots nur auf Wunsch
const PORTRAIT = `${import.meta.dirname}/fixtures/video/portrait-h264-aac.mp4`;
test.beforeAll(twoTone);

/** Slide 1 Foto, Slide 2 Video. */
async function mixed(page: Page, clip?: string) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1080, 1350));
  await addSlide(page);
  await addVideo(page, clip);
  await settled(page);
}
const open = async (page: Page) => {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  return page.getByRole('dialog');
};
const HINT = 'LinkedIn erlaubt keine Videos in einem Bildkarussell.';

test('Liste nennt Bild oder Video je Slide, Hinweis bei Video-Slide', async ({ page }) => {
  await mixed(page);
  const dialog = await open(page);
  await expect(dialog.getByRole('listitem')).toHaveText([/Slide 1\s*Bild/, /Slide 2\s*Video/]);
  await expect(dialog.getByText(HINT)).toBeVisible();
  await expect(dialog.getByText(/gilt nur für die Bild-Slides/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-7-dialog.png` });
});

for (const channel of ['Instagram', 'LinkedIn'] as const) {
  test(`Hinweis unabhängig vom Kanal (${channel}), nur mit Video`, async ({ page }) => {
    await newProject(page, 'Post 4:5', 'Carousel');
    await selectCta(page); // der Kanalschalter erscheint erst mit einem CTA
    await channelBtn(page, channel).click();
    await expect(channelBtn(page, channel)).toBeChecked();
    let dialog = await open(page);
    await expect(dialog.getByText(HINT)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Schliessen' }).click();
    await addVideo(page);
    dialog = await open(page);
    await expect(dialog.getByText(HINT)).toBeVisible();
  });
}

test('Liste und Hinweis bleiben aktuell, wenn sich das Dokument bei offenem Dialog ändert', async ({ page }) => {
  await mixed(page);
  const dialog = await open(page);
  await expect(dialog.getByText(HINT)).toBeVisible();
  await page.evaluate(() => window.__bbzbTest.selectIds([]));
  await page.evaluate(() => {
    const e = window.__bbzbTest.elements().find((x) => (x.props as { video?: unknown } | null)?.video)!;
    window.__bbzbTest.patch(e.id, { visible: false } as never);
  });
  await expect(dialog.getByRole('listitem')).toHaveText([/Slide 1\s*Bild/, /Slide 2\s*Bild/]);
  await expect(dialog.getByText(HINT)).toHaveCount(0);
});

test('Prozent im Fortschritt, Abbrechen stoppt ohne ZIP, danach geht ein Export', async ({ page }) => {
  test.setTimeout(90_000); // gedrosselter 10-s-Export braucht auf dem Windows-Runner über 30 s
  await mixed(page, PORTRAIT);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // 10-s-Clip: genug Zeit zum Abbrechen
  let downloads = 0;
  page.on('download', () => downloads++);
  const dialog = await open(page);
  const status = dialog.getByRole('status');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(status).toHaveText(/Slide 2 von 2, \d+ %/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-7-busy.png` });
  await expect(dialog.getByRole('button', { name: 'Schliessen' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Schliessen' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
  // alle drei Knöpfe in einer Zeile (kein Umbruch aus dem Bild)
  const ys = await Promise.all(['Abbrechen', 'Schliessen', 'ZIP herunterladen'].map(async (n) => (await dialog.getByRole('button', { name: n }).boundingBox())!.y));
  expect(new Set(ys).size).toBe(1);
  const box = (await dialog.boundingBox())!;
  for (const n of ['Abbrechen', 'Schliessen', 'ZIP herunterladen']) {
    const b = (await dialog.getByRole('button', { name: n }).boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width); // nicht aus dem Dialog herausgeschnitten
  }
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(status).toHaveText('Export abgebrochen.');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Schliessen' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ZIP herunterladen' })).toBeFocused();
  expect(downloads).toBe(0);
  await noOpenExport(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const download = page.waitForEvent('download', { timeout: 60_000 });
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await download;
  await expect(status).toBeEmpty();
});

for (const size of [{ width: 1280, height: 720 }, { width: 1536, height: 864 }]) {
  test(`${size.width} px: Kachel mit Video-Symbol und Namen «Video», Leiste einzeilig`, async ({ page }) => {
    await page.setViewportSize(size);
    await mixed(page);
    const tiles = page.getByRole('list', { name: 'Slides' }).getByRole('button');
    await expect(tiles.nth(1)).toHaveAccessibleName(/Slide 2, Video/);
    await expect(tiles.nth(0)).toHaveAccessibleName('Slide 1');
    await expect(tiles.nth(1).locator('svg.tile-video')).toBeVisible();
    await expect(tiles.nth(0).locator('svg')).toHaveCount(0);
    const [a, b] = [await tiles.nth(0).boundingBox(), await tiles.nth(1).boundingBox()];
    expect([b!.width, b!.height]).toEqual([a!.width, a!.height]); // das Symbol verändert die Kachel nicht
    expect(b!.y).toBe(a!.y); // eine Zeile
    const bar = (await page.locator('.slidebar').boundingBox())!;
    expect(bar.height).toBeLessThan(110);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (SHOTS) await page.locator('.slidebar').screenshot({ path: `${SHOTS}/task-7-bar-${size.width}.png` });
  });
}
