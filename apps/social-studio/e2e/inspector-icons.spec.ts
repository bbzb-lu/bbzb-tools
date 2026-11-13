import { expect, test, type Page } from '@playwright/test';
import { addEffect, openAllSections, openSlideLayouts, addPhoto, addScrim, elements, frames, newProject, openLayers, png, openSection } from './fixtures';

// Screenshots nur auf Wunsch (SHOTS=Ordner)
const SHOTS = process.env.SHOTS;
const shot = (page: Page, name: string) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}` }) : undefined);
const panel = (page: Page) => page.getByLabel('Eigenschaften');
const button = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true });
const tip = (page: Page) => page.locator('.tooltip');

async function photoSelected(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await openAllSections(page);
}

test('Foto: Namen bleiben, Löschen mit Icon und Wort, Aktionsreihe in einer Zeile, Schalter bleiben aria-pressed', async ({ page }) => {
  await photoSelected(page);
  await openSection(page, 'Ebene');
  for (const n of ['Duplizieren', 'An gleicher Stelle duplizieren', 'Nach vorne', 'Nach hinten', 'Waagrecht spiegeln', 'Senkrecht spiegeln', 'Löschen']) await expect(button(page, n)).toBeVisible();
  const del = button(page, 'Löschen');
  await expect(del.locator('.tabler-icon')).toHaveCount(1);
  await expect(del).toContainText('Löschen');
  for (const n of ['Duplizieren', 'An gleicher Stelle duplizieren', 'Nach vorne', 'Nach hinten', 'Waagrecht spiegeln', 'Senkrecht spiegeln', 'Bildregler zurücksetzen']) {
    await expect(button(page, n)).toHaveText('');
    await expect(button(page, n).locator('.tabler-icon')).toHaveCount(1);
  }
  const ys = await Promise.all(['Duplizieren', 'An gleicher Stelle duplizieren', 'Nach vorne', 'Nach hinten', 'Löschen'].map(async (n) => (await button(page, n).boundingBox())!.y));
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
  // Rahmen ist seit 4c Task 11 ein Effekt (Zeile mit Papierkorb), kein Schalter
  for (const n of ['Ausschnitt bearbeiten', 'BBZB-Look', 'Waagrecht spiegeln', 'Senkrecht spiegeln']) {
    await expect(button(page, n)).toHaveAttribute('aria-pressed', /true|false/);
    await expect(button(page, n).locator('.tabler-icon')).toHaveCount(1);
  }
  // Icons wie im Entwurf: senkrechte Achse = waagrecht spiegeln. Tabler zeichnet IconFlipHorizontal mit senkrechter Achse (Pfad «M12 3l0 18»).
  await expect(button(page, 'Waagrecht spiegeln').locator('.tabler-icon-flip-horizontal path').first()).toHaveAttribute('d', 'M12 3l0 18');
  await expect(button(page, 'Senkrecht spiegeln').locator('.tabler-icon-flip-vertical path').first()).toHaveAttribute('d', 'M3 12l18 0');
  await button(page, 'Waagrecht spiegeln').click();
  await expect(button(page, 'Waagrecht spiegeln')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.side [title]')).toHaveCount(0);
  await button(page, 'Duplizieren').hover();
  await expect.poll(() => tip(page).evaluate((e) => e.matches(':popover-open'))).toBe(true);
  await expect(tip(page).locator('kbd')).toHaveText(['Strg', 'D']);
});

test('Nach vorne per Tastatur: Fokus bleibt auf dem Knopf, wenn das Element oben liegt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.evaluate(() => window.__bbzbTest.select(window.__bbzbTest.elements()[0]!.id));
  const up = button(page, 'Nach vorne');
  await openSection(page, 'Ebene');
  await up.focus();
  await page.keyboard.press('Enter');
  await expect(up).toHaveAttribute('aria-disabled', 'true');
  await expect(up).toBeFocused();
  await page.keyboard.press('Enter'); // wirkt nicht
  await expect(up).toBeFocused();
  await up.hover();
  await expect(tip(page)).toContainText('Liegt schon ganz vorne');
});

test('Aktionsreihe läuft nicht über', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await photoSelected(page);
  const fits = await page.locator('.actions-row').evaluate((e) => [e.scrollWidth, e.clientWidth, e.closest('.inspector')!.scrollWidth, e.closest('.inspector')!.clientWidth]);
  expect(fits[0]).toBeLessThanOrEqual(fits[1]!);
  expect(fits[2]).toBeLessThanOrEqual(fits[3]!);
});

test('Sperren und Ausblenden nur einmal, im Ebenen-Panel', async ({ page }) => {
  await photoSelected(page);
  await openLayers(page);
  await expect(page.getByRole('button', { name: 'Sperren', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Ausblenden', exact: true })).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Ebenen' }).getByRole('button', { name: 'Sperren', exact: true })).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Ebenen' }).locator('.tabler-icon')).toHaveCount(2);
  await addEffect(page, 'Korn');
  await button(page, 'Korn').waitFor();
  await expect(button(page, 'Korn').locator('.tabler-icon')).toHaveCount(1);
  await expect(button(page, 'Korn').locator('.tabler-icon-grain')).toHaveCount(1);
  // Reichweite: Tooltip
  await addScrim(page, 'Unten');
  // Seit den Abschnitten (Task 14) liegt der Regler unterhalb: erst hinscrollen, denn Scrollen schliesst den Tooltip
  await page.getByRole('slider', { name: 'Reichweite' }).scrollIntoViewIfNeeded();
  await frames(page);
  // Ein spätes Scroll-Ereignis schliesst den Tooltip nach dem Hover (der Tooltip schliesst bei jedem Scrollen): Hover wiederholen, bis er offen bleibt.
  await expect(async () => {
    await page.mouse.move(0, 0);
    await page.getByRole('slider', { name: 'Reichweite' }).hover();
    await expect.poll(() => tip(page).evaluate((e) => e.matches(':popover-open')), { timeout: 1500 }).toBe(true);
  }).toPass({ timeout: 15_000 });
  await expect(tip(page)).toContainText('Wie weit der Verlauf hineinreicht.');
  await shot(page, `task-5-${page.viewportSize()!.width}-foto-ebenen.png`);
});

test('Text-Inspector nennt den Doppelklick', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect(panel(page).getByText('Doppelklick auf der Leinwand bearbeitet den Text.')).toBeVisible();
  await shot(page, `task-5-${page.viewportSize()!.width}-text.png`);
});

for (const width of [1280, 1536]) {
  test(`${width} px: Layout-Kacheln im Inspector brechen keine Namen und lassen «Leer» nicht allein`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 864 });
    await newProject(page, 'Post 4:5');
    const tiles = (await openSlideLayouts(page)).locator('li');
    expect(await tiles.count()).toBeGreaterThan(3);
    const res = await panel(page).locator('.layout-label').evaluateAll((labels) =>
      labels.map((l) => {
        const cs = getComputedStyle(l.closest('.layout-tile')!);
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit';
        l.closest('.layout-tile')!.appendChild(probe);
        const widest = Math.max(...(l.firstChild!.textContent ?? '').split(/\s+/).map((w) => ((probe.textContent = w), probe.getBoundingClientRect().width)));
        probe.remove();
        return { hyphens: cs.hyphens, fits: widest <= l.getBoundingClientRect().width + 0.5, text: l.textContent };
      }),
    );
    for (const r of res) {
      expect(r.hyphens, r.text!).toBe('none');
      expect(r.fits, r.text!).toBe(true);
    }
    // letzte Reihe: mindestens zwei Kacheln teilen sich die y-Position (nichts steht allein)
    const ys = await Promise.all((await tiles.all()).map(async (t) => Math.round((await t.boundingBox())!.y)));
    const last = Math.max(...ys);
    expect(ys.filter((y) => y === last).length).toBeGreaterThan(1);
    await shot(page, `task-5-${width}-layouts.png`);
  });
}

test('Korn an Foto und Slide zeigt das Korn-Icon, Ort-Chip in der Bibliothek einen Pin', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Korn'); // Slide: die Korn-Zeile im Abschnitt «Effekte»
  await expect(button(page, 'Korn').locator('.tabler-icon-grain')).toHaveCount(1);
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await addEffect(page, 'Korn'); // Foto: ebenfalls als Effekt-Zeile
  await expect(button(page, 'Korn').locator('.tabler-icon-grain')).toHaveCount(1);
  await shot(page, 'task-1-foto.png');
  await page.getByRole('tab', { name: 'Tags' }).click();
  await expect(page.getByRole('button', { name: 'Ort', exact: true }).locator('.library-chip svg')).toHaveCount(1);
  await shot(page, 'task-1-tags.png');
});
