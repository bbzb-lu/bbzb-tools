// Erzeugt die Favicons aller Tools im Stil der Namensschilder: Quadrat mit hartem Schatten, Kürzel in Host Grotesk 800.
// Einmal von Hand laufen lassen (node scripts/favicons.mjs), die PNGs werden eingecheckt. Braucht Playwright mit Edge.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { theme } from '../packages/ui/src/theme.ts';

/** App-Ordner → Kürzel. Neues Tool: hier eintragen und das Skript laufen lassen. */
export const KUERZEL = { startseite: 'BT', 'social-studio': 'SS', 'news-banner': 'IT' };

const font = readFileSync('packages/ui/src/fonts/host-grotesk-latin-800-normal.woff2').toString('base64');

/** HTML für ein Icon der Grösse `s` px; `hell` füllt den Rand weiss (Apple ersetzt Transparenz durch Schwarz). */
export const html = (k, s, hell) => {
  const q = Math.round(s * 0.8);
  const off = Math.max(2, Math.round(s * 0.1));
  const rand = Math.max(1, Math.round(s / 24));
  return `<!doctype html><style>
@font-face { font-family: H; font-weight: 800; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html, body { margin: 0; width: ${s}px; height: ${s}px; background: ${hell ? theme.table : 'transparent'}; }
div { position: absolute; left: ${Math.floor((s - q - off) / 2)}px; top: ${Math.floor((s - q - off) / 2)}px; box-sizing: border-box; width: ${q}px; height: ${q}px;
  display: grid; place-items: center; border: ${rand}px solid ${theme.ink}; background: ${theme.paper}; box-shadow: ${off}px ${off}px 0 ${theme.ink};
  font: 800 ${Math.round(q * 0.5)}px/1 H; letter-spacing: -0.04em; color: ${theme.ink}; }
</style><div>${k}</div>`;
};

const browser = await chromium.launch({ channel: 'msedge' });
for (const [app, k] of Object.entries(KUERZEL)) {
  for (const [name, s, hell] of [['favicon.png', 32, false], ['apple-touch-icon.png', 180, true]]) {
    const page = await browser.newPage({ viewport: { width: s, height: s } });
    await page.setContent(html(k, s, hell));
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(`apps/${app}/public/${name}`, await page.screenshot({ omitBackground: !hell }));
    await page.close();
  }
}
await browser.close();
console.log('Favicons geschrieben:', Object.keys(KUERZEL).join(', '));
