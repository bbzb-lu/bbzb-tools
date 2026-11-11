import type Konva from 'konva';

/** Knoten mit diesem Namen zeigt nur der Editor (Hinweis im leeren Platzhalter); der Export entfernt sie. */
export const EDITOR_ONLY_NODE = 'editor-only';
/** Pinselmodus (Maske): rote Folie (zugleich EDITOR_ONLY_NODE) und Pinselring in der Ebene «selection». */
export const MASK_VEIL_NODE = 'mask-veil';
export const BRUSH_RING_NODE = 'brush-ring';
/** Gruppe mit dem Bild eines Video-Elements: der MP4-Export ersetzt ihren Inhalt je Frame. */
export const VIDEO_FRAME_NODE = 'video-frame';

let stage: Konva.Stage | null = null;

/** CanvasView meldet hier seine Stage an, damit der Export die Ebene «content» findet. */
export function setEditorStage(s: Konva.Stage | null): void {
  stage = s;
}

export function getContentLayer(): Konva.Layer | null {
  return stage?.findOne<Konva.Layer>('.content') ?? null;
}
