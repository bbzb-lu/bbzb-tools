import type { Channel, ColorToken } from '../tokens';
import type { Scrim } from './scrim';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Slide {
  id: string;
  background: ColorToken;
  /** Zuletzt angewendetes Layout (Preset-Id, bei zwei Slides auf beiden). Fehlt in älteren Projekten (Ruling R8). */
  layout?: string;
  /** «Bitte prüfen» nach «Als anderes Format kopieren», bis die Slide als geprüft markiert ist. Fehlt sonst (Ruling R8). */
  review?: boolean;
  /** Verknüpfte Slides (Panorama): direkt aufeinanderfolgende Slides mit derselben Id bewegen sich zusammen. Fehlt = einzeln (Ruling R8). */
  link?: string;
  /** Filmkorn auf dem Hintergrund (40 %, filmkorn.opacityFlaeche). Fehlt = aus. */
  grain?: boolean;
  /** Korn-Stärke 0 bis 100 (Phase 4c.1, `grainOpacity`), nur bei `grain`. Fehlt = Standard 40. */
  grainStrength?: number;
  /** Verläufe über der Farbe, unter dem Korn (Phase 2.8), höchstens `scrim.max`, nie gespiegelt. Fehlt = keine. */
  scrims?: Scrim[];
}

export interface Element<P = unknown> {
  id: string;
  type: string;
  name: string;
  /** Globale Koordinaten, x/y = linke obere Ecke vor Drehung. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Grad, im Uhrzeigersinn, Drehpunkt (x, y) wie Konva-Standard. */
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  /**
   * Platzhalter aus einem Layout (z. B. «foto», «titel», «kommentar», «schulTag»): Rolle für das Umziehen der Inhalte beim
   * Layoutwechsel und in ein anderes Format. Fehlt bei frei gesetzten Elementen und in älteren Projekten (Ruling R8).
   */
  role?: string;
  props: P;
}

export interface AssetMeta {
  mime: string;
  width: number;
  height: number;
  name: string;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  /** Masse eingefroren, unabhängig von der Registry. */
  format: { id: string; width: number; height: number };
  createdAt: number;
  updatedAt: number;
  slides: Slide[];
  elements: Record<string, Element>;
  /** Unten → oben. */
  order: string[];
  /** Schlüssel = SHA-256-Hex. */
  assets: Record<string, AssetMeta>;
  /** Zuletzt gewählter Standort eines Schul-Tags, Vorgabe für neue Tags. Fehlt in älteren Projekten (Ruling R8). */
  lastTagLocation?: string;
  /** Kanal des Projekts (bestimmt den CTA-Text). Fehlt in älteren Projekten: Instagram (Ruling R8). */
  channel?: Channel;
  /** Akzentfarbe: fix Orange oder je Slide die Standortfarbe des Schul-Tags (Phase 2.5). Fehlt = «fix» (Ruling R8). */
  accentMode?: 'fix' | 'standort';
  /** Exportqualität (Phase 3.2): Video-Bitrate und JPEG-Qualität. Fehlt = «standard» (Ruling R8). */
  exportQuality?: 'klein' | 'standard' | 'hoch';
}

/** Bildinhalt relativ zum Rahmen. */
export interface Crop {
  x: number;
  y: number;
  scale: number;
}
