import { useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { EDITOR_ONLY_NODE } from '../../../canvas/contentLayer';
import type { Element } from '../../../model/types';
import { elementBounds } from '../../../model/geometry';
import { useDoc } from '../../../store/document';
import { colors, placeholderStyle as ph, rgba, uiFamily } from '../../../tokens';
import { freeBand } from './freeBand';
import { baseOf, hintColor } from './hint';
import { frameOf, type PhotoProps } from './schema';

/** Rechtecke der sichtbaren Elemente über `el`, im Koordinatenraum des Bildbereichs (`area` = Lage darin); als Text, damit der Selektor stabil bleibt. */
const coversOf = (el: Element<PhotoProps>, area: { x: number; y: number }) => (s: ReturnType<typeof useDoc.getState>) => {
  const order = s.project?.order ?? [];
  const above = order.slice(order.indexOf(el.id) + 1).flatMap((id) => (s.project!.elements[id]?.visible ? [s.project!.elements[id]!] : []));
  return JSON.stringify(above.map(elementBounds).map((b) => ({ ...b, x: b.x - el.x - area.x, y: b.y - el.y - area.y })));
};

/**
 * Leerer Platzhalter: nur im Editor sichtbar, der Export entfernt die Gruppe (Slide-Hintergrund bleibt). Der Hinweis steht mittig im
 * Streifen, den kein Element darüber (z. B. der Titel) bedeckt.
 * shortcut: Drehung des Platzhalters selbst zählt nicht, Rechtecke der Elemente darüber sind deren Umrandungen.
 */
export function PlaceholderHint({ el, area, slideBg }: { el: Element<PhotoProps>; area: { x: number; y: number; width: number; height: number }; slideBg: Parameters<typeof baseOf>[0] }) {
  const covers = useDoc(coversOf(el, area));
  const band = useMemo(() => freeBand({ x: 0, y: 0, width: area.width, height: area.height }, JSON.parse(covers)), [covers, area.width, area.height]);
  return (
    <Group name={EDITOR_ONLY_NODE} x={area.x} y={area.y}>
      <Rect
        width={area.width}
        height={area.height}
        fill={rgba(ph.color, ph.fillAlpha)}
        stroke={rgba(ph.color, ph.edgeAlpha)}
        strokeWidth={ph.edgeWidth}
        dash={[...ph.edgeDash]}
      />
      <Text
        text="Foto hierher ziehen"
        y={band.y}
        width={area.width}
        height={band.height}
        align="center"
        verticalAlign="middle"
        padding={ph.fontSize / 2}
        fontFamily={uiFamily}
        fontSize={ph.fontSize}
        fill={colors[hintColor(baseOf(slideBg, frameOf(el.props)))]}
        listening={false}
      />
    </Group>
  );
}
