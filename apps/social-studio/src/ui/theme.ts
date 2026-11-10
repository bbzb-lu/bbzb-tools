import { applyTheme, theme as uiTheme } from '@bbzb/ui';
import hg400 from '@bbzb/ui/fonts/host-grotesk-latin-400-normal.woff2?url';
import hg600 from '@bbzb/ui/fonts/host-grotesk-latin-600-normal.woff2?url';
import hg700 from '@bbzb/ui/fonts/host-grotesk-latin-700-normal.woff2?url';
import hg800 from '@bbzb/ui/fonts/host-grotesk-latin-800-normal.woff2?url';
import nr400 from '@bbzb/ui/fonts/newsreader-latin-400-normal.woff2?url';
import { colors, range, slider } from '../tokens';

/** Studio-eigene Oberflächen-Tokens (Werte aus den Variablen des Pen-Entwurfs docs/design/editor.pen). Gemeinsame Tokens kommen aus @bbzb/ui. Nie Slide-Farben. */
export const studioTheme = {
  'riso-pink': '#C8366C',
  'riso-green': '#2E6B57',
  'riso-mustard': '#E3A92B',
  'unterlage-grau': '#B5B5B5',
  'unterlage-dunkel': '#4A4A4A',
  'unterlage-gruen': '#3F6B52',
  'unterlage-blau': '#3C6A8F',
  /** Schatten über und unter der Slide unter dem Zeiger (Tinte bzw. auf «dunkel» Papier, mit Alpha). */
  'slide-glow': '#23232373',
  'slide-glow-hell': '#F2F2F240',
} as const;

/** Alle Oberflächen-Tokens, die das Studio sieht: gemeinsame aus @bbzb/ui plus die eigenen. */
export const theme = { ...uiTheme, ...studioTheme } as const;

export type ThemeToken = keyof typeof theme;

/** Familien der Oberfläche (Dateien aus @bbzb/ui). Fehlen sie, greifen die System-Schriften; der Export bleibt unberührt. */
export const uiFonts = [
  { family: 'Host Grotesk', weight: '400', url: hg400, label: 'Host Grotesk' },
  { family: 'Host Grotesk', weight: '600', url: hg600, label: 'Host Grotesk SemiBold' },
  { family: 'Host Grotesk', weight: '700', url: hg700, label: 'Host Grotesk Bold' },
  { family: 'Host Grotesk', weight: '800', url: hg800, label: 'Host Grotesk ExtraBold' },
  { family: 'Newsreader', weight: '400', url: nr400, label: 'Newsreader' },
] as const;

/** Schreibt die Slide-Farben (für Overlays), die gemeinsamen `--…`-Variablen, die Studio-Tokens und die Reglermasse auf `root`. */
export function applyStudioTheme(root: HTMLElement): void {
  const set = (name: string, value: string) => root.style.setProperty(`--${name}`, value);
  for (const [name, hex] of Object.entries(colors)) set(name, hex);
  applyTheme(root);
  for (const [name, v] of Object.entries(studioTheme)) set(name, v);
  for (const [name, v] of Object.entries({ track: slider.track, thumb: slider.thumb, 'thumb-height': slider.thumbHeight, hit: slider.hit })) set(`slider-${name}`, `${v}px`);
  for (const [name, v] of Object.entries({ handle: range.handle, 'handle-height': range.handleHeight, bar: range.bar, rail: range.rail })) set(`range-${name}`, `${v}px`);
}

/** Lädt die Oberflächen-Schriften; wirft nie, bei Fehler bleibt der System-Fallback. */
export async function loadUiFonts(): Promise<void> {
  await Promise.allSettled(uiFonts.map((f) => document.fonts.load(`${f.weight} 1em "${f.family}"`, 'Äöüé')));
}
