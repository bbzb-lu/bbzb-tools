import { colors, range, scrollbar, slider } from '../tokens';

/** Oberflächen-Tokens des Editors (Werte aus den Variablen des Pen-Entwurfs docs/design/editor.pen). Nie Slide-Farben. */
export const theme = {
  table: '#B5B5B5',
  paper: '#F2F2F2',
  'paper-shade': '#E3E3E3',
  ink: '#232323',
  'ink-soft': '#454545',
  line: '#23232340',
  'riso-pink': '#C8366C',
  'riso-green': '#2E6B57',
  'riso-mustard': '#E3A92B',
  accent: '#0077B6',
  'on-accent': '#FFFFFF',
  'ink-disabled': '#646464',
  'unterlage-grau': '#B5B5B5',
  'unterlage-dunkel': '#4A4A4A',
  'unterlage-gruen': '#3F6B52',
  'unterlage-blau': '#3C6A8F',
  /** Schatten über und unter der Slide unter dem Zeiger (Tinte bzw. auf «dunkel» Papier, mit Alpha). */
  'slide-glow': '#23232373',
  'slide-glow-hell': '#F2F2F240',
} as const;

export type ThemeToken = keyof typeof theme;

/** Familien der Oberfläche. Fehlen die Dateien, greifen die System-Schriften; der Export bleibt unberührt. */
export const uiFonts = [
  { family: 'Host Grotesk', weight: '400', url: '/fonts/host-grotesk-latin-400-normal.woff2', label: 'Host Grotesk' },
  { family: 'Host Grotesk', weight: '600', url: '/fonts/host-grotesk-latin-600-normal.woff2', label: 'Host Grotesk SemiBold' },
  { family: 'Host Grotesk', weight: '700', url: '/fonts/host-grotesk-latin-700-normal.woff2', label: 'Host Grotesk Bold' },
  { family: 'Host Grotesk', weight: '800', url: '/fonts/host-grotesk-latin-800-normal.woff2', label: 'Host Grotesk ExtraBold' },
  { family: 'Newsreader', weight: '400', url: '/fonts/newsreader-latin-400-normal.woff2', label: 'Newsreader' },
] as const;

export const themeFonts = {
  'font-ui': '"Host Grotesk", "Segoe UI", system-ui, sans-serif',
  'font-serif': '"Newsreader", Georgia, serif',
} as const;

/** Schreibt alle `--…`-Variablen der Oberfläche (und die Slide-Farben für Overlays) auf `root`. */
export function applyTheme(root: HTMLElement): void {
  const set = (name: string, value: string) => root.style.setProperty(`--${name}`, value);
  for (const [name, hex] of Object.entries(colors)) set(name, hex);
  for (const [name, v] of Object.entries(theme)) set(name, v);
  for (const [name, v] of Object.entries(themeFonts)) set(name, v);
  for (const [name, v] of Object.entries({ track: slider.track, thumb: slider.thumb, 'thumb-height': slider.thumbHeight, hit: slider.hit })) set(`slider-${name}`, `${v}px`);
  for (const [name, v] of Object.entries({ handle: range.handle, 'handle-height': range.handleHeight, bar: range.bar, rail: range.rail })) set(`range-${name}`, `${v}px`);
  set('scrollbar', `${scrollbar.size}px`);
}

/** Lädt die Oberflächen-Schriften; wirft nie, bei Fehler bleibt der System-Fallback. */
export async function loadUiFonts(): Promise<void> {
  await Promise.allSettled(uiFonts.map((f) => document.fonts.load(`${f.weight} 1em "${f.family}"`, 'Äöüé')));
}
