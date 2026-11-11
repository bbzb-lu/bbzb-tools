import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addScrim, elements, newProject, openAllSections, openLayers, png } from './fixtures';

/**
 * Sichtbarer Fokus (WCAG 2.4.7, 1.4.11): Outline ab 2 px, Kontrast der Linie zum Grund dahinter mindestens 3:1.
 * Versteckte Eingaben (Segmente, Farbfelder: opacity 0) zeigen den Fokus an einem Vorfahren, der mit `:has` gezeichnet wird; Regler am gemalten Griff.
 */
const indicator = (page: Page) =>
  page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const lum = ([r, g, b]: number[]) => [r, g, b].map((v) => (v! / 255 <= 0.03928 ? v! / 255 / 12.92 : ((v! / 255 + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const ground = (el: Element | null) => {
      for (; el; el = el.parentElement) {
        const c = rgba(getComputedStyle(el).backgroundColor);
        if (c[3] === 255) return c;
      }
      return [255, 255, 255, 255];
    };
    const active = document.activeElement as HTMLElement;
    const kind = active.getAttribute('role') ?? active.getAttribute('type') ?? active.tagName.toLowerCase();
    const name = active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 30) ?? '';
    // der Fokus kann am Element selbst, (versteckte Eingabe) an einem der nächsten Vorfahren oder (Regler) am gemalten Griff daneben sitzen
    const thumb = active.nextElementSibling?.classList.contains('slider-thumb') ? (active.nextElementSibling as HTMLElement) : null;
    const bar = active.parentElement?.querySelector(':scope > .slide-hl') as HTMLElement | null; // gleitende Fläche trägt den Ring der Reiter
    for (const el of [thumb, bar, active, active.parentElement, active.parentElement?.parentElement, active.parentElement?.parentElement?.parentElement]) {
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.opacity === '0' || cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) < 2) continue;
      const behind = ground(parseFloat(cs.outlineOffset) < 0 ? el : el.parentElement);
      const [a, b] = [lum(rgba(cs.outlineColor)), lum(behind)].sort((x, y) => y - x);
      return { ok: (a! + 0.05) / (b! + 0.05) >= 3, kind, name, ratio: (a! + 0.05) / (b! + 0.05) };
    }
    return { ok: false, kind, name, ratio: 0, tag: active.tagName };
  });

/** Von oben nach unten durch die ganze Seite tabben; liefert die Arten der Fokuspunkte und die ohne Fokusanzeige. */
async function tabThrough(page: Page) {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const kinds = new Set<string>();
  const bad: string[] = [];
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press('Tab');
    const f = await indicator(page);
    if (f.tag === 'BODY') break;
    kinds.add(f.kind);
    if (!f.ok) bad.push(`${f.kind} «${f.name}» ${f.ratio.toFixed(1)}`);
  }
  return { kinds, bad };
}

test('Tab-Durchlauf mit Foto: Kopf, Reiter, Ebenen, Regler, Zahlenfelder, Auswahlfelder und Slide-Leiste zeigen einen Fokus', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await addScrim(page, 'Unten');
  await openAllSections(page);
  await openLayers(page); // die gewählte Ebenenzeile ist Tinte invers
  const { kinds, bad } = await tabThrough(page);
  expect(bad).toEqual([]);
  for (const k of ['tab', 'range', 'number', 'radio', 'select']) expect(kinds, k).toContain(k);
});

test('Tab-Durchlauf mit Standort-Tag: Schalter und Segmente zeigen einen Fokus', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => window.__bbzbTest.insertTag('schul'));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof');
  await page.getByRole('switch', { name: 'Fachbereich zeigen' }).click();
  await openAllSections(page);
  await page.evaluate(() => window.__bbzbTest.notify('error', 'Das Foto konnte nicht gelesen werden.')); // dunkle Fläche: Ring in Warmweiss
  const { kinds, bad } = await tabThrough(page);
  expect(bad).toEqual([]);
  expect(kinds).toContain('button');
  for (const k of ['switch', 'select']) expect(kinds, k).toContain(k);
});

/** Der Ring am gewählten linken Reiter ist wirklich zu sehen (die gleitende Fläche darf ihn nicht verdecken): Pixel 3 px innerhalb der Kante, dort liegt der Ring (2 px, Versatz −4 px). */
test('Fokusring am gewählten linken Reiter ist sichtbar und liegt nicht unter der Fläche', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const lib = page.getByRole('tab', { name: 'Bibliothek', exact: true });
  await lib.focus();
  await page.keyboard.press('ArrowRight'); // Tastatur: :focus-visible
  const lay = page.getByRole('tab', { name: 'Ebenen', exact: true });
  await expect(lay).toBeFocused();
  await page.waitForTimeout(400); // Fläche am Ziel
  const b = (await lay.boundingBox())!;
  const ring = async (x: number) => {
    const { PNG } = await import('pngjs');
    const png = PNG.sync.read(await page.screenshot({ clip: { x, y: b.y + b.height / 2, width: 1, height: 1 } }));
    return [...png.data.slice(0, 3)];
  };
  const paper = await page.evaluate(() => { const c = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(); return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); });
  expect(await ring(b.x + b.width - 3)).toEqual(paper);
  expect(await ring(b.x + 3)).toEqual(paper);
});
