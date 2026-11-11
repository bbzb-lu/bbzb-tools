import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { cutout } from '../src/tokens';
import { addEffect, openSlideLayouts, addPhoto, addScrim, bbzbsocial, channelBtn, selectCta, dropPng, effectRemove, elements, gradientPng, openAllSections, openLayers, png, addSlide, newProject, toScreen, openSection, toggleEffect } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

/**
 * Sammelt jeden Request nach aussen: nur GET auf die eigene Herkunft, blob: und data: sind erlaubt.
 * `allow`: weitere Hosts, auf die nur GET ohne Daten gehen darf (Modelldateien).
 */
function watch(page: Page, baseURL: string, allow: (host: string) => boolean = () => false) {
  const bad: string[] = [];
  const origin = new URL(baseURL).origin;
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (r.postData()) bad.push(`Daten gesendet: ${r.method()} ${r.url()}`);
    if (u.protocol === 'blob:' || u.protocol === 'data:') return;
    if ((u.origin !== origin && !(u.protocol === 'https:' && allow(u.host))) || r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  page.on('websocket', (ws) => bad.push(`WebSocket ${ws.url()}`));
  // Von der CSP blockierte Versuche erscheinen nicht immer als «request»: Fehlschlag und Konsolenmeldung zählen auch.
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.protocol !== 'blob:' && u.protocol !== 'data:' && u.origin !== origin && !allow(u.host)) bad.push(`fehlgeschlagen ${r.url()}`);
  });
  page.on('console', (m) => m.text().includes('Content Security Policy') && bad.push(`CSP: ${m.text()}`));
  return bad;
}

/** Phase 1 und 2a: Kein Foto und kein Projekt verlässt den Browser. */
test('kompletter Ablauf ohne fremde Requests', async ({ page, baseURL }) => {
  const bad = watch(page, baseURL!);
  const photo = gradientPng(1200, 900);
  const id = createHash('sha256').update(photo).digest('hex');
  const file = bbzbsocial(
    {
      schemaVersion: 1, id: 'netz', name: 'Netztest', createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [{ id: 's1', background: 'blau' }],
      elements: {
        e1: {
          id: 'e1', type: 'photo', name: 'Foto', x: 0, y: 0, width: 1080, height: 810,
          rotation: 0, opacity: 1, visible: true, locked: false,
          props: { assetId: id, crop: { x: 0, y: 0, scale: 1 } },
        },
      },
      order: ['e1'],
      assets: { [id]: { mime: 'image/png', width: 1200, height: 900, name: 'verlauf.png' } },
    },
    { [id]: photo },
  );

  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'netz.bbzbsocial', mimeType: 'application/zip', buffer: file });
  const item = page.getByRole('listitem').filter({ hasText: 'Netztest' });
  await item.getByRole('button', { name: 'öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Netztest');

  await addPhoto(page, png(800, 600));
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(3);
  await addSlide(page);
  await expect(page.getByRole('button', { name: 'Slide 2' })).toBeVisible();
  await openLayers(page);
  await expect(page.getByRole('list', { name: 'Ebenen' })).toBeVisible();
  await page.getByRole('tab', { name: 'Bibliothek', exact: true }).click();

  // Phase 2a: Brand Library (Scribble, Icon, Tags), Korn, Look und Regler
  const lib = page.getByRole('complementary', { name: 'Bibliothek' });
  const insert = async (tab: string, names: string[]) => {
    await lib.getByRole('tab', { name: tab }).click();
    for (const name of names) await lib.getByRole('button', { name, exact: true }).click();
  };
  await insert('Scribbles', ['Scribble 1']);
  await insert('Icons', ['Velo']);
  await insert('Tags', ['Standort', 'Ort', 'CTA']);
  await addPhoto(page, png(800, 600));
  await expect.poll(async () => (await elements(page)).length).toBe(9);
  await openAllSections(page);
  const look = page.getByRole('button', { name: 'BBZB-Look', exact: true });
  await expect(look).toHaveAttribute('aria-pressed', 'true');
  await look.click();
  await look.click();
  await page.getByRole('slider', { name: 'Wärme' }).press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);

  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  const zip = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  expect((await zip).suggestedFilename()).toBe('Netztest.zip');
  await dialog.getByRole('button', { name: 'Schliessen' }).click();

  const projectFile = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
  expect((await projectFile).suggestedFilename()).toBe('Netztest.bbzbsocial');

  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.reload();
  await page.getByRole('listitem').filter({ hasText: 'Netztest' }).getByRole('button', { name: 'öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Netztest');
  await expect.poll(async () => (await elements(page)).length).toBe(9);

  expect(bad).toEqual([]);
});

/** Phase 2b: Vorlage, Layouts, Safe Zones, Einrasten, Kanal, Format-Kopie und Export bleiben im Browser. */
test('Layout-Ablauf ohne fremde Requests', async ({ page, baseURL }) => {
  const bad = watch(page, baseURL!);
  await newProject(page, 'Post 4:5', 'Carousel');
  await page.getByLabel('Projektname').fill('Netz Layout');

  await dropPng(page, 540, 700, gradientPng(1200, 1500)); // in den Titel-Fotorahmen
  await expect.poll(async () => (await elements(page)).some((e) => 'assetId' in (e.props as object))).toBe(true);
  await page.getByLabel('Projektname').blur();
  await page.keyboard.press('Escape'); // Auswahl aufheben: der Inspector zeigt die Slide
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Vollbild' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides[0]!.layout)).toBe('vollbild');
  await addSlide(page, 'Drei Fotos');
  await expect(page.getByRole('list', { name: 'Slides' }).getByRole('button')).toHaveCount(7);

  await page.getByRole('button', { name: 'Sicherheitszonen' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.layerNames())).toContain('safezones');
  await page.getByRole('button', { name: 'Slide 1', exact: true }).click();
  const a = await toScreen(page, 540, 700);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(a.x + i * 8, a.y + i * 5); // Ziehen mit Einrasten
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeEnabled();

  await selectCta(page);
  const linkedin = channelBtn(page, 'LinkedIn');
  await linkedin.click();
  await expect(linkedin).toBeChecked();
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  const zip = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  expect((await zip).suggestedFilename()).toBe('Netz Layout.zip');
  await dialog.getByRole('button', { name: 'Schliessen' }).click();

  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: '«Netz Layout» als Story kopieren', exact: true }).click();
  await page.getByRole('button', { name: '«Netz Layout (Story 9:16)» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Netz Layout (Story 9:16)');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides[0]!.layout)).toBe('vollbild-story');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const story = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'ZIP herunterladen' }).click();
  await story;

  expect(bad).toEqual([]);
});

/** Phase 2.1/2.3: Layout-Wahl beim neuen Projekt, Slide-Hintergrund mit Korn, Fotorahmen und Foto-Verlauf bleiben im Browser. */
test('Hintergrund, Verläufe und Rahmen ohne fremde Requests', async ({ page, baseURL }) => {
  const bad = watch(page, baseURL!);
  await page.goto('');
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.getByRole('dialog', { name: 'Layout wählen' }).getByRole('button', { name: 'Collage' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides[0]!.layout)).toBe('collage');
  await page.getByLabel('Projektname').fill('Netz Rahmen');
  await page.getByLabel('Projektname').blur();

  await dropPng(page, 300, 400, gradientPng(1200, 1500)); // in das Foto mit Rahmen, neben dem Sticker
  await expect.poll(async () => (await elements(page)).find((e) => e.name === 'Foto')?.props).toMatchObject({ frame: true, assetId: expect.any(String) });
  const foto = (await elements(page)).find((e) => e.name === 'Foto')!;
  await page.evaluate((id) => window.__bbzbTest.select(id), foto.id);
  await openAllSections(page);
  await toggleEffect(page, 'Rahmen');
  await expect(effectRemove(page, 'Rahmen')).toHaveCount(0);
  await toggleEffect(page, 'Rahmen');
  await expect(effectRemove(page, 'Rahmen')).toHaveCount(1);

  await addScrim(page, 'Unten'); // Verlauf am Foto (Phase 2.3)
  await expect.poll(async () => (await elements(page)).find((e) => e.name === 'Foto')?.props).toMatchObject({ scrims: [{ side: 'unten' }] });
  await page.getByRole('group', { name: 'Stärke', exact: true }).getByRole('radio', { name: 'Stark' }).check();
  await page.getByRole('slider', { name: 'Reichweite' }).press('ArrowRight'); // 56 → 57 %
  await expect.poll(async () => (await elements(page)).find((e) => e.name === 'Foto')?.props).toMatchObject({ scrims: [{ side: 'unten', strength: 'stark', reach: 57 }] });
  await page.getByRole('button', { name: 'Sicherheitszonen' }).click(); // Ränder und Zonen (Phase 2.3)
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.safeZoneMargins().length)).toBe(4);
  await page.keyboard.press('Escape'); // der Inspector zeigt die Slide
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Blauschwarz', exact: true }).check();
  await openSection(page, 'Effekte');
  await page.getByRole('button', { name: 'Korn entfernen', exact: true }).click(); // Collage bringt Korn mit: aus, dann wieder an
  await addEffect(page, 'Korn');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides[0]!)).toMatchObject({ background: 'blauschwarz', grain: true });
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);

  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  const zip = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  expect((await zip).suggestedFilename()).toBe('Netz Rahmen.zip');
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  const projectFile = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
  expect((await projectFile).suggestedFilename()).toBe('Netz Rahmen.bbzbsocial');

  expect(bad).toEqual([]);
});

/** Phase 2.2: Gruppe verschieben, Leinwand verschieben, Kanal-Meldung und Akzentfarbe bleiben im Browser. */
test('Gruppe, Pan und Kanal-Meldung ohne fremde Requests', async ({ page, baseURL }) => {
  const bad = watch(page, baseURL!);
  await newProject(page, 'Post 4:5');
  await addSlide(page, 'Panorama');
  await addSlide(page);
  const slides = page.getByRole('list', { name: 'Slides' }).getByRole('button');
  const links = () => page.evaluate(() => window.__bbzbTest.project().slides.map((s) => !!s.link));
  expect(await links()).toEqual([false, true, true, false]);
  await slides.nth(1).focus();
  await page.keyboard.press('Alt+ArrowRight'); // die Gruppe springt hinter die letzte Slide
  await expect.poll(links).toEqual([false, false, true, true]);

  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  const scroller = page.locator('.canvas-scroll');
  const box = (await scroller.boundingBox())!;
  const before = await scroller.evaluate((e) => e.scrollLeft);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2);
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(await scroller.evaluate((e) => e.scrollLeft)).toBeGreaterThan(before);

  await selectCta(page, 'Jetzt anmelden');
  await channelBtn(page, 'LinkedIn').click();
  await expect(page.getByRole('alert')).toHaveText('Kein Link-Hinweis mit Standardtext gefunden.');

  expect(bad).toEqual([]);
});

const maskSection = (page: Page) => page.locator('section.section', { has: page.getByRole('heading', { name: 'Maske', exact: true }) });
const maskBtn = (page: Page, name: string) => maskSection(page).getByRole('button', { name, exact: true });
const BOX = { x: 140, y: 275, width: 800, height: 800 };
const cutoutPhoto = alphaPng(1000, 1000, [15, 27, 38], () => 255);

/** Phase 4b: Freistellen (Ersatzmodell), Sticker und Export bleiben ganz im Browser. */
test('Freistellen-Ablauf ohne fremde Requests', async ({ page, baseURL }) => {
  const bad = watch(page, baseURL!);
  await openPhoto(page, 'Netz Freistellen', BOX, { crop: { x: 0, y: 0, scale: 1 } }, cutoutPhoto, [540, 675]);
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  await page.evaluate(() => window.__bbzbTest.fakeCutout('kreis', 0));
  await maskBtn(page, 'Hintergrund entfernen').click();
  await expect(maskBtn(page, 'Als Sticker kopieren')).toHaveAttribute('aria-disabled', 'false');
  await maskBtn(page, 'Als Sticker kopieren').click();
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const zip = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'ZIP herunterladen' }).click();
  expect((await zip).suggestedFilename()).toBe('Netz Freistellen.zip');
  expect(bad).toEqual([]);
});

/**
 * Phase 4b: das echte Werkzeug lädt das Modell. huggingface.co beantwortet ein Stub, die Modelldatei leitet wie im echten Download
 * auf einen *.hf.co-Host weiter, der nicht existiert (Weiterleitungen aus dem Worker erreicht `page.route` nicht, auch kein Abbruch): erwartet wird die Netzmeldung,
 * und nach aussen gingen nur GET auf die Hosts aus connect-src.
 */
test('Modell-Download: nur GET auf die Modell-Hosts der CSP, nur die gepinnte Revision, keine Bilddaten', async ({ page, baseURL }) => {
  const modelHost = new URL(cutout.model.host).host;
  const allowed = (host: string) => host === modelHost || host.endsWith(`.${cutout.model.storageHost}`); // wie connect-src in _headers (Hauptordner)
  const bad = watch(page, baseURL!, allowed);
  const seen: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'blob:' || u.protocol === 'data:' || u.origin === new URL(baseURL!).origin) return;
    seen.push(`${r.method()} ${u.host}${u.pathname}`);
    // Bilddaten in der URL: data-/blob-Verweise, Base64-Brocken oder auffällig lange Adressen
    if (/data:|blob:|base64|[A-Za-z0-9+/=]{200}/.test(r.url()) || r.url().length > 300) bad.push(`Bilddaten? ${r.url()}`);
  });
  // Im Worker meldet Edge CSP-Sperren nicht an Playwright: CSP am Worker-Skript entfernen, damit jeder Versuch als Request sichtbar wird
  // (die CSP selbst prüft smoke.spec), und alles ausser den Modell-Hosts abbrechen, damit nichts wirklich hinausgeht.
  let workerScripts = 0;
  await page.route('**/assets/segmentWorker-*.js', async (route) => {
    workerScripts++;
    const res = await route.fetch();
    const headers = { ...res.headers() };
    delete headers['content-security-policy'];
    await route.fulfill({ response: res, headers });
  });
  await page.route((u) => u.origin !== new URL(baseURL!).origin && !allowed(u.host), (route) => route.abort());
  const prefix = `/${cutout.model.id}/resolve/${cutout.model.revision}/`;
  await page.route(`https://${modelHost}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('.onnx')) return route.fulfill({ status: 302, headers: { location: `https://stub.cdn.hf.co${path}`, 'access-control-allow-origin': '*' } });
    const body = path.endsWith('/config.json') ? { model_type: 'isnet' } : { image_processor_type: 'ViTFeatureExtractor', size: { width: 1024, height: 1024 } };
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });

  await openPhoto(page, 'Netz Modell', BOX, { crop: { x: 0, y: 0, scale: 1 } }, cutoutPhoto, [540, 675]);
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  await maskBtn(page, 'Hintergrund entfernen').click();
  await expect(page.locator('.notice')).toContainText(modelHost, { timeout: 30000 });
  await expect(maskBtn(page, 'Hintergrund entfernen')).toHaveAttribute('aria-disabled', 'false');

  expect(workerScripts).toBeGreaterThan(0); // ein umbenannter Worker darf den Test nicht grün machen
  expect(bad).toEqual([]);
  const files = ['config.json', 'preprocessor_config.json', `onnx/model_${cutout.model.dtype}.onnx`];
  expect([...new Set(seen)].sort()).toEqual(
    [...files.map((f) => `GET ${modelHost}${prefix}${f}`), `GET stub.cdn.hf.co${prefix}onnx/model_${cutout.model.dtype}.onnx`].sort(),
  );
  expect(seen.some((s) => /jsdelivr|unpkg|cdnjs/.test(s))).toBe(false);
});
