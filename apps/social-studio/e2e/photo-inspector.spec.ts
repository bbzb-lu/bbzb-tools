import { expect, test, type Page } from '@playwright/test';
import { effectRemove, elements, exportPng, newProject, openSection, toScreen, view } from './fixtures';
import { alphaPng, maskPng, photoProject, type Box } from './photoProject';
import { addVideo } from './video';

/** Foto-Inspector seit 4c Task 11: Abschnitte zu (ausser «Ebene»), Spiegeln senkrecht, «Erweitert», Effekte über «+», Zustände der Maske. */

const BOX: Box = { x: 140, y: 275, width: 800, height: 800 };
const panel = (page: Page) => page.getByLabel('Eigenschaften');
const button = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true });
const props = async (page: Page) => (await elements(page))[0]!.props as Record<string, unknown>;
const SHOTS = process.env.SHOTS; // Screenshots nur auf Wunsch (SHOTS=Ordner)

/** Projekt öffnen und das Foto per Klick wählen; die Abschnitte bleiben, wie sie starten. */
async function open(page: Page, name: string, extra: Record<string, unknown> = {}, mask?: Buffer) {
  await page.goto('');
  const asset = alphaPng(1000, 1000, [15, 27, 38], () => 255);
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: photoProject(name, BOX, extra, asset, mask) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page);
  const c = await toScreen(page, 540, 675);
  await expect.poll(() => page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [c.x, c.y])).toBe('e0');
  await page.mouse.click(c.x, c.y);
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Foto');
}

test('Abschnitte: «Ebene» und Darstellung offen, Bild, Maske und Effekte zu; Inhalt zu ist nicht tabbar', async ({ page }) => {
  await open(page, 'Start');
  await expect(button(page, 'Ebene')).toHaveAttribute('aria-expanded', 'true');
  await expect(button(page, 'Darstellung')).toHaveAttribute('aria-expanded', 'true');
  for (const n of ['Bild', 'Maske', 'Effekte']) await expect(button(page, n)).toHaveAttribute('aria-expanded', 'false');
  await expect(button(page, 'BBZB-Look')).toBeHidden();
  await openSection(page, 'Bild');
  await expect(button(page, 'BBZB-Look')).toBeVisible();
  await expect(button(page, 'Erweitert')).toHaveAttribute('aria-expanded', 'false');
  await expect(panel(page).getByRole('slider', { name: 'Helligkeit' })).toBeHidden();
});

test('Senkrecht spiegeln: Schalter setzt flipY, ein Undo-Schritt, unabhängig von waagrecht', async ({ page }) => {
  await open(page, 'Kopf');
  await openSection(page, 'Bild');
  const v = button(page, 'Senkrecht spiegeln');
  await expect(v).toHaveAttribute('aria-pressed', 'false');
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  await v.click();
  await expect(v).toHaveAttribute('aria-pressed', 'true');
  expect(await props(page)).toMatchObject({ flipY: true });
  expect(await props(page)).not.toHaveProperty('flipX');
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(h0 + 1);
  await page.keyboard.press('Control+z');
  await expect(v).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await props(page)).flipY ?? false).toBe(false);
});

test('«Erweitert»: Regler mit Nullstelle in der Mitte, Tastatur ein Undo-Schritt, Zurücksetzen holt alles auf 0', async ({ page }) => {
  await open(page, 'Regler');
  await openSection(page, 'Bild');
  const reset = button(page, 'Bildregler zurücksetzen');
  await expect(reset).toHaveAttribute('aria-disabled', 'true'); // sichtbar in der Kopfzeile, auch zugeklappt
  await openSection(page, 'Erweitert');
  const hell = panel(page).getByRole('slider', { name: 'Helligkeit' });
  await expect(hell).toHaveValue('0');
  // Beschriftung an beiden Enden, die Füllung beginnt in der Mitte
  await expect(panel(page).locator('.slider-center', { has: page.getByRole('slider', { name: 'Helligkeit' }) }).locator('.slider-ends')).toHaveText('dunkelhell');
  await hell.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await expect(hell).toHaveAttribute('aria-valuetext', '−3');
  await expect.poll(async () => (await props(page)).adjust).toMatchObject({ brightness: -3 });
  await panel(page).getByRole('slider', { name: 'Wärme' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await props(page)).adjust).toEqual({ brightness: -3, contrast: 0, saturation: 0, warmth: 1 });
  await expect(reset).toHaveAttribute('aria-disabled', 'false');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-erweitert.png` });
  await reset.click();
  await expect.poll(async () => await props(page)).not.toHaveProperty('adjust');
  for (const name of ['Helligkeit', 'Kontrast', 'Sättigung', 'Wärme']) await expect(panel(page).getByRole('slider', { name })).toHaveValue('0');
  await expect(reset).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Control+z'); // Zurücksetzen ist ein Schritt
  await expect.poll(async () => (await props(page)).adjust).toEqual({ brightness: -3, contrast: 0, saturation: 0, warmth: 1 });
});

test('Altprojekt mit Bildreglern und Verlauf mit Reichweite: Werte unter «Erweitert» und im Verlauf, Export unverändert', async ({ page }) => {
  const extra = { adjust: { brightness: 12, contrast: -8, saturation: 20, warmth: -30 }, scrim: { side: 'unten', strength: 'stark', reach: 30 } };
  await open(page, 'Alt', extra);
  const [before] = await exportPng(page);
  await openSection(page, 'Bild');
  await openSection(page, 'Erweitert');
  for (const [name, v] of [['Helligkeit', '12'], ['Kontrast', '-8'], ['Sättigung', '20'], ['Wärme', '-30']] as const) await expect(panel(page).getByRole('slider', { name })).toHaveValue(v);
  await openSection(page, 'Effekte');
  await openSection(page, 'Verlauf Unten');
  await expect(panel(page).getByRole('slider', { name: 'Reichweite' })).toHaveValue('30');
  expect(await props(page)).toMatchObject(extra); // nur angezeigt, nichts umgeschrieben
  const [after] = await exportPng(page);
  expect(after!.data.equals(before!.data)).toBe(true);
});

test('Effekte: «+» legt Rahmen, Korn und Verlauf an, je aufgeklappt; Rahmen und Korn danach mit Haken', async ({ page }) => {
  await open(page, 'Effekte');
  await button(page, 'Effekt hinzufügen').click();
  const menu = page.getByRole('menu', { name: 'Effekt hinzufügen' });
  await expect(menu.getByRole('menuitem')).toHaveText([/^Rahmen/, /^Korn/, /^Verlauf/]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-effekte-menue.png` });
  await menu.getByRole('menuitem', { name: /^Rahmen/ }).click();
  await expect.poll(() => props(page)).toMatchObject({ frame: true, frameOutside: true });
  await expect(button(page, 'Effekte')).toHaveAttribute('aria-expanded', 'true');
  for (const [name, check] of [['Korn', { grain: true }], ['Verlauf', { scrims: [{ side: 'unten', strength: 'mittel' }] }]] as const) {
    await button(page, 'Effekt hinzufügen').click();
    await menu.getByRole('menuitem', { name: new RegExp(`^${name}`) }).click();
    await expect.poll(() => props(page)).toMatchObject(check);
  }
  for (const n of ['Rahmen', 'Korn', 'Verlauf Unten']) await expect(effectRemove(page, n)).toBeVisible();
  await button(page, 'Effekt hinzufügen').click();
  for (const n of ['Rahmen', 'Korn']) await expect(menu.getByRole('menuitem', { name: new RegExp(`^${n}`) })).toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByRole('menuitem', { name: /^Verlauf/ })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByRole('menuitem', { name: /^Verlauf/ })).toBeFocused(); // erster freier Eintrag
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Foto'); // Esc schliesst nur das Menü
  await effectRemove(page, 'Korn').click();
  await expect.poll(() => props(page)).toMatchObject({ grain: false });
});

test('Maske: ohne Maske Grund sichtbar, Pinsel erst nach dem Klick, KI läuft: «Abbrechen» an Stelle des Hauptknopfs', async ({ page }) => {
  await open(page, 'Maske');
  await openSection(page, 'Maske');
  const reason = panel(page).locator('.hint.reason');
  await expect(reason).toHaveText('Erst Hintergrund entfernen');
  for (const n of ['Als Sticker kopieren', 'Motiv vor Titel', 'Maske zurücksetzen']) await expect(button(page, n)).toHaveAttribute('aria-disabled', 'true');
  await expect(panel(page).getByRole('radio', { name: 'Ausblenden', exact: true })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-maske-ruhe.png` });
  await button(page, 'Maske bearbeiten').click();
  await expect(button(page, 'Maske bearbeiten')).toHaveAttribute('aria-pressed', 'true');
  for (const n of ['Ausblenden', 'Einblenden', 'Rote Folie', 'Ergebnis']) await expect(panel(page).getByRole('radio', { name: n, exact: true })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-maske-pinsel.png` });
  await page.keyboard.press('Escape');
  await expect(panel(page).getByRole('radio', { name: 'Ausblenden', exact: true })).toHaveCount(0);

  await page.evaluate(() => window.__bbzbTest.fakeCutout('kreis', 30000));
  const main = button(page, 'Hintergrund entfernen');
  const box = (await main.boundingBox())!;
  await main.click();
  const cancel = button(page, 'Abbrechen');
  await expect(cancel).toBeFocused();
  await expect(main).toHaveCount(0);
  const at = (await cancel.boundingBox())!;
  expect(Math.abs(at.y - box.y)).toBeLessThan(80); // an derselben Stelle (die Statuszeile steht darüber)
  expect(at.height).toBe(box.height);
  await expect(reason).toHaveText('Die Freistellung läuft noch');
  for (const n of ['Als Sticker kopieren', 'Motiv vor Titel', 'Maske bearbeiten', 'Maske umkehren', 'Maske zurücksetzen', 'Maske weich zeichnen'])
    await expect(button(page, n)).toHaveAttribute('aria-disabled', 'true');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-maske-ki.png` });
  await cancel.click();
  await expect(main).toBeVisible();
});

test('Mit Maske: Sticker, Motiv vor Titel (ohne Titel mit Grund) und Zurücksetzen frei', async ({ page }) => {
  await open(page, 'Mit', {}, maskPng(1000, 1000, (x) => (x < 500 ? 0 : 255)));
  await openSection(page, 'Maske');
  for (const n of ['Als Sticker kopieren', 'Maske zurücksetzen', 'Maske umkehren']) await expect(button(page, n)).toHaveAttribute('aria-disabled', 'false');
  await expect(button(page, 'Motiv vor Titel')).toHaveAttribute('aria-disabled', 'true');
  await expect(panel(page).locator('.hint.reason')).toHaveText('Auf dieser Slide fehlt ein Titel');
});

test('Screens: Foto-Inspector mit allen Abschnitten bei 1536 × 864 und 1280 × 720', async ({ page }) => {
  for (const [w, h] of [[1536, 864], [1280, 720]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, `Alles${w}`, { scrims: [{ side: 'unten', strength: 'mittel' }], grain: true, frame: true, frameOutside: true });
    await page.locator('.inspector').evaluate((root) => {
      for (let n = 0; n < 5; n++) root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="false"]').forEach((b) => b.click());
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-foto-${w}.png` });
    await page.locator('.inspector').evaluate((e) => e.scrollTo(0, e.scrollHeight));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-foto-${w}-unten.png` });
  }
});

test('Video: Abschnitt «Video» mit Vorschaubildern, Länge, Bereichsregler, Feldern, Vorschau und Ton; kein Spiegeln, keine Maske', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page); // klappt alle Abschnitte auf
  const vid = async () => ((await elements(page))[0]!.props as { video: { start: number; end: number } }).video;
  const v0 = await vid();
  await expect(panel(page).getByText(`Ausschnitt: ${(v0.end - v0.start).toFixed(1)} s`)).toBeVisible();
  const start = panel(page).getByRole('slider', { name: 'Start', exact: true });
  await expect(start).toHaveAttribute('aria-valuetext', '0.0 Sekunden');
  await start.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await vid()).start).toBeCloseTo(0.1, 5);
  await expect(panel(page).getByText(`Ausschnitt: ${(v0.end - 0.1).toFixed(1)} s`)).toBeVisible();
  for (const n of ['Vorschau', 'Ton']) await expect(button(page, n)).toBeVisible();
  await expect(button(page, 'Ton')).toHaveAttribute('aria-pressed', 'false');
  for (const n of ['Waagrecht spiegeln', 'Senkrecht spiegeln', 'Maske', 'Erweitert']) await expect(button(page, n)).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-11-video.png` });
});
