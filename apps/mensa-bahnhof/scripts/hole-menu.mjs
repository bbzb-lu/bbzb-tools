// Liest das SV-Menü mit Playwright und schreibt public/menu.json. Aufruf: node hole-menu.mjs [--ziel YYYY-MM-DD]
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { QUELLE, gueltig, isoDatum, parseLinien, pruefeWoche, zielMontag } from '../src/menu.ts';

const DATEI = new URL('../public/menu.json', import.meta.url);
const i = process.argv.indexOf('--ziel');
const ziel = i > 0 ? process.argv[i + 1] : zielMontag(new Date());

let alt;
try { alt = JSON.parse(readFileSync(DATEI, 'utf8')); } catch { /* erste Ausführung */ }
if (gueltig(alt, ziel)) { console.log(`unverändert: ${ziel}`); process.exit(0); }

const browser = await chromium.launch();
const wochen = [];
let vorherReiter = '';
try {
  const page = await (await browser.newContext({ locale: 'de-CH' })).newPage(); // sonst liefert SV die englische Seite
  await page.goto(QUELLE, { waitUntil: 'load' }); // networkidle kommt wegen Firestore nie
  await page.getByText('Diese Woche').first().waitFor();
  await page.getByText('ALLE ABLEHNEN').click();
  for (const name of ['Diese Woche', 'Nächste Woche']) {
    await page.locator('mat-select').first().click();
    await page.locator('mat-option', { hasText: name }).click();
    const reiter = page.locator('a.mat-mdc-tab-link');
    // fertig: neue Reiter (anderer Text als zuvor) oder «Keine Daten» ohne Reiter, sonst hängen noch die alten da
    await page.waitForFunction((alt) => {
      const text = [...document.querySelectorAll('a.mat-mdc-tab-link')].map((a) => a.textContent).join();
      return text ? text !== alt : document.body.innerText.includes('Keine Daten');
    }, vorherReiter);
    vorherReiter = (await reiter.allTextContents()).join();
    const tage = [];
    for (let n = 0; n < await reiter.count(); n++) {
      const tab = reiter.nth(n);
      const [, tagMonat] = (await tab.innerText()).split('\n').map((z) => z.trim());
      await tab.click();
      await page.waitForFunction((t) => document.querySelector('a.mdc-tab--active')?.textContent.includes(t), tagMonat);
      const inhalt = page.locator('mat-card-content.menu-wrapper');
      let text = '', vorher;
      do { // warten, bis der Inhalt zweimal gleich ist
        vorher = text;
        await page.waitForTimeout(300);
        text = (await inhalt.count()) ? await inhalt.first().innerText() : '';
      } while (text !== vorher);
      tage.push({ datum: isoDatum(tagMonat, ziel), linien: parseLinien(text) });
    }
    if (tage[0]) wochen.push({ montag: tage[0].datum, tage });
  }
} finally {
  await browser.close();
}

wochen.sort((a, b) => a.montag.localeCompare(b.montag));
const fehler = pruefeWoche(wochen.find((w) => w.montag === ziel), ziel);
if (fehler) { console.error(fehler); process.exit(1); }

const neu = { geholt: new Date().toISOString(), quelle: QUELLE, wochen };
if (JSON.stringify({ ...alt, geholt: 0 }) === JSON.stringify({ ...neu, geholt: 0 })) console.log(`unverändert: ${ziel}`);
else { writeFileSync(DATEI, JSON.stringify(neu, null, 2) + '\n'); console.log(`geschrieben: ${ziel}`); }
