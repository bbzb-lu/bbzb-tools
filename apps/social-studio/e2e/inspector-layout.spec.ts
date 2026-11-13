import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addScrim, elements, newProject, png } from './fixtures';

/** Eigenschaften wie Figma: Abschnitte mit kleiner Überschrift je Elementtyp, gleiche Knopfnamen, die Seite scrollt nie. */

const panel = (page: Page) => page.getByLabel('Eigenschaften');

type Kind = 'foto' | 'text' | 'tag' | 'scribble' | 'slide';
const TYPE: Record<Kind, string | null> = { foto: 'photo', text: 'text', tag: 'tag', scribble: 'brand', slide: null };

// Seit Phase 4c ohne Modus und ohne Abschnitt «Position»
const SECTIONS: Record<Kind, string[]> = {
  foto: ['Ebene', 'Darstellung', 'Bild', 'Maske', 'Effekte'],
  text: ['Ebene', 'Darstellung'],
  tag: ['Ebene', 'Darstellung'],
  scribble: ['Ebene', 'Darstellung'],
  slide: ['Layout', 'Hintergrund', 'Effekte'],
};

// Namen aller Bedienelemente vor dem Umbau (Phase 2.5, Task 13), sortiert: keine Umbenennung.
const ACTIONS = ['button:An gleicher Stelle duplizieren', 'button:Duplizieren', 'button:Löschen', 'button:Nach hinten', 'button:Nach vorne'];
const SWATCHES = ['radio:Blau', 'radio:Blauschwarz', 'radio:Orange', 'radio:Warmweiss'];
// seit 4c Task 4 ohne Pfeilknöpfe (Zahlenfeld mit Pfeiltasten genügt)
const slider = (n: string) => [`number:${n}`, `range:${n}`];
// seit 4c Task 11: Verlauf als Effekt-Zeile (Seite als Auswahl), Rahmen und Korn über «+», Spiegeln in beide Richtungen, «Weiche Kante»
const SCRIM = ['button:Verlauf Unten entfernen', 'select:Seite'];
const PHOTO = [...ACTIONS, ...SCRIM, ...['Ausschnitt bearbeiten', 'Foto ersetzen', 'Hintergrund entfernen', 'Als Sticker kopieren', 'Motiv vor Titel', 'Maske bearbeiten', 'Maske umkehren', 'Maske zurücksetzen', 'Maske weich zeichnen', 'BBZB-Look', 'Waagrecht spiegeln', 'Senkrecht spiegeln', 'Bildregler zurücksetzen', 'Effekt hinzufügen'].map((n) => `button:${n}`), ...slider('Weiche Kante'), ...['Dunkel', 'Hell', 'Leicht', 'Mittel', 'Stark'].map((n) => `radio:${n}`)];
const TEXT = [...ACTIONS, ...SWATCHES, ...slider('Grösse'), ...['Kommentar', 'Links', 'Mitte', 'Rechts', 'Titel'].map((n) => `radio:${n}`)];
// Layout-Kacheln sind zugeklappt (Phase 2.8): nur der Öffnen-Knopf zählt; Effekte nur mit «+» (ohne Effekt)
const LAYOUTS = ['Effekt hinzufügen', 'Layout ändern'].map((n) => `button:${n}`);
const NAMES: Record<Kind, string[]> = {
  foto: [...PHOTO, ...['Deckkraft', 'Helligkeit', 'Kontrast', 'Reichweite', 'Sättigung', 'Wärme'].flatMap(slider)],
  text: [...TEXT, ...['Deckkraft', 'Laufweite', 'Zeilenabstand'].flatMap(slider)],
  tag: [...ACTIONS, 'text:Text', 'radio:Instagram', 'radio:LinkedIn', ...slider('Deckkraft')], // CTA
  scribble: [...ACTIONS, ...SWATCHES, 'button:Spiegeln', ...slider('Deckkraft')],
  slide: [...LAYOUTS, ...SWATCHES],
};

async function setup(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.evaluate(() => window.__bbzbTest.insertTag('cta'));
  await page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'));
  await addPhoto(page, png(1200, 1500));
  await expect.poll(async () => (await elements(page)).length).toBe(4);
  await addScrim(page, 'Unten');
  const els = await elements(page);
  return Object.fromEntries(els.map((e) => [e.type, e]));
}

/** Überschrift (h2), Abschnitte (Überschrift h3, Anzahl Bedienelemente) und Namen aller Bedienelemente im Inspector. */
const read = (page: Page) =>
  page.locator('.inspector').evaluate((root) => ({
    h2: root.querySelector('h2')?.textContent,
    firstIsH2: root.firstElementChild?.tagName === 'H2',
    sections: [...root.querySelectorAll(':scope > section, :scope > .inspector-body > section')].map((s) => {
      const h = document.getElementById(s.getAttribute('aria-labelledby') ?? '');
      return { title: h?.textContent ?? '', tag: h?.closest('h3')?.tagName, inside: !!h && s.contains(h), controls: s.querySelectorAll('button, input, select').length };
    }),
    names: [...root.querySelectorAll<HTMLElement>('button, input, select')]
      .filter((e) => !e.closest('[hidden], .effects-menu') && !e.matches('.section-toggle')) // zugeklappte Layout-Kacheln und das Effekt-Menü zählen nicht
      .map((e) => {
        const label = e.getAttribute('aria-label') || ((e as HTMLSelectElement).labels?.[0] ?? e.closest('label'))?.textContent?.trim() || (e.textContent ?? '').trim();
        return `${e.tagName === 'BUTTON' ? 'button' : e.tagName === 'SELECT' ? 'select' : (e.getAttribute('type') ?? 'text')}:${label}`;
      })
      .sort(),
  }));

/** Alle einklappbaren Abschnitte aufklappen (Ebene, Hintergrund, Effekt-Zeilen …), damit ihre Bedienelemente zählen. */
const openAll = (page: Page) =>
  page.locator('.inspector').evaluate((root) => {
    for (let n = 0; n < 5; n++) root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="false"]').forEach((b) => b.click());
  });

const scroll = (page: Page) =>
  page.locator('.inspector').evaluate((e) => ({
    inspector: e.scrollHeight - e.clientHeight,
    pageY: document.documentElement.scrollHeight - innerHeight,
    pageX: document.documentElement.scrollWidth - innerWidth,
  }));

for (const [w, h] of [[1280, 720], [1536, 864]] as const) {
  test(`${w} × ${h}: Abschnitte je Elementtyp, Knopfnamen unverändert, die Seite scrollt nie`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const els = await setup(page);
    for (const kind of Object.keys(TYPE) as Kind[]) {
      const el = TYPE[kind] ? els[TYPE[kind]!]! : null;
      await page.evaluate((id) => window.__bbzbTest.select(id as string), el?.id ?? null);
      const what = kind;
      await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(el ? el.name : 'Slide 1');
      await openAll(page);
      const r = await read(page);
      expect(r.firstIsH2, `${what}: Name als h2 zuoberst`).toBe(true);
      expect(r.sections.map((s) => s.title), `${what}: Abschnitte`).toEqual(SECTIONS[kind]);
      for (const s of r.sections) {
        expect(s.tag, `${what}: ${s.title} als h3`).toBe('H3');
        expect(s.inside, `${what}: Überschrift im Abschnitt`).toBe(true);
        expect(s.controls, `${what}: ${s.title} nicht leer`).toBeGreaterThan(0);
      }
      expect(r.names, `${what}: Namen`).toEqual([...NAMES[kind]].sort());
      // Segmente und Knöpfe schneiden ihre Beschriftung nicht ab (schmale Wertspalte neben der Beschriftung)
      const clipped = await page.locator('.inspector').evaluate((root) =>
        [...root.querySelectorAll<HTMLElement>('.segmented span, button')].filter((e) => e.offsetWidth > 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      expect(clipped, `${what}: abgeschnitten`).toEqual([]);
      const s = await scroll(page);
      expect(s.pageY, `${what}: Seite scrollt senkrecht`).toBeLessThanOrEqual(0);
      expect(s.pageX, `${what}: Seite scrollt waagrecht`).toBeLessThanOrEqual(0);
      if (w === 1280 && (kind === 'text' || kind === 'tag')) expect(s.inspector, `${what}: Inspector scrollt`).toBeLessThanOrEqual(0);
    }
  });
}

test('Leerer Fotorahmen: Ebene, Darstellung, Bild und Effekte, ohne leeren Abschnitt', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  const photo = (await elements(page)).find((e) => e.type === 'photo' && !(e.props as { assetId?: string }).assetId)!;
  await page.evaluate((id) => window.__bbzbTest.select(id), photo.id);
  const r = await read(page);
  expect(r.sections.map((s) => s.title)).toEqual(['Ebene', 'Darstellung', 'Bild', 'Effekte']);
  for (const s of r.sections) expect(s.controls, s.title).toBeGreaterThan(0);
});
