/** Rand um die Slides in Bildschirm-px (oben + unten = 48). */
export const PAD = 24;
/** Zoom relativ zu «Einpassen» (Höhe füllend). */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Stufenlos für Mausrad und Touchpad-Pinch (kleine deltaY = kleine Schritte). */
export const zoomStep = (z: number, deltaY: number): number => clampZoom(z * Math.exp(-deltaY * 0.0015));

type Size = { width: number; height: number };
type Point = { x: number; y: number };

/**
 * Lage der Slides im Scroll-Inhalt: `origin` = Inhaltspunkt der linken oberen Slide-Ecke, `slides` = alle Slides in Bildschirm-px.
 * Vergrössert: halbe Ansicht Rand rundum (Arbeitsfläche), damit der Zoom-Anker in alle Richtungen Platz hat.
 * Sonst mittig, solange alles hineinpasst, und erst breiter als die Ansicht mit `PAD` Rand.
 */
export function canvasLayout(view: Size, slides: Size, zoom: number): { originX: number; originY: number; width: number; height: number | '100%' } {
  if (zoom > 1) {
    return { originX: view.width / 2, originY: view.height / 2, width: slides.width + view.width, height: slides.height + view.height };
  }
  const fits = slides.width + 2 * PAD <= view.width;
  return {
    originX: fits ? (view.width - slides.width) / 2 : PAD,
    originY: Math.max(PAD, (view.height - slides.height) / 2),
    width: fits ? view.width : slides.width + 2 * PAD,
    height: '100%',
  };
}

/** Neue Scroll-Position, sodass der Weltpunkt unter `pointer` (relativ zum Scroll-Container) stehen bleibt. */
export function zoomAround(
  scroll: { left: number; top: number },
  pointer: Point,
  oldScale: number,
  newScale: number,
  oldOrigin: Point,
  newOrigin: Point,
): { left: number; top: number } {
  const k = newScale / oldScale;
  return {
    left: (scroll.left + pointer.x - oldOrigin.x) * k + newOrigin.x - pointer.x,
    top: (scroll.top + pointer.y - oldOrigin.y) * k + newOrigin.y - pointer.y,
  };
}
