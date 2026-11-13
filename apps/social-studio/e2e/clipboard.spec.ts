import { expect, test, type Page } from '@playwright/test';
import { addSlide, elements, newProject, png, toScreen } from './fixtures';

/** `paste`-Ereignis wie vom Browser, mit Dateien und/oder Text in clipboardData. */
/** Liefert `defaultPrevented`: false heisst, das native Einfügen bleibt unberührt. */
async function paste(page: Page, o: { text?: string; file?: { name: string; type: string; bytes: number[] } }) {
  return page.evaluate(({ text, file }) => {
    const dt = new DataTransfer();
    if (text !== undefined) dt.setData('text/plain', text);
    if (file) dt.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
    const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    (document.activeElement ?? document.body).dispatchEvent(e); // wie der Browser: an das fokussierte Element
    return e.defaultPrevented;
  }, o);
}

test('Strg + C auf Slide 1, Strg + V auf Slide 2: Kopie liegt am selben Abstand zur Slide-Ecke', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const el = (await elements(page)).at(-1)!;
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 123, y: 234, width: 300, height: 100 }), el.id);
  const p = await toScreen(page, 150, 250);
  await page.mouse.click(p.x, p.y); // Fokus auf die Leinwand
  await page.keyboard.press('ControlOrMeta+c');
  await addSlide(page);
  await page.keyboard.press('ControlOrMeta+v');
  const all = await elements(page);
  expect(all).toHaveLength(2);
  const copy = all.find((e) => e.id !== el.id)!;
  expect([copy.x - 1080, copy.y]).toEqual([123, 234]);
});

test('paste mit PNG-Datei erzeugt ein Foto', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const f = png(800, 600);
  await paste(page, { file: { name: 'Screenshot.png', type: f.mimeType, bytes: [...f.buffer] } });
  await expect.poll(async () => (await elements(page)).map((e) => e.type)).toEqual(['photo']);
});

test('paste mit fremdem Text ändert nichts, auch bei gefüllter interner Zwischenablage', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.keyboard.press('ControlOrMeta+c'); // internen Speicher füllen (Element bleibt gewählt)
  const before = (await elements(page)).length;
  expect(await paste(page, { text: 'Hallo' })).toBe(false); // nicht abgefangen
  // Danach ein PNG: genau ein Foto, also hat «Hallo» nichts eingefügt und die Verarbeitung ist durch
  const f = png(800, 600);
  await paste(page, { file: { name: 'a.png', type: f.mimeType, bytes: [...f.buffer] } });
  await expect.poll(async () => (await elements(page)).length).toBe(before + 1);
  expect((await elements(page)).filter((e) => e.type === 'photo')).toHaveLength(1);
});

test('paste mit PNG im Projektnamen-Feld legt kein Foto an', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.locator('.editor-header input').first().focus();
  const f = png(800, 600);
  expect(await paste(page, { file: { name: 'a.png', type: f.mimeType, bytes: [...f.buffer] } })).toBe(false);
  await page.waitForTimeout(300); // Negativprobe: kurz warten, ob doch ein Foto entsteht
  expect(await elements(page)).toHaveLength(0);
});

test('paste mit nicht unterstützter Datei zeigt die Meldung', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await paste(page, { file: { name: 'a.pdf', type: 'application/pdf', bytes: [37, 80, 68, 70] } });
  await expect(page.locator('.notice')).toContainText('Diese Datei kann ich nicht verwenden. Erlaubt sind Fotos.');
  expect(await elements(page)).toHaveLength(0);
});

const menuPaste = async (page: Page) => {
  const at = await toScreen(page, 300, 300);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await page.getByRole('menu', { name: 'Kontextmenü' }).getByRole('menuitem', { name: 'Einfügen', exact: true }).click();
};

const putPng = (page: Page) => {
  const f = png(800, 600);
  return page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }, [...f.buffer]);
};

test('Rechtsklick «Einfügen» ohne internen Inhalt legt das Bild aus der Systemablage als Foto an', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await newProject(page, 'Post 4:5');
  await putPng(page);
  await menuPaste(page);
  await expect.poll(async () => (await elements(page)).map((e) => e.type)).toEqual(['photo']);
});

test('Rechtsklick «Einfügen» ohne Berechtigung oder ohne Bild: Meldung «Einfügen: drücke Strg + V.»', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => navigator.clipboard.read = () => Promise.reject(new DOMException('', 'NotAllowedError')));
  await menuPaste(page);
  await expect(page.getByRole('alert')).toContainText('Einfügen: drücke Strg + V.');
  expect(await elements(page)).toHaveLength(0);
});
