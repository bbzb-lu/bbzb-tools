import { elementBounds, intersects, slideRect } from '../model/geometry';
import type { Element, Project } from '../model/types';
import { video } from '../tokens';

/** Kürzung eines Video-Elements (Feld `video` am Foto-Element; der Kern kennt das Plugin nicht). */
export type VideoTrim = { start: number; end: number; sound: boolean; duration: number };

export const videoOf = (e: Element): VideoTrim | undefined => (e.props as { video?: VideoTrim } | null)?.video;

/** Sichtbare Video-Elemente, die Slide `index` berühren, in Ebenenreihenfolge. */
export function videosOn(p: Project, index: number): Element[] {
  const s = slideRect(p, index);
  return p.order.map((id) => p.elements[id]!).filter((e) => e?.visible && videoOf(e) && intersects(elementBounds(e), s));
}

/** Slide wird MP4, wenn ein sichtbares Video sie schneidet (kein Panorama-Video: jede berührte Slide ab Sekunde 0). */
export const isVideoSlide = (p: Project, index: number): boolean => videosOn(p, index).length > 0;

/** Frames eines Videos: gekürzte Länge (Ende minus Start), höchstens `maxSlideSeconds`. Runden, nicht abschneiden (9.999999 s). */
const framesOf = (v: VideoTrim) => Math.round(Math.min(v.end - v.start, video.maxSlideSeconds) * video.fps);

/** Frames der Slide: längstes gekürztes Video. */
export const frameCount = (videos: Element[]): number => Math.max(0, ...videos.map((e) => framesOf(videoOf(e)!)));

/** Zeit im Video für Frame `k`; ist das Video kürzer als die Slide, bleibt es auf seinem letzten Bild stehen. */
export function frameTime(e: Element, k: number): number {
  const v = videoOf(e)!;
  return v.start + Math.min(k, framesOf(v) - 1) / video.fps;
}

/** Ton der Slide: erstes sichtbares Video mit «Ton» an. */
export const soundSource = (p: Project, index: number): Element | undefined => videosOn(p, index).find((e) => videoOf(e)!.sound);

/**
 * Breite, in der ein Video dekodiert wird (Editor und Export, gleiches Bild): Originalgrösse, lange Seite höchstens `decodeMax`.
 * Ein Querformat füllt eine Hochformat-Slide nur mit einem schmalen Ausschnitt, der braucht die volle Breite.
 */
export const decodeWidth = (w: number, h: number): number => Math.round(w * Math.min(1, video.decodeMax / Math.max(w, h)));

/** Offene Decoder, Encoder und Dateien des Video-Exports (e2e: nach Abbruch 0). */
export const videoExportStats = { open: 0 };

