import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, newProject, openLayers, png, addSlide } from './fixtures';

const layers = (page: Page) => page.getByRole('list', { name: 'Ebenen' });
const row = (page: Page, name: string) => layers(page).getByRole('listitem').filter({ has: page.getByRole('button', { name, exact: true }) });
const names = (page: Page) => layers(page).getByRole('listitem').locator('.layer-name').allTextContents();
const orderNames = async (page: Page) => (await elements(page)).map((e) => e.name);

async function withTexts(page: Page, n: number) {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(n);
  await openLayers(page);
}

test('Ebenen-Reiter: oberstes Element zuerst', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await openLayers(page);
  await expect(layers(page)).toBeVisible();
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  expect(await names(page)).toEqual((await orderNames(page)).reverse());
});

test('Umbenennen per Doppelklick: Enter speichert, Escape und leerer Name verwerfen', async ({ page }) => {
  await withTexts(page, 1);
  const old = (await elements(page))[0]!.name;
  const el = (await elements(page))[0]!;
  await row(page, old).getByRole('button', { name: old, exact: true }).dblclick();
  const input = page.getByRole('textbox', { name: 'Name der Ebene' });
  await input.fill('Titel oben');
  await input.press('Escape');
  expect((await elements(page))[0]!.name).toBe(old);
  await row(page, old).getByRole('button', { name: old, exact: true }).dblclick();
  await input.fill('   ');
  await input.press('Enter');
  expect((await elements(page))[0]!.name).toBe(old);
  await row(page, old).getByRole('button', { name: old, exact: true }).dblclick();
  await input.fill('  Titel oben  ');
  await input.press('Enter');
  await expect.poll(async () => (await elements(page))[0]!.name).toBe('Titel oben');
  await expect(row(page, 'Titel oben')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.name).toBe(old);
  expect((await elements(page))[0]!.id).toBe(el.id);
});

test('Ausblenden nimmt das Element aus der Ebene «content», Zeile bleibt wählbar', async ({ page }) => {
  await withTexts(page, 2);
  const [a, b] = await elements(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds())).toContain(a!.id);
  const r = row(page, a!.name);
  await r.getByRole('button', { name: 'Ausblenden' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds())).not.toContain(a!.id);
  expect(await page.evaluate(() => window.__bbzbTest.contentIds())).toContain(b!.id);
  await expect(r.getByRole('button', { name: 'Einblenden' })).toHaveAttribute('aria-pressed', 'true');
  // Wählen: Inspector zeigt das ausgeblendete Element
  await r.getByRole('button', { name: a!.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: a!.name })).toBeVisible();
  await expect(r.getByRole('button', { name: a!.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await r.getByRole('button', { name: 'Einblenden' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds())).toContain(a!.id);
});

test('Gesperrtes Element lässt sich in der Liste wählen und entsperren', async ({ page }) => {
  await withTexts(page, 1);
  const a = (await elements(page))[0]!;
  const r = row(page, a.name);
  await r.getByRole('button', { name: 'Sperren' }).click();
  await expect.poll(async () => (await elements(page))[0]!.locked).toBe(true);
  await page.keyboard.press('Escape');
  await r.getByRole('button', { name: a.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: a.name })).toBeVisible();
  await r.getByRole('button', { name: 'Entsperren' }).click();
  await expect.poll(async () => (await elements(page))[0]!.locked).toBe(false);
});

test('Umordnen per Alt + Pfeil und per Ziehen ändert order', async ({ page }) => {
  await withTexts(page, 3);
  const [a, b, c] = await orderNames(page); // a unten, c oben
  await expect.poll(() => names(page)).toEqual([c, b, a]);
  const btn = (n: string) => row(page, n!).getByRole('button', { name: n!, exact: true });
  await btn(a!).focus();
  await page.keyboard.press('Alt+ArrowUp'); // a eine Stufe nach oben: b a c
  await expect.poll(() => orderNames(page)).toEqual([b, a, c]);
  await expect(btn(a!)).toBeFocused();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => orderNames(page)).toEqual([a, b, c]);
  await page.keyboard.press('Alt+ArrowDown'); // schon ganz unten: nichts
  expect(await orderNames(page)).toEqual([a, b, c]);
  // Ziehen: c (oben in der Liste) auf a (unten in der Liste), landet darunter
  await btn(c!).dragTo(btn(a!));
  await expect.poll(() => orderNames(page)).toEqual([c, a, b]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => orderNames(page)).toEqual([a, b, c]);
});

test('Element der Nachbar-Slide, das hineinragt, erscheint in der Liste', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await openLayers(page);
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const id = (await elements(page))[0]!.id;
  await page.evaluate((i) => window.__bbzbTest.patch(i, { x: 300 }), id);
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(300);
  const name = (await elements(page))[0]!.name;
  await addSlide(page);
  await addSlide(page);
  await page.getByRole('button', { name: 'Slide 2', exact: true }).click();
  await expect(row(page, name)).toBeVisible();
  await page.getByRole('button', { name: 'Slide 3', exact: true }).click();
  await expect(layers(page).getByRole('listitem')).toHaveCount(0);
});

test('Gesperrte und ausgeblendete Elemente: gewählt, aber kein Transformer', async ({ page }) => {
  await withTexts(page, 3);
  const [a, b, c] = await orderNames(page);
  const pick = (n: string) => row(page, n!).getByRole('button', { name: n!, exact: true }).click();
  await pick(c!);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  await row(page, a!).getByRole('button', { name: 'Sperren' }).click();
  await row(page, b!).getByRole('button', { name: 'Ausblenden' }).click();
  await pick(a!);
  await expect(page.getByRole('heading', { name: a! })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(0);
  await pick(c!);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  await pick(b!);
  await expect(page.getByRole('heading', { name: b! })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(0);
});

test('Alt + Pfeil nach oben in der obersten Zeile ändert nichts, Ziehen nach oben landet darüber', async ({ page }) => {
  await withTexts(page, 3);
  const [a, b, c] = await orderNames(page); // Liste: c b a
  const btn = (n: string) => row(page, n!).getByRole('button', { name: n!, exact: true });
  await btn(c!).focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await orderNames(page)).toEqual([a, b, c]);
  await expect(btn(c!)).toBeFocused();
  await btn(a!).dragTo(btn(c!)); // a von ganz unten auf die oberste Zeile: a liegt über c
  await expect.poll(() => orderNames(page)).toEqual([b, c, a]);
});

test('Zustandswechsel ohne Überblendung: nie dunkle Schrift auf dunklem Grund', async ({ page }) => {
  await withTexts(page, 2);
  const look = (sel: string) => page.locator(sel).first().evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
  const dark = 'rgb(35, 35, 35)'; // Tinte (theme.ink)
  // obere Zeile ausgewählt, Klick auf die untere: die obere wird sofort hell
  await page.locator('.layer-name').nth(1).click();
  expect(await look('.layer-name')).not.toEqual([dark, dark]);
  // gedrückter Schalter (Schloss) wird gelöst: sofort helle Fläche
  const lock = page.locator('.layer').first().getByRole('button', { name: 'Sperren' });
  await lock.click();
  await page.locator('.layer').first().getByRole('button', { name: 'Entsperren' }).click();
  const [color, bg] = await lock.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
  expect(color).toBe(dark);
  expect(bg).not.toBe(dark);
});

test('Strg- und Shift-Klick auf Zeilen schaltet um, gewöhnlicher Klick wählt eine, Ziehen bewegt nur die gezogene', async ({ page }) => {
  await withTexts(page, 3);
  const [a, b, c] = (await elements(page)).map((e) => e.name);
  const btn = (n: string) => row(page, n).getByRole('button', { name: n, exact: true });
  const marked = page.locator('.layer-name[aria-pressed="true"]');
  await btn(a!).click();
  await expect(marked).toHaveCount(1);
  await btn(b!).click({ modifiers: ['ControlOrMeta'] });
  await btn(c!).click({ modifiers: ['Shift'] });
  await expect(marked).toHaveCount(3);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-phase-2-10-bedienung/screens/task-7-layers.png' });
  await btn(b!).click({ modifiers: ['ControlOrMeta'] });
  await expect(marked).toHaveCount(2);
  await expect(btn(b!)).toHaveAttribute('aria-pressed', 'false');
  // gesperrte Ebene lässt sich trotzdem zur Auswahl ergänzen (zum Entsperren)
  await row(page, b!).getByRole('button', { name: 'Sperren' }).click();
  await btn(b!).click({ modifiers: ['ControlOrMeta'] });
  await expect(marked).toHaveCount(3);
  await btn(c!).click();
  await expect(marked).toHaveCount(1);
  await expect(btn(c!)).toHaveAttribute('aria-pressed', 'true');
  // Ziehen: bei Mehrfachauswahl wandert nur die gezogene Zeile
  await btn(a!).click();
  await btn(b!).click({ modifiers: ['ControlOrMeta'] });
  await btn(a!).dragTo(btn(c!));
  await expect.poll(async () => (await orderNames(page)).indexOf(a!)).toBe(2);
  expect((await orderNames(page)).slice(0, 2)).toEqual([b, c]);
});
