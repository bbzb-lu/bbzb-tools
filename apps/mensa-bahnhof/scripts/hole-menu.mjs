// Liest das SV-Menü mit Playwright und schreibt public/menu.json. Aufruf: node hole-menu.mjs [--ziel YYYY-MM-DD]
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { QUELLE, gueltig, isoDatum, parseLinien, pruefeWoche, zielMontag } from '../src/menu.ts';

const DATEI = new URL('../public/menu.json', import.meta.url);
const i = process.argv.indexOf('--ziel');
const ziel = i > 0 ? process.argv[i + 1] : zielMontag(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(ziel ?? '')) { console.error(`--ziel erwartet YYYY-MM-DD, nicht «${ziel}»`); process.exit(1); }

let alt;
try { alt = JSON.parse(readFileSync(DATEI, 'utf8')); } catch { /* erste Ausführung */ }
if (gueltig(alt, ziel)) { console.log(`unverändert: ${ziel}`); process.exit(0); }

const browser = await chromium.launch();
const wochen = [];
let vorherReiter = '';
let vorherText = '';

// Inhalt des geklickten Tags: leer nur mit SV-Leermarker (app-menu-no-data), sonst mind. eine Preiszeile.
// Muss sich vom Vortag unterscheiden (Fallback nach 4 s: Tage dürfen gleich sein) und zweimal gleich gelesen werden. Sonst Fehler.
async function lies(page, vorher) {
  let letzter;
  for (let t = 0; t < 40; t++) {
    await page.waitForTimeout(250);
    const leer = (await page.locator('app-menu-no-data').count()) > 0;
    const wrapper = page.locator('mat-card-content.menu-wrapper');
    const text = leer ? '' : (await wrapper.count()) ? await wrapper.first().innerText() : null;
    const ok = text === '' || (text !== null && /CHF\s+[\d.]+/.test(text) && (text !== vorher || t >= 16));
    if (ok && text === letzter) return text;
    letzter = ok ? text : undefined;
  }
  throw new Error('Tagesinhalt nicht geladen');
}
try {
  const page = await (await browser.newContext({ locale: 'de-CH' })).newPage(); // sonst liefert SV die englische Seite
  await page.goto(QUELLE, { waitUntil: 'load' }); // networkidle kommt wegen Firestore nie
  await page.getByText('Diese Woche').first().waitFor();
  await page.getByText('ALLE ABLEHNEN').click({ timeout: 5000 }).catch(() => {}); // Banner fehlt je nach Region
  for (const name of ['Diese Woche', 'Nächste Woche']) {
    await page.locator('mat-select').first().click();
    await page.locator('mat-option', { hasText: name }).click();
    const reiter = page.locator('a.mat-mdc-tab-link');
    // fertig: neue Reiter (anderer Text als zuvor) oder «Keine Daten» ohne Reiter, sonst hängen noch die alten da
    await page.waitForFunction((alt) => {
      const text = [...document.querySelectorAll('a.mat-mdc-tab-link')].map((a) => a.textContent).join();
      return text ? text !== alt : !!document.querySelector('app-menu-no-data');
    }, vorherReiter);
    vorherReiter = (await reiter.allTextContents()).join();
    const tage = [];
    for (let n = 0; n < await reiter.count(); n++) {
      const tab = reiter.nth(n);
      const [, tagMonat] = (await tab.innerText()).split('\n').map((z) => z.trim());
      await tab.click();
      await page.waitForFunction((t) => document.querySelector('a.mdc-tab--active')?.textContent.includes(t), tagMonat);
      const text = await lies(page, vorherText);
      vorherText = text;
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
