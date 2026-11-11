/** Einzige Tabelle der Tastenkürzel zur Anzeige (Tooltips, Hilfe). Die Handler stehen in shortcuts.ts. */
export const KEYS = {
  undo: ['Strg', 'Z'],
  redo: ['Strg', 'Umschalt', 'Z'],
  duplicate: ['Strg', 'D'],
  remove: ['Entf'],
  selectAll: ['Strg', 'A'],
  copy: ['Strg', 'C'],
  cut: ['Strg', 'X'],
  paste: ['Strg', 'V'],
  nudge: ['Pfeiltasten'],
  zoomIn: ['Strg', '+'],
  zoomOut: ['Strg', '−'],
  zoomFit: ['Strg', '0'],
  save: ['Strg', 'S'],
  export: ['Strg', 'E'],
  deselect: ['Esc'],
  pan: ['Leertaste', 'ziehen'],
  /** Pinselmodus: Ausblenden und Einblenden tauschen. Die Grösse ([ ] − +) steht im Tooltip des Reglers. */
  brushSwap: ['X'],
} as const;

/** Für `data-keys`: Teile mit «+» getrennt, z. B. «Strg+Z». */
export const keysAttr = (k: readonly string[]): string => k.join('+');
