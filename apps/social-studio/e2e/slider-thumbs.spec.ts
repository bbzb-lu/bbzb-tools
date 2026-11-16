import { expect, test, type Page } from '@playwright/test';
import { theme } from '../src/ui/theme';
import { addPhoto, elements, newProject, openAllSections, png } from './fixtures';
import { addVideo } from './video';

/**
 * Jeder echte Regler im Inspector zeigt den Griff der Bauteile «Fader» im Entwurf, in jedem Browser gleich: ein eigenes Element über dem Eingabefeld
 * (20 × 28 px, Papier, Rand 1.5 px Tinte, Akzentmarke 4 × 20 px mittig, kein Schatten), die Bahn 6 px Tinte.
 * Der Bereichsregler am Video folgt «Bereichsregler»: Klammern 12 × 32 px (Stab und Füsse 5 px Tinte), Schiene 8 px mit Rand, Auswahl in Tinte.
 */
/** Retina wie Alexejs Mac: bei 1x rundet Chromium Ränder von 1.5 px auf 1 px (wie jeden Rand dieser Breite). */
test.use({ deviceScaleFactor: 2 });

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

/** Griff des Reglers `name` im Inspector: Masse, Farben und Lage gegenüber dem Eingabefeld. */
async function thumbOf(page: Page, name: string) {
  const input = page.getByLabel('Eigenschaften').getByRole('slider', { name, exact: true }).first();
  await input.scrollIntoViewIfNeeded(); // elementFromPoint braucht den Griff im Bild
  return input.evaluate((input: HTMLInputElement) => {
    const t = input.parentElement!.querySelector<HTMLElement>('.slider-thumb');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const i = input.getBoundingClientRect();
    const s = getComputedStyle(t);
    const b = getComputedStyle(t, '::before'); // Papier 1.5 px innen: der Rand in Tinte bleibt stehen
    const a = getComputedStyle(t, '::after'); // Akzentmarke
    const p = (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min));
    return {
      w: r.width, h: r.height, border: s.borderTopWidth, bg: s.backgroundColor, shadow: s.boxShadow, radius: s.borderTopLeftRadius,
      paper: [b.top, b.right, b.bottom, b.left, b.backgroundColor], mark: [a.left, a.top, a.width, a.height, a.backgroundColor],
      dx: r.left - (i.left + (i.width - r.width) * p), dy: r.top + r.height / 2 - (i.top + i.height / 2),
      covers: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === input,
      track: getComputedStyle(input).backgroundImage, trackSize: getComputedStyle(input).backgroundSize,
    };
  });
}

async function expectFader(page: Page, name: string, locked = false) {
  const t = await thumbOf(page, name);
  expect(t, `${name}: Griff als eigenes Element`).not.toBeNull();
  expect(t!.w, `${name}: Breite`).toBeCloseTo(20, 1);
  expect(t!.h, `${name}: Höhe`).toBeCloseTo(28, 1);
  // Rand 1.5 px Tinte (Tinte unter Papier, das 1.5 px innen liegt; die Pixelprobe in slider-handle.spec.ts misst ihn), Akzentmarke 4 × 20 px bei 8/4 px
  expect(t!.border).toBe('0px');
  expect(t!.bg).toBe(rgb(theme.ink));
  expect(t!.paper, `${name}: Papier mit Rand`).toEqual(['1.5px', '1.5px', '1.5px', '1.5px', rgb(theme.paper)]);
  expect(t!.mark, `${name}: Akzentmarke`).toEqual(['8px', '4px', '4px', '20px', rgb(theme.accent)]);
  expect([t!.shadow, t!.radius]).toEqual(['none', '0px']);
  expect(Math.abs(t!.dx), `${name}: Griff steht beim Wert`).toBeLessThan(0.6);
  expect(Math.abs(t!.dy), `${name}: Griff mittig auf der Bahn`).toBeLessThan(0.6);
  if (!locked) expect(t!.covers, `${name}: Zeiger gehen durch den Griff an den Regler`).toBe(true); // gesperrt: Abschnitt ist inert
  expect(t!.track, `${name}: Bahn sichtbar`).toContain(rgb(theme.ink));
  expect(t!.trackSize).toContain('6px');
}

test('Regler im Inspector: Text, Foto (Bildregler, Weiche Kante) und gesperrt zeigen den Griff des Entwurfs', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  await openAllSections(page);
  for (const name of ['Grösse', 'Zeilenabstand', 'Laufweite', 'Deckkraft']) await expectFader(page, name);
  await addPhoto(page, png(800, 600));
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  const photo = (await elements(page))[1]!.id;
  await page.evaluate((i) => window.__bbzbTest.select(i), photo);
  await openAllSections(page);
  const helligkeit = page.getByLabel('Eigenschaften').getByRole('slider', { name: 'Helligkeit' });
  await helligkeit.focus();
  await page.keyboard.press('End'); // Griff am rechten Ende
  for (const name of ['Deckkraft', 'Helligkeit', 'Kontrast', 'Weiche Kante']) await expectFader(page, name);
  // Fokus: Ring in Tinte, 2 px Abstand, am Griff
  const ring = await helligkeit.evaluate((i) => { const s = getComputedStyle(i.parentElement!.querySelector('.slider-thumb')!); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset]; });
  expect(ring).toEqual(['solid', '2px', rgb(theme.ink), '2px']);
  // Gesperrt: Regler aus, Bahn und Griff bleiben sichtbar
  await page.evaluate((i) => window.__bbzbTest.patch(i, { locked: true }), photo);
  await expect(page.getByLabel('Eigenschaften').getByRole('slider', { name: 'Deckkraft' })).toBeDisabled();
  await expectFader(page, 'Deckkraft', true);
});

test('Bereichsregler am Video: Klammern und Schiene wie im Entwurf', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page);
  const g = await page.locator('.range').evaluate((root) => {
    const box = (sel: string) => { const e = root.querySelector<HTMLElement>(sel)!; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { w: r.width, h: r.height, cy: r.top + r.height / 2, l: s.borderLeftWidth, r: s.borderRightWidth, t: s.borderTopWidth, b: s.borderBottomWidth, c: s.borderTopColor, bg: s.backgroundColor, rail: [getComputedStyle(e, '::before').top, getComputedStyle(e, '::before').backgroundColor] }; };
    return { start: box('.range-start'), end: box('.range-end'), rail: box('.range-rail'), fill: box('.range-fill') };
  });
  for (const [k, h] of [['start', g.start], ['end', g.end]] as const) {
    expect([h.w, h.h], `${k}: Klammer 12 × 32`).toEqual([12, 32]);
    expect([h.t, h.b], `${k}: Füsse 5 px`).toEqual(['5px', '5px']);
    expect(h.c).toBe(rgb(theme.ink));
  }
  expect([g.start.l, g.start.r], 'Start: Stab links').toEqual(['5px', '0px']);
  expect([g.end.l, g.end.r], 'Ende: Stab rechts').toEqual(['0px', '5px']);
  expect(g.rail.h, 'Schiene 8 px').toBe(8);
  expect(g.rail.bg, 'Schiene: Rand in Tinte').toBe(rgb(theme.ink));
  expect(g.rail.rail, 'Schiene: Fläche 1.5 px innen').toEqual(['1.5px', rgb(theme['paper-shade'])]);
  expect([g.fill.h, g.fill.bg], 'Auswahl in Tinte').toEqual([8, rgb(theme.ink)]);
  expect(Math.abs(g.rail.cy - g.start.cy), 'Klammer mittig auf der Schiene').toBeLessThan(0.6);
});
