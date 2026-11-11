import type Konva from 'konva';
import { Image as KImage, Rect } from 'react-konva';
import { colors, photoFrame } from '../../../tokens';
import { RING_IMAGE } from './liveRing';
import type { Ring } from './useOutline';

const SHADOW = {
  shadowColor: colors[photoFrame.shadow.color],
  shadowOpacity: photoFrame.shadow.opacity,
  shadowOffsetY: photoFrame.shadow.offsetY,
  shadowBlur: photoFrame.shadow.blur,
} as const;

/** Name des Rechteckrahmens: PhotoNode richtet ihn beim Skalieren live neu aus, der Test liest ihn. */
export const FRAME_RECT = 'photo-frame';
/** Name der Karte des alten Innenrahmens. */
export const CARD_RECT = 'photo-card';

/**
 * Rechteckrahmen mit Randbreite in Bildschirmpixeln, solange der Knoten um (sx, sy) skaliert ist (Geste läuft):
 * Konva streckt sonst Rand und Schatten mit. (1, 1) setzt die Lage aus den Props zurück.
 */
export function fitFrame(rect: Konva.Rect, width: number, height: number, sx: number, sy: number): void {
  const { left, top, right, bottom } = photoFrame.inset;
  rect.setAttrs({
    x: -left / sx,
    y: -top / sy,
    width: width + (left + right) / sx,
    height: height + (top + bottom) / sy,
    shadowOffsetY: photoFrame.shadow.offsetY / sy,
  });
}

/** Alter Innenrahmen (Altprojekt): warmweisse Karte in Boxgrösse, Bild eingerückt darauf. */
export function InsetFrame({ width, height }: { width: number; height: number }) {
  return <Rect name={CARD_RECT} width={width} height={height} fill={colors[photoFrame.color]} {...SHADOW} />;
}

/**
 * Rahmen aussen, ragt um die Rahmenbreite über die Box hinaus; der Schatten hängt an ihm und folgt so der Kontur.
 * Für Auswahlrahmen und Transformer zählt nur die Box: das Selbst-Rechteck des Knotens ist die Box, nicht der Rahmen.
 */
export function OutsideFrame({ ring, width, height }: { ring: Ring; width: number; height: number }) {
  const { left, top, right, bottom } = photoFrame.inset;
  // an der aktuellen Lage: beim Skalieren verschieben fitFrame und liveRing den Knoten, die Box (und damit das Seitenverhältnis am Transformer) bleibt
  const pin = (node: Konva.Shape | null) => {
    if (node) node.getSelfRect = () => ({ x: -node.x(), y: -node.y(), width, height });
  };
  if (ring.rect)
    return <Rect name={FRAME_RECT} ref={pin} x={-left} y={-top} width={width + left + right} height={height + top + bottom} fill={colors[photoFrame.color]} {...SHADOW} />;
  // Kontur: Klick geht durch (die Bildfläche des Knotens ist ein Rechteck, nicht die Form)
  return <KImage name={RING_IMAGE} ref={pin} image={ring.canvas} x={ring.x} y={ring.y} width={ring.width} height={ring.height} listening={false} {...SHADOW} />;
}
