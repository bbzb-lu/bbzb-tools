import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { BrandAsset } from '../brand/manifest';
import type { Element, Project } from '../model/types';
import type { AssetStore } from '../storage/assets';
import type { Channel, ColorToken } from '../tokens';

export interface FormatPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface Exporter {
  id: string;
  label: string;
  extension: string;
  /** `quality` 0..1 für verlustbehaftete Formate (JPEG); ohne Angabe der Standard. */
  encode(canvas: HTMLCanvasElement, quality?: number): Promise<Blob>;
}

/** Phase 3: Video-Export einer Slide (MP4). */
export interface VideoExporter {
  id: string;
  label: string;
  extension: string;
  /** Vor der ersten Slide jedes Exports: Vorschau beenden; bei Video-Slides prüfen, ob Edge sie kodieren kann (sonst ExportError), Encoder anwärmen. */
  prepare(p: Project, videoSlides: number[]): Promise<void>;
  encode(job: VideoJob): Promise<Uint8Array>;
}

export interface VideoJob {
  project: Project;
  index: number;
  /** Slide in Formatgrösse; `frames` ersetzt das Bild von Video-Elementen (Id → Bildbereich mit Effekten). Aufrufer gibt die Canvas frei. */
  render(frames: Map<string, HTMLCanvasElement>): HTMLCanvasElement;
  /** Fortschritt der Slide in Prozent, je Frame. */
  onProgress(percent: number): void;
  signal?: AbortSignal;
}

export interface EditorContext {
  project: Project;
  currentSlide: number;
  apply(recipe: (d: Project) => void): void;
  assets: AssetStore;
  select(id: string | null): void;
  notify(kind: 'error' | 'info', text: string): void;
}

/** editing = Ausschnitt- bzw. Textmodus. */
export interface ElementRenderProps<P> {
  el: Element<P>;
  editing: boolean;
}

/** Eintrag des Rechtsklickmenüs; `disabled` nennt den Grund (bleibt fokussierbar). `keys` im Format von `data-keys`, z. B. «Strg+C». */
export type MenuAction = { id: string; label: string; keys?: string; disabled?: string; /** Symbol vor dem Namen, nur im Untermenü. */ icon?: ComponentType; run(): void };
/** Mit `sub` öffnet der Eintrag ein Untermenü (Pfeil rechts, Klick, Zeiger) und `run` bleibt ohne Wirkung. */
export type MenuItem = (MenuAction & { sub?: MenuAction[] }) | { separator: true };

export interface ElementType<P = unknown> {
  id: string;
  label: string;
  propsSchema: z.ZodType<P>;
  /** Konva-Gruppe mit id = el.id, draggable wenn !locked. */
  Render: ComponentType<ElementRenderProps<P>>;
  Inspector?: ComponentType<{ el: Element<P> }>;
  /** Typ-eigene Icon-Knöpfe in der Zeile «Ebene» des Inspectors (z. B. Spiegeln), vor «Löschen». */
  LayerActions?: ComponentType<{ el: Element<P> }>;
  /** Typ-eigene Einträge des Rechtsklickmenüs, nur bei genau einem gewählten Element. */
  menuItems?(el: Element<P>): MenuItem[];
  /** Konva Transformer enabledAnchors. */
  anchors: string[];
  /** `project`: Projekt des Elements, wenn es nicht das geöffnete ist (Format-Kopie auf der Startseite). */
  afterTransform(
    el: Element<P>,
    box: { x: number; y: number; width: number; height: number; rotation: number },
    project?: Project,
    /** Nur beim Skalieren einer Gruppe: der Inhalt (Text: Schriftgrösse) skaliert mit. Format-Kopie und Layoutwechsel setzen es nicht. */
    scaleContent?: boolean,
  ): Partial<Element<P>>;
  add?: { label: string; icon?: ComponentType; run(ctx: EditorContext): Promise<void> | void };
  acceptsFile?(file: File): boolean;
  fromFile?(file: File, ctx: EditorContext): Promise<void>;
  /** Varianten, die die Brand Library direkt einfügt (z. B. Tags); `insertVariant` wie `fromAsset` mit optionalem Ablagepunkt `at`. */
  variants?: { id: string; label: string }[];
  insertVariant?(variant: string, ctx: EditorContext, at?: { x: number; y: number }): Promise<void>;
  acceptsAsset?(asset: BrandAsset): boolean;
  /** Markenbild einfügen (Brand Library): ohne `at` mittig auf die aktuelle Slide, sonst mit der Mitte bei `at` (globale Koordinaten). */
  fromAsset?(asset: BrandAsset, ctx: EditorContext, at?: { x: number; y: number }): Promise<void>;
  /**
   * Element aus Layoutdaten fertigstellen: Standardwerte ausdrücklich setzen (Korn, Look, Ruling R10) und die Grösse messen
   * (Texthöhe, Tagbreite). Erst nach dem Laden der Schriften aufrufen. `fresh`: neuer Platzhalter ohne übernommenen Inhalt.
   */
  fromLayout?(el: Element<P>, project?: Project, fresh?: boolean): Element<P>;
  /** Kanalwechsel des Projekts: Element für den neuen Kanal (Text, Grösse messen) oder undefined, wenn es gleich bleibt. Schriften müssen geladen sein. */
  onChannel?(el: Element<P>, channel: Channel): Element<P> | undefined;
  /**
   * Layoutwechsel: Platzhalter `into` (aus den Layoutdaten, vor fromLayout) mit dem Inhalt von `from` (gleicher Typ) füllen;
   * undefined, wenn `from` leer ist oder nicht passt. Ohne diese Funktion trägt der Typ keinen Inhalt (Deko des Layouts).
   * `base`: Platzhalter des bisherigen Layouts, aus dem `from` stammt; was dort gleich ist, folgt dem neuen Layout (R8).
   */
  takeContent?(into: Element<P>, from: Element<P>, project: Project, base?: Element<P>): Element<P> | undefined;
  /** Trägt das Element Inhalt der Nutzer:innen? Ohne Angabe: ja, wenn `takeContent` da ist (leerer Foto-Platzhalter: nein). */
  hasContent?(el: Element<P>): boolean;
  /** Platzhalter mit einer Datei füllen oder ersetzen (Drop, «Foto wählen»), ein Undo-Schritt. */
  fillFromFile?(el: Element<P>, file: File, ctx: EditorContext): Promise<void>;
}

/** Element eines Layouts: Koordinaten relativ zur (linken) Slide, Masse wie im Format des Layouts. */
export interface LayoutElement {
  type: string;
  /** Platzhalter-Rolle, wird zu `Element.role`. */
  role: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** Rechter Rand bleibt bei x + width, wenn die gemessene Breite abweicht (rechtsbündige Tags). */
  anchorRight?: boolean;
  /** Props des Elementtyps; leerer Foto-Platzhalter: ohne assetId. */
  props: Record<string, unknown>;
}

/** Layout als reine Daten (neue Layouts brauchen keinen Code). */
export interface LayoutPreset {
  id: string;
  label: string;
  /** Gleicher Wert verbindet ein Post-Layout mit seiner Story-Variante (Ruling R6). */
  family?: string;
  /** Format-Id, für die die Koordinaten gelten (Story-Varianten sind eigene Presets). */
  format: string;
  /** Anzahl belegter Slides (Panorama 2). */
  slides: number;
  /** Hintergrund der belegten Slides. */
  background: ColorToken;
  /** Korn der belegten Slides (wie Slide.grain); fehlt = aus. Verläufe setzt der Foto-Platzhalter (`scrim`). */
  grain?: boolean;
  /** Unten → oben. */
  elements: LayoutElement[];
}

/** Paket aus Markenbildern (Scribbles, Icons, Texturen) samt Ladefehlern für die Brand Library. */
export interface AssetPack {
  id: string;
  label: string;
  assets: BrandAsset[];
  /** Deutsche Meldungen zu kaputten Einträgen oder fehlenden Dateien. */
  errors: string[];
}

/**
 * Bildeffekt (Korn, BBZB-Look, Bildregler). Läuft nur, wenn sich die Eingaben ändern, auf einer
 * vorberechneten Canvas, die Editor und Export gemeinsam zeigen; nie pro Frame.
 */
export interface Effect<P = unknown> {
  id: string;
  label: string;
  /** false bei neutralen Werten: dann läuft der Effekt nicht (ohne aktive Effekte gar keine Canvas). */
  active(params: P): boolean;
  /** Ändert die Pixel der Canvas, die das Element schon enthält. `scale` = Canvas-Pixel je Slide-Pixel. */
  apply(ctx: CanvasRenderingContext2D, params: P, scale: number): Promise<void> | void;
}

/**
 * KI-Werkzeug (z. B. Freistellen): läuft ausserhalb des Hauptthreads und liefert pro Pixel einen Alphawert (255 = Motiv).
 * Das Raster deckt das ganze Foto ab, auch gestreckt (z. B. quadratisch): `maskFromAlpha` skaliert x und y getrennt.
 */
export interface AiTool {
  id: string;
  name: string;
  run(
    image: Blob,
    opts: { signal: AbortSignal; onProgress(p: { phase: 'download' | 'run'; fraction: number }): void },
  ): Promise<{ width: number; height: number; alpha: Uint8ClampedArray }>;
}

/**
 * Zustand der Kontextleiste über der Leinwand (Ausschnitt, KI läuft, Video …). Es ist immer höchstens eine Leiste sichtbar:
 * die aktive mit dem kleinsten `rank`. `active` liest die Stores direkt (ohne React), `Bar` zeichnet die Leiste.
 */
export interface ContextBarState {
  id: string;
  rank: number;
  active(): boolean;
  /** Text für die gemeinsame Live-Region (nur was angesagt werden soll, ohne Prozent); die aktive mit kleinstem Rang und Text gewinnt. */
  announce?(): string;
  Bar: ComponentType;
}
