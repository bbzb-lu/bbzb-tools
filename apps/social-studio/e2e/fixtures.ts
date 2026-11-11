import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { PNG } from 'pngjs';

/** Waagrechter Verlauf, Standard Orange → Blau (Markenfarben als RGB, damit kein Hex ausserhalb tokens.ts steht). */
export function gradientPng(width: number, height: number, from = [255, 78, 0], to = [0, 159, 226]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = width > 1 ? x / (width - 1) : 0;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(from[c]! + (to[c]! - from[c]!) * t);
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/** Jede Spalte trägt ihre x-Koordinate: R = x & 255, G = x >> 8, B = 128 (verlustfrei als PNG). */
export function columnPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      png.data.set([x & 255, x >> 8, 128, 255], i);
    }
  }
  return PNG.sync.write(png);
}

/** Projektdatei wie packProject: project.json + assets/<SHA-256-Hex>. */
export function bbzbsocial(project: object, assets: Record<string, Uint8Array> = {}): Buffer {
  const files: Record<string, Uint8Array> = {
    'project.json': strToU8(JSON.stringify({ schemaVersion: 1, project })),
  };
  for (const [id, data] of Object.entries(assets)) files[`assets/${id}`] = data;
  return Buffer.from(zipSync(files));
}

/** Layouts des früheren Carousels (Titel, Vollbild, Panorama, Collage, Abschluss), Panorama belegt zwei Slides. */
const CAROUSEL = ['Titel', 'Vollbild', 'Panorama', 'Collage', 'Abschluss'];

/**
 * Neues Projekt: Format wählen, die Layout-Wahl öffnet sich für Slide 1.
 * «Leer» (Standard) schliesst sie mit Esc und lässt eine leere Slide; «Carousel» baut die Slides über die Layout-Wahl auf.
 */
export async function newProject(page: Page, format: 'Post 4:5' | 'Story 9:16', template: 'Carousel' | 'Leer' = 'Leer'): Promise<void> {
  await page.goto('');
  await page.getByRole('button', { name: format }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();
  const picker = page.locator('#slide-layouts');
  await expect(picker).toBeVisible();
  if (template === 'Leer') {
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    return;
  }
  const [first, ...rest] = CAROUSEL;
  await picker.getByRole('button', { name: first }).click();
  for (const name of rest) await addSlide(page, name);
  const tiles = page.getByRole('list', { name: 'Slides' }).getByRole('button');
  await expect(tiles).toHaveCount(6);
  await tiles.first().click(); // wie das frühere Carousel: Slide 1 ist aktuell
}

/** «Slide hinzufügen» und im Popover ein Layout wählen (Story ohne Layouts: fügt direkt eine leere Slide ein). */
export async function addSlide(page: Page, layout = 'Leer'): Promise<void> {
  const add = page.getByRole('button', { name: 'Slide hinzufügen', exact: true });
  const withLayouts = (await add.getAttribute('popovertarget')) !== null;
  await add.click();
  if (withLayouts) await page.locator('#slide-layouts').getByRole('button', { name: layout }).click();
}

/** Slide-Inspector: «Layout ändern» öffnen (falls zu) und die Kachelliste liefern. */
export async function openSlideLayouts(page: Page): Promise<Locator> {
  await openSection(page, 'Layout');
  const toggle = page.getByRole('button', { name: 'Layout ändern' });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return page.getByRole('list', { name: 'Layout für diese Slide' });
}

export async function addPhoto(page: Page, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto oder Video hinzufügen' }).click();
  await (await chooser).setFiles(file);
}

export const png = (w: number, h: number) => ({ name: 'foto.png', mimeType: 'image/png', buffer: gradientPng(w, h) });
/** Zwei Frames warten: Konva zeichnet (auch die Trefferfläche) erst im nächsten Frame neu. */
export const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
export const elements = (page: Page) => page.evaluate(() => window.__bbzbTest.elements());

/** Stage-Position und Massstab; wartet, bis die Stage existiert. */
export const view = async (page: Page) =>
  (await (
    await page.waitForFunction(() => {
      try {
        return window.__bbzbTest.view();
      } catch {
        return null; // Stage noch nicht angelegt
      }
    })
  ).jsonValue())!;

/** Bildschirmpunkt eines Weltpunkts (Slide-Koordinaten) mit aktuellem Zoom und Scrollen; (0, 0) ist die linke obere Ecke von Slide 1. */
export async function toScreen(page: Page, wx: number, wy: number) {
  const box = (await page.locator('.konvajs-content').boundingBox())!;
  const v = await view(page);
  return { x: box.x + v.x + wx * v.scale, y: box.y + v.y + wy * v.scale };
}

/** Inhaltskasten der Textarea (ohne Polster) und Elementkasten auf dem Bildschirm, aus der Stage gerechnet (Zoom und Scrollen inklusive). */
export async function overlayVsElement(page: Page) {
  const v = await page.evaluate(() => window.__bbzbTest.view());
  const stage = (await page.locator('.konvajs-content').boundingBox())!;
  const [el] = await elements(page);
  const ta = await page.locator('textarea').evaluate((t: HTMLTextAreaElement) => {
    const s = getComputedStyle(t);
    const pad = parseFloat(s.paddingTop);
    const m = new DOMMatrix(s.transform);
    return { x: t.offsetLeft + pad, y: t.offsetTop + pad, w: t.offsetWidth - 2 * pad, h: t.offsetHeight - 2 * pad, deg: (Math.atan2(m.b, m.a) * 180) / Math.PI };
  });
  const content = (await page.locator('.canvas-content').boundingBox())!;
  return {
    ta: { x: content.x + ta.x, y: content.y + ta.y, w: ta.w, h: ta.h, deg: ta.deg },
    el: { x: stage.x + v.x + el!.x * v.scale, y: stage.y + v.y + el!.y * v.scale, w: el!.width * v.scale, h: el!.height * v.scale, deg: el!.rotation },
  };
}

/** Mittlere Abweichung je Kanal (0..255) und Mittelwert je Kanal. */
export function meanDiff(a: PNG, b: PNG) {
  const d = [0, 0, 0];
  for (let i = 0; i < a.data.length; i += 4) for (let k = 0; k < 3; k++) d[k]! += Math.abs(a.data[i + k]! - b.data[i + k]!);
  return d.map((v) => v / (a.data.length / 4));
}
export function mean(p: PNG, y0 = 0, y1 = p.height) {
  const m = [0, 0, 0];
  for (let i = y0 * p.width * 4; i < y1 * p.width * 4; i += 4) for (let k = 0; k < 3; k++) m[k]! += p.data[i + k]!;
  return m.map((v) => v / ((y1 - y0) * p.width));
}

/** Alle Slides als PNG exportieren und dekodieren. */
export async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  return Object.values(files).map((f) => PNG.sync.read(Buffer.from(f)));
}

/** Legt ein PNG am Weltpunkt ab, wie aus dem Explorer gezogen. */
export async function dropPng(page: Page, wx: number, wy: number, png: Buffer): Promise<void> {
  const p = await toScreen(page, wx, wy);
  const dataTransfer = await page.evaluateHandle((b) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(b)], 'foto.png', { type: 'image/png' }));
    return dt;
  }, [...png]);
  await page.locator('.canvas-scroll').dispatchEvent('drop', { dataTransfer, clientX: p.x, clientY: p.y });
}

/** Streuung des Grünkanals in 50 × 50-Feldern (feines Korn ohne grobe Flecken) und Mittelwert. */
function greenStats(data: ArrayLike<number>, width: number, spots: number[][]) {
  return spots.map(([x0, y0]) => {
    let s = 0, q = 0;
    for (let y = y0!; y < y0! + 50; y++) for (let x = x0!; x < x0! + 50; x++) {
      const g = data[(y * width + x) * 4 + 1]!;
      s += g;
      q += g * g;
    }
    return { mean: s / 2500, sd: Math.sqrt(q / 2500 - (s / 2500) ** 2) };
  });
}

/** Mittlere Korn-Streuung einer blauen Post-Slide (1080 breit) und der blauen Flächen in den Referenzbildern 05 und 07. */
export async function grainSpread(page: Page, got: PNG) {
  const spots = [[10, 10], [400, 20], [20, 500], [350, 1200], [10, 880], [300, 1290]];
  const ours = greenStats(got.data, got.width, spots);
  // Referenzen im Browser dekodieren (JPEG); nur die 50 × 50-Felder zurückgeben
  const refs = await page.evaluate(async (list) => {
    const out: number[][][] = [];
    for (const { b64, at } of list) {
      // kein fetch: CSP connect-src 'self'
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      out.push(at.map(([x, y]) => Array.from(ctx.getImageData(x!, y!, 50, 50).data)));
    }
    return out;
  }, [
    { b64: readFileSync(`${import.meta.dirname}/../docs/reference/layouts/Beispiel_05_Collage.jpg`).toString('base64'), at: spots.slice(0, 4) },
    { b64: readFileSync(`${import.meta.dirname}/../docs/reference/layouts/Beispiel_07_Drei_Fotos.jpg`).toString('base64'), at: spots.slice(4) },
  ]);
  const ref = refs.flat().map((d) => greenStats(d, 50, [[0, 0]])[0]!);
  const avg = (l: { sd: number }[]) => l.reduce((a, b) => a + b.sd, 0) / l.length;
  return { ours: avg(ours), ref: avg(ref) };
}

/** Foto (seit 4c Task 11): Verlauf über «+» anlegen und in der neuen, aufgeklappten Zeile die Seite wählen (ein zweiter Undo-Schritt, falls nicht die vorgeschlagene). */
export async function addScrim(page: Page, side: string): Promise<void> {
  await addEffect(page, 'Verlauf');
  const select = page.getByLabel('Eigenschaften').getByRole('combobox', { name: 'Seite' }).last();
  if ((await select.locator('option:checked').textContent()) !== side) await select.selectOption({ label: side });
}

/** Element `id` kurz wählen, alle Abschnitte seines Inspectors aufklappen und die Auswahl wiederherstellen (für Tests, die nicht das Aufklappen prüfen). */
export async function openSectionsOf(page: Page, id: string): Promise<void> {
  const before = await page.evaluate(() => window.__bbzbTest.selected());
  await page.evaluate((i) => window.__bbzbTest.select(i), id);
  await openAllSections(page);
  await page.evaluate((b) => window.__bbzbTest.selectIds(b ? [b] : []), before);
}

/** Alle einklappbaren Abschnitte des Inspectors aufklappen (Zustand bleibt für die Sitzung, auch bei anderer Auswahl). */
export async function openAllSections(page: Page): Promise<void> {
  await page.locator('.inspector').evaluate((root) => {
    for (let n = 0; n < 5; n++) root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="false"]').forEach((b) => b.click());
  });
  await expect(page.locator('.inspector .section-toggle[aria-expanded="false"]')).toHaveCount(0);
}

/** Slide-Panel: Effekt über «+» hinzufügen (Verläufe kommen in der Reihenfolge unten, oben, links, rechts); der neue Effekt ist aufgeklappt. */
export async function addEffect(page: Page, name: 'Korn' | 'Verlauf' | 'Rahmen'): Promise<void> {
  await page.getByRole('button', { name: 'Effekt hinzufügen', exact: true }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${name}`) }).click();
}

/** Papierkorb einer Effekt-Zeile; vorhanden (auch zugeklappt) = Effekt an. */
export const effectRemove = (page: Page, name: string) => page.getByLabel('Eigenschaften').getByRole('button', { name: `${name} entfernen`, exact: true });

/** Effekt an- oder ausschalten wie früher der Schalter: über «+» hinzufügen bzw. mit dem Papierkorb entfernen (je ein Undo-Schritt). */
export async function toggleEffect(page: Page, name: 'Korn' | 'Rahmen'): Promise<void> {
  if (await effectRemove(page, name).count()) await effectRemove(page, name).click();
  else await addEffect(page, name);
}

/** Kanal-Auswahl (Radio) im CTA-Inspector. */
export const channelBtn = (page: Page, name: 'Instagram' | 'LinkedIn') => page.getByRole('group', { name: 'Kanal' }).getByRole('radio', { name });

/** Wählt den ersten CTA aus; gibt es keinen, kommt ein neuer auf die aktuelle Slide (mit `text` statt Kanaltext, damit der Wechsel ihn nicht anfasst). */
export async function selectCta(page: Page, text?: string): Promise<void> {
  await page.evaluate(async () => {
    const find = () => window.__bbzbTest.elements().find((e) => e.type === 'tag' && (e.props as { variant: string }).variant === 'cta');
    if (!find()) await window.__bbzbTest.insertTag('cta');
    const cta = find()!;
    window.__bbzbTest.select(cta.id);
  });
  if (text) await page.getByLabel('Text', { exact: true }).fill(text);
  await expect(channelBtn(page, 'Instagram')).toBeVisible();
}

/** Abschnitt im Panel öffnen (Kopfknopf mit diesem Namen), falls er zu ist; ohne Wirkung, wenn er offen ist. */
export async function openSection(page: Page, name: string): Promise<void> {
  const header = page.getByRole('button', { name, exact: true });
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

/** Reiter «Ebenen» im Fach links öffnen (die Bibliothek ist der Standard). */
export async function openLayers(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: 'Ebenen', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
