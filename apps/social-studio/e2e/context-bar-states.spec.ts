import { expect, test, type Page } from '@playwright/test';
import { live, markLive, only, openReviewProject, sameLive, select, shot } from './contextBar';
import { elements, frames, openSection, toScreen } from './fixtures';
import { addVideo } from './video';

// Echte Bildlaufleisten wie unter Windows (Playwright blendet sie sonst aus)
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }, viewport: { width: 1280, height: 720 } });

const fake = (page: Page, ms: number) => page.evaluate((t) => window.__bbzbTest.fakeCutout('kreis', t), ms);
const ai = (page: Page) => page.evaluate(() => window.__bbzbTest.ui().ai);

async function addText(page: Page) {
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(async () => (await elements(page)).some((e) => e.type === 'text')).toBe(true);
  const t = (await elements(page)).find((e) => e.type === 'text')!;
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 100, y: 900 }), t.id);
  await page.keyboard.press('Escape');
  return t.id;
}
async function editText(page: Page, id: string) {
  const t = (await elements(page)).find((e) => e.id === id)!;
  await frames(page);
  const c = await toScreen(page, t.x + 20, t.y + t.height / 2);
  await page.mouse.dblclick(c.x, c.y);
  await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toBeFocused();
}
async function startAi(page: Page, id = 'e0') {
  await fake(page, 30000);
  await select(page, id);
  await openSection(page, 'Maske');
  await page.getByRole('button', { name: 'Hintergrund entfernen', exact: true }).click();
  await expect.poll(() => ai(page)).toBeTruthy();
}

test('Mehrfachauswahl: «2 Elemente» mit Duplizieren, an gleicher Stelle, Nach vorne, Nach hinten, Löschen; verschwindet mit der Auswahl', async ({ page }) => {
  await openReviewProject(page, 'Mehrfach', false);
  await expect(page.locator('.context-bar')).toHaveCount(0);
  await select(page, 'e0', 'e1');
  await only(page, '2 Elemente');
  const bar = page.getByRole('group', { name: '2 Elemente' });
  for (const n of ['Duplizieren', 'An gleicher Stelle duplizieren', 'Nach vorne', 'Nach hinten', 'Löschen']) await expect(bar.getByRole('button', { name: n, exact: true })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Löschen', exact: true })).toHaveText('Löschen');
  expect(await bar.evaluate((e) => e.contains(document.activeElement))).toBe(false); // nimmt keinen Fokus
  await shot(page, 'task-B-mehrfach');
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  await bar.getByRole('button', { name: 'An gleicher Stelle duplizieren', exact: true }).click();
  await expect.poll(() => elements(page)).toHaveLength(4);
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(h0 + 1);
  const els = await elements(page);
  const copies = await page.evaluate(() => window.__bbzbTest.ui().selectedIds);
  expect(copies.map((id) => els.find((e) => e.id === id)!).map((e) => [e.x, e.y]).sort()).toEqual([[100, 100], [580, 100]]); // Kopien deckungsgleich, gewählt
  await only(page, '2 Elemente');
  await select(page);
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('KI läuft: Leiste mit Status, Balken und «Abbrechen», auch wenn etwas anderes gewählt ist; Abbrechen stoppt die KI', async ({ page }) => {
  await openReviewProject(page, 'KI', false);
  // eine Live-Region, schon vor dem Lauf im DOM (sonst ginge die erste Ansage verloren), nicht in Leiste und Inspector doppelt
  await expect(live(page)).toHaveText('');
  await expect(live(page)).toHaveAttribute('role', 'status');
  await markLive(page);
  await startAi(page);
  const bar = page.getByRole('group', { name: 'Freistellen' });
  await only(page, 'Freistellen');
  await expect(live(page)).toHaveText(/^Modell wird geladen, einmalig ca\. \d+ MB$/);
  await sameLive(page);
  await expect(page.getByRole('status').filter({ hasText: 'Modell wird geladen' })).toHaveCount(1);
  await expect(bar.locator('.context-bar-progress')).toBeVisible();
  await select(page, 'e1');
  await only(page, 'Freistellen');
  await select(page);
  await only(page, 'Freistellen');
  await shot(page, 'task-B-ki');
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  await bar.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect.poll(() => ai(page)).toBeUndefined();
  await expect(page.locator('.context-bar')).toHaveCount(0);
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(h0);
  expect(((await elements(page))[0]!.props as { mask?: string }).mask).toBeUndefined();
});

test('Text bearbeiten: Leiste «Text» mit «Strg + Enter übernimmt, Esc verwirft»; «Fertig» übernimmt wie ein Klick daneben', async ({ page }) => {
  await openReviewProject(page, 'Text', false);
  const t = await addText(page);
  await editText(page, t);
  await only(page, 'Text');
  const bar = page.getByRole('group', { name: 'Text' });
  await expect(bar).toContainText('Strg + Enter übernimmt, Esc verwirft');
  await shot(page, 'task-B-text');
  await page.keyboard.type('Hallo Leiste');
  await bar.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toHaveCount(0);
  await expect.poll(async () => ((await elements(page)).find((e) => e.id === t)!.props as { text: string }).text).toBe('Hallo Leiste');
  await expect(page.locator('.context-bar')).toHaveCount(0);
  await editText(page, t);
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('Video: Vorschau, Ton und Dauer des Ausschnitts wie im Inspector, Hinweis über 60 s', async ({ page }) => {
  await openReviewProject(page, 'Video', false);
  const id = await addVideo(page);
  await only(page, 'Video');
  const bar = page.getByRole('group', { name: 'Video' });
  await expect(bar).toContainText('4,0 s');
  await expect(bar).not.toContainText('60 s');
  const sound = bar.getByRole('button', { name: 'Ton', exact: true });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect.poll(async () => ((await elements(page)).find((e) => e.id === id)!.props as { video: { sound: boolean } }).video.sound).toBe(true);
  await expect(page.getByLabel('Eigenschaften').getByRole('button', { name: 'Ton', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await bar.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Stopp', exact: true })).toBeVisible();
  await expect(page.getByLabel('Eigenschaften').getByRole('button', { name: 'Stopp', exact: true })).toBeVisible();
  await shot(page, 'task-B-video');
  await bar.getByRole('button', { name: 'Stopp', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.preview().open)).toBe(0);
  await page.evaluate((id) => {
    const props = window.__bbzbTest.elements().find((e) => e.id === id)!.props as { video: object };
    window.__bbzbTest.patch(id, { props: { ...props, video: { ...props.video, start: 0, end: 72.4, duration: 90 } } } as never);
  }, id);
  await expect(bar).toContainText('72,4 s');
  await expect(bar).toContainText('Der Export kürzt auf 60 s');
  await select(page);
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('Vorrang: Ausschnitt, Maske, Text, KI, Mehrfachauswahl, Video, Bitte prüfen, Rückgängig; immer höchstens eine Leiste', async ({ page }) => {
  await openReviewProject(page, 'Vorrang');
  await only(page, 'Bitte prüfen');
  const t = await addText(page);
  // Rückgängig-Hinweis nach dem Löschen, aber «Bitte prüfen» gewinnt
  await select(page, t);
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  await only(page, 'Bitte prüfen');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page)).length).toBe(3);
  await select(page, 'e0');
  await only(page, 'Bitte prüfen'); // ein Foto allein hat keine eigene Leiste
  await select(page, 'e0', 'e1');
  await only(page, '2 Elemente'); // Mehrfachauswahl vor «Bitte prüfen»
  const vid = await addVideo(page);
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 580, y: 560, width: 320, height: 300 }), vid); // nicht über dem Text
  await only(page, 'Video'); // Video vor «Bitte prüfen»
  await select(page, vid, t);
  await only(page, '2 Elemente'); // Mehrfachauswahl vor Video
  await select(page, vid);
  await editText(page, t);
  await only(page, 'Text'); // Text vor Video
  await page.keyboard.press('Escape');
  await startAi(page, 'e0');
  await only(page, 'Freistellen');
  await select(page, 'e0', 'e1');
  await only(page, 'Freistellen'); // KI vor Mehrfachauswahl
  await select(page, vid);
  await only(page, 'Freistellen'); // KI vor Video
  await editText(page, t);
  await only(page, 'Text'); // Text vor KI
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__bbzbTest.setMaskEdit('e1'));
  await only(page, 'Maske'); // Maske vor KI
  await page.keyboard.press('Escape');
  await select(page, 'e1');
  await openSection(page, 'Bild');
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await only(page, 'Ausschnitt'); // Ausschnitt vor KI
  await page.keyboard.press('Escape');
  await only(page, 'Freistellen');
  await page.getByRole('group', { name: 'Freistellen' }).getByRole('button', { name: 'Abbrechen' }).click();
  await expect.poll(() => ai(page)).toBeUndefined();
  await select(page);
  await only(page, 'Bitte prüfen');
});

test('Bitte prüfen: Hinweis und «Geprüft» (ein Undo-Schritt), dann keine Leiste mehr', async ({ page }) => {
  await openReviewProject(page, 'Prüfen');
  const bar = page.getByRole('group', { name: 'Bitte prüfen' });
  await expect(bar).toContainText('Diese Slide kommt aus dem anderen Format, bitte prüfen');
  await expect(bar.getByRole('button', { name: 'Geprüft' })).toHaveClass(/primary/);
  await shot(page, 'task-B-pruefen');
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  await bar.getByRole('button', { name: 'Geprüft' }).click();
  await expect(page.locator('.context-bar')).toHaveCount(0);
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(h0 + 1);
  expect(await page.evaluate(() => window.__bbzbTest.project().slides[0]!.review)).toBeUndefined();
  await page.keyboard.press('Control+z');
  await only(page, 'Bitte prüfen');
});
