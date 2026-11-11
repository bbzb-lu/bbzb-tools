import { create } from 'zustand';
import { brush as brushTokens } from '../tokens';

export type BrushMode = 'hide' | 'show';
/** Pinsel der Maske: Durchmesser in Slide-Pixeln, Härte in Prozent (0 weich, 100 hart), Ausblenden oder Einblenden. */
export interface Brush {
  size: number;
  hardness: number;
  mode: BrushMode;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isNaN(v) ? min : v));

export interface Notice {
  kind: 'error' | 'info';
  text: string;
}

/**
 * Rückgängig-Hinweis nach dem Löschen: gilt, solange `project` (Stand nach der Aktion) das geöffnete Dokument ist, die Aktion also die letzte in der History,
 * und bis `until` (Date.now(), Infinity solange Zeiger oder Fokus ihn halten).
 */
export interface UndoHint {
  text: string;
  project: object;
  until: number;
}

export interface AiRun {
  id: string;
  phase: 'download' | 'run';
  fraction: number;
}

/** Farbe der Arbeitsfläche um die Slides (Tokens `--unterlage-…` in theme.ts). Nur Ansicht: nie im Projekt, in der History oder im Export. */
export const BACKDROPS = ['grau', 'dunkel', 'gruen', 'blau'] as const;
export type Backdrop = (typeof BACKDROPS)[number];
const BACKDROP_KEY = 'social-studio.unterlage';

/** Gemerkte Unterlage; gesperrter Speicher oder ungültiger Wert ergibt «grau». */
export function readBackdrop(): Backdrop {
  try {
    const v = localStorage.getItem(BACKDROP_KEY);
    return BACKDROPS.find((b) => b === v) ?? 'grau';
  } catch {
    return 'grau';
  }
}

interface UiState {
  /** Auswahl; `selectedId` ist abgeleitet: genau eine Id, sonst null. */
  selectedIds: string[];
  selectedId: string | null;
  currentSlide: number;
  cropEditId: string | null;
  textEditId: string | null;
  /** Pinselmodus: Foto, dessen Maske bemalt wird. Schliesst Ausschnitt und Text aus, endet mit jeder anderen Auswahl. Nie in der History. */
  maskEditId: string | null;
  /** Ansicht im Pinselmodus: rote Folie über Ausgeblendetem oder das Foto mit der Maske wie im Export. Gilt für die Sitzung (Standard Folie), nicht persistiert. */
  maskView: 'folie' | 'ergebnis';
  setMaskView(v: UiState['maskView']): void;
  /** Pinselwerte (Ansicht, nicht persistiert, nicht in der History). */
  brush: Brush;
  notice: Notice | null;
  undoHint: UndoHint | null;
  setUndoHint(h: UndoHint | null): void;
  /** Laufendes KI-Freistellen (höchstens eines): Foto, Phase, Anteil 0 bis 1. Nie in der History, nicht persistiert. */
  ai: AiRun | undefined;
  setAi(ai: AiRun | undefined): void;
  missingFonts: string[];
  fontsReady: boolean;
  /** Ein neues Projekt wurde angelegt: die Slide-Leiste öffnet die Layout-Wahl einmal. Nicht persistiert. */
  chooseLayoutOnStart: boolean;
  /** Ansicht, × Einpass-Massstab; nicht persistiert, nicht in der History. */
  zoom: number;
  /** Sicherheitszonen einblenden: Ansicht wie der Zoom, nicht persistiert (Standard aus), nicht in der History. */
  safeZones: boolean;
  setSafeZones(v: boolean): void;
  stageBackdrop: Backdrop;
  setStageBackdrop(b: Backdrop): void;
  /** Reiter im Fach links. Nur Sitzung, nicht persistiert. */
  leftTab: 'bibliothek' | 'ebenen';
  setLeftTab(t: UiState['leftTab']): void;
  /** Aufgeklappte Abschnitte des Eigenschaften-Panels (Schlüssel = Abschnitts-Id). Nur Sitzung, nicht persistiert. */
  openSections: Record<string, boolean>;
  /** `def`: Zustand, solange der Abschnitt nie umgeschaltet wurde. */
  toggleSection(id: string, def?: boolean): void;
  /** Ein Regler wird gerade bewegt: Effekte rechnen dann eine Vorschau in kleiner Auflösung. */
  sliding: boolean;
  setSliding(v: boolean): void;
  /** Zähler: Strg + E bittet den Export-Dialog, sich zu öffnen. Nicht persistiert. */
  exportRequest: number;
  requestExport(): void;
  setSelectedIds(ids: string[]): void;
  setSelectedId(id: string | null): void;
  setCurrentSlide(i: number): void;
  setCropEditId(id: string | null): void;
  setTextEditId(id: string | null): void;
  setMaskEditId(id: string | null): void;
  /** Grösse auf `brush.size` begrenzt, Härte auf 0 bis 100. */
  setBrush(patch: Partial<Brush>): void;
  /** Tastenkürzel: Grösse um einen Schritt (Faktor `brush.step`, mindestens 1 px) grösser (1) oder kleiner (−1). */
  stepBrush(dir: 1 | -1): void;
  swapBrushMode(): void;
  setNotice(n: Notice | null): void;
  setFonts(missing: string[]): void;
  /** Zoom für Screenreader: gesetzt nur bei Buttons und Tasten (0 = nichts ansagen), nicht bei Rad und Pinch. */
  zoomLive: number;
  setZoom(z: number, announce?: boolean): void;
}

export const useUi = create<UiState>()((set, get) => ({
  selectedIds: [],
  selectedId: null,
  currentSlide: 0,
  cropEditId: null,
  textEditId: null,
  maskEditId: null,
  maskView: 'folie',
  setMaskView: (maskView) => set({ maskView }),
  brush: { size: brushTokens.size.default, hardness: brushTokens.hardness.default, mode: 'hide' },
  notice: null,
  undoHint: null,
  setUndoHint: (undoHint) => set({ undoHint }),
  ai: undefined,
  setAi: (ai) => set({ ai }),
  missingFonts: [],
  fontsReady: false,
  chooseLayoutOnStart: false,
  zoom: 1,
  safeZones: false,
  setSafeZones: (safeZones) => set({ safeZones }),
  stageBackdrop: readBackdrop(),
  setStageBackdrop: (stageBackdrop) => {
    set({ stageBackdrop });
    try {
      localStorage.setItem(BACKDROP_KEY, stageBackdrop);
    } catch {
      /* kein Speicher: gilt nur für diese Sitzung */
    }
  },
  leftTab: 'bibliothek',
  setLeftTab: (leftTab) => set({ leftTab }),
  openSections: {},
  toggleSection: (id, def = false) => set((s) => ({ openSections: { ...s.openSections, [id]: !(s.openSections[id] ?? def) } })),
  sliding: false,
  setSliding: (sliding) => set({ sliding }),
  exportRequest: 0,
  requestExport: () => set((s) => ({ exportRequest: s.exportRequest + 1 })),
  // Pinselmodus endet, sobald etwas anderes gewählt ist (Klick auf ein anderes Element, ins Leere, Löschen)
  setSelectedIds: (selectedIds) =>
    set((s) => ({
      selectedIds,
      selectedId: selectedIds.length === 1 ? selectedIds[0] : null,
      maskEditId: selectedIds.length === 1 && selectedIds[0] === s.maskEditId ? s.maskEditId : null,
    })),
  setSelectedId: (id) => get().setSelectedIds(id ? [id] : []),
  setCurrentSlide: (currentSlide) => set({ currentSlide }),
  // Ausschnitt und Textbearbeitung gehen nur bei einem Element: Bearbeiten wählt es allein
  // Pinselmodus und Ausschnitt schliessen sich aus
  setCropEditId: (cropEditId) => set(cropEditId ? { cropEditId, maskEditId: null, selectedIds: [cropEditId], selectedId: cropEditId } : { cropEditId }),
  setTextEditId: (textEditId) => set(textEditId ? { textEditId, maskEditId: null, selectedIds: [textEditId], selectedId: textEditId } : { textEditId }),
  setMaskEditId: (maskEditId) =>
    set(maskEditId ? { maskEditId, cropEditId: null, textEditId: null, selectedIds: [maskEditId], selectedId: maskEditId } : { maskEditId }),
  setBrush: (patch) =>
    set((s) => {
      const b = { ...s.brush, ...patch };
      return { brush: { ...b, size: Math.round(clamp(b.size, brushTokens.size.min, brushTokens.size.max)), hardness: clamp(b.hardness, 0, 100) } };
    }),
  stepBrush: (dir) => {
    const { size } = get().brush;
    const next = dir > 0 ? Math.max(size + 1, size * brushTokens.step) : Math.min(size - 1, size / brushTokens.step);
    get().setBrush({ size: next });
  },
  swapBrushMode: () => set((s) => ({ brush: { ...s.brush, mode: s.brush.mode === 'hide' ? 'show' : 'hide' } })),
  setNotice: (notice) => set({ notice }),
  setFonts: (missingFonts) => set({ missingFonts, fontsReady: true }),
  zoomLive: 0,
  setZoom: (zoom, announce = false) => set({ zoom, zoomLive: announce ? zoom : 0 }),
}));
