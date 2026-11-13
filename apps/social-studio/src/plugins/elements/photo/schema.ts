import { z } from 'zod';
import { imageAdjust, photoFrame, scrim, video } from '../../../tokens';
import { NEUTRAL, type Adjust } from '../../effects/look';
import { scrimSchema, scrimsSchema, type Scrim } from '../../../model/scrim';

export type { Scrim };

const level = z.number().int().min(imageAdjust.min).max(imageAdjust.max);

/** Videoausschnitt in Sekunden; `duration` ist die Länge der Quelldatei. */
export const videoSchema = z
  .object({ start: z.number().min(0), end: z.number(), sound: z.boolean(), duration: z.number().positive() })
  .refine((v) => v.end - v.start >= video.minLength && v.end <= v.duration, 'Ungültiger Videoausschnitt');
export type VideoProps = z.infer<typeof videoSchema>;

export const photoPropsSchema = z.object({
  /** Fehlt beim leeren Platzhalter aus einem Layout (Element.role gesetzt). */
  assetId: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  crop: z.object({ x: z.number(), y: z.number(), scale: z.number().positive() }),
  /** Filmkorn; fehlt bei Projekten vor Phase 2a. */
  grain: z.boolean().optional(),
  /** Korn-Stärke 0 bis 100 (Phase 4c.1, `grainOpacity`), nur bei `grain`. Fehlt = Standard 14. */
  grainStrength: z.number().int().min(0).max(100).optional(),
  /** BBZB-Look, Bildregler und Spiegeln; fehlen bei Projekten vor Phase 2a. */
  look: z.boolean().optional(),
  adjust: z.object({ brightness: level, contrast: level, saturation: level, warmth: level }).optional(),
  flipX: z.boolean().optional(),
  /** Senkrecht gespiegelt (Phase 4c); fehlt = nicht gespiegelt. */
  flipY: z.boolean().optional(),
  /** Warmweisser Rahmen mit Schatten (Collage der PSD); fehlt = aus. Die Elementbox ist der Aussenrand. */
  frame: z.boolean().optional(),
  /** Rahmen als Kontur ausserhalb der Box (Phase 2.5): die Box ist der Bildbereich. Fehlt bei `frame` (Altprojekt) = alte Innen-Darstellung. */
  frameOutside: z.boolean().optional(),
  /** Altes Einzelfeld (Phase 2.3): wird gelesen (`scrimsOf`), nie mehr geschrieben. */
  scrim: scrimSchema.optional(),
  /** Verläufe über dem Bild (Phase 2.5), der Reihe nach, höchstens `scrim.max`; fehlt = `scrim` bzw. keiner. */
  scrims: scrimsSchema.optional(),
  /** Phase 4a: Maske (Asset-ID der Maskendatei, Graustufen-PNG im Pixelraum des Fotos, weiss = sichtbar); fehlt = alles sichtbar. Nur am Foto, nie am Video. */
  mask: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  /** Phase 3: Foto-Element mit Video (assetId zeigt auf die Videodatei, `crop` gilt für das Videobild); fehlt = Foto. */
  video: videoSchema.optional(),
});
export type PhotoProps = z.infer<typeof photoPropsSchema>;

// Ohne Angabe aus bzw. neutral: alte Projekte sehen gleich aus wie vorher. Neue Fotos setzen Korn und Look ausdrücklich (photoFromFile).
export const grainOf = (p: PhotoProps): boolean => p.grain ?? false;
export const lookOf = (p: PhotoProps): boolean => p.look ?? false;
export const videoOf = (p: PhotoProps): VideoProps | undefined => p.video;
export const isVideo = (p: PhotoProps): boolean => p.video !== undefined;
// Bildregler und Spiegeln gibt es am Video nicht (Phase 3): gespeicherte Werte gelten dort nicht. Der Rahmen gilt auch am Video.
export const adjustOf = (p: PhotoProps): Adjust => (isVideo(p) ? undefined : p.adjust) ?? NEUTRAL;
export const flipOf = (p: PhotoProps): boolean => !isVideo(p) && (p.flipX ?? false);
export const flipYOf = (p: PhotoProps): boolean => !isVideo(p) && (p.flipY ?? false);
export const maskOf = (p: PhotoProps): string | undefined => (isVideo(p) ? undefined : p.mask);
export const frameOf = (p: PhotoProps): boolean => p.frame ?? false;
export const scrimsOf = (p: PhotoProps): Scrim[] => p.scrims ?? (p.scrim ? [p.scrim] : []);
/** Noch Platz für einen Verlauf? Die Bedienung prüft das vor dem Anlegen (höchstens `scrim.max`). */
export const canAddScrim = (p: PhotoProps): boolean => scrimsOf(p).length < scrim.max;

/** Rahmen als Kontur ausserhalb der Box: neu gesetzte Rahmen und Layouts ab Phase 2.5. */
export const frameOutsideOf = (p: PhotoProps): boolean => frameOf(p) && (p.frameOutside ?? false);

/** Bildbereich in der Elementbox: mit altem Innenrahmen um die Ränder eingerückt (mindestens 1 px), sonst die ganze Box. */
export function imageArea(p: PhotoProps, box: { width: number; height: number }) {
  const i = frameOf(p) && !frameOutsideOf(p) ? photoFrame.inset : { left: 0, top: 0, right: 0, bottom: 0 };
  return { x: i.left, y: i.top, width: Math.max(1, box.width - i.left - i.right), height: Math.max(1, box.height - i.top - i.bottom) };
}
