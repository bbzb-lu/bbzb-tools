/** Einzige Quelle der Oberflächen-Tokens aller Tools. Banner-Farben stehen in apps/news-banner/src/tokens.ts. */
export const theme = {
  table: '#FFFFFF', // Arbeitsfläche aller Tools: weiss (Entscheid 11.11.2026, vorher Mittelgrau)
  paper: '#F2F2F2',
  'paper-shade': '#E3E3E3',
  ink: '#232323',
  'ink-soft': '#454545',
  line: '#23232340',
  accent: '#0077B6',
  'on-accent': '#FFFFFF',
  vegi: '#24733A', // Vegan/Vegetarisch-Badge, Text in on-accent (5.85:1)
  illu: '#4421DE', // Verläufe der Kachel-Illustrationen auf der Startseite
  'illu-dunkel': 'color-mix(in srgb, var(--illu) 78%, black)', // Stufen von illu: Glücksrad-Segmente
  'illu-mittel': 'color-mix(in srgb, var(--illu) 55%, white)',
  'illu-hell': 'color-mix(in srgb, var(--illu) 25%, white)',
  // Nur für die Effekte des Wahnsinn-Modus im Glücksrad
  'fx-rot': '#FF2D55',
  'fx-orange': '#FF8A00',
  'fx-gelb': '#FFE600',
  'fx-gruen': '#00E676',
  'fx-cyan': '#00E5FF',
  'fx-magenta': '#FF00E5',
  'ink-disabled': '#646464',
  scrollbar: '14px',
  'font-ui': '"Host Grotesk", "Segoe UI", system-ui, sans-serif',
} as const;

/** Schreibt alle `--…`-Variablen auf `root`. */
export function applyTheme(root: HTMLElement): void {
  for (const [name, v] of Object.entries(theme)) root.style.setProperty(`--${name}`, v);
}
