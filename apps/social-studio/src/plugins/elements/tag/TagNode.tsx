import type Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Group, Image as KImage, Rect, Text } from 'react-konva';
import { useAccent } from '../../../canvas/accent';
import { MISSING_BRAND_NODE, useMissingBrandNotice } from '../../../canvas/images';
import { assetPacks } from '../../../core/registries';
import type { ElementRenderProps } from '../../../core/types';
import { resolveColor } from '../../../model/accent';
import { updateElement } from '../../../model/elements';
import { apply } from '../../../store/document';
import { colors, onAccent, tagBox } from '../../../tokens';
import { tinted } from '../brand/tint';
import { tagFillOf, tagStyleOf, tagTextX } from './layout';
import { tagDeptConfig, tagTextConfig } from './measure';
import type { TagProps } from './schema';
import { inGroupDrag, keepSize, releaseSize } from '../../../canvas/multiGesture';

const PIN_ID = 'icon-map-pin';
// Tabler-Pin: 24er-Raster, sichtbar (mit Strich) x 3..21, y 2..22.5. Die PSD-Iconbox gilt für das Sichtbare, nicht für die Datei. Höhe passt, Breite steht 1.5 px je Seite über.
const pinGrid = 24;
const pinInk = { y: 2, h: 20.5 };

export function TagNode({ el }: ElementRenderProps<TagProps>) {
  const { id, width, height } = el;
  const { variant } = el.props;
  const accent = useAccent(el);
  const fill = tagFillOf(el.props, accent);
  const dept = tagDeptConfig(el.props);
  const lineH = tagStyleOf(variant).size;
  const top = dept ? (height - lineH - tagBox.schulDept.size) / 2 : 0;
  const pinColor = resolveColor(tagBox.ort.iconColor, accent);
  const url = variant === 'ort' ? assetPacks.all().flatMap((p) => p.assets).find((a) => a.id === PIN_ID)?.url : undefined;
  const [pin, setPin] = useState<{ url: string; canvas?: HTMLCanvasElement }>();
  useEffect(() => {
    if (!url) return;
    let live = true;
    tinted(url, pinColor).then(
      (canvas) => live && setPin({ url, canvas }),
      () => live && setPin({ url }),
    );
    return () => {
      live = false;
    };
  }, [url, pinColor]);
  const pinFailed = variant === 'ort' && (!url || (pin?.url === url && !pin.canvas));
  useMissingBrandNotice(pinFailed);
  const inner = useRef<Konva.Group>(null);
  const icon = tagBox.ort.icon;
  const size = (pinGrid * icon.h) / pinInk.h;

  return (
    <Group
      id={id}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacity}
      draggable={!el.locked}
      listening={!el.locked}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget || inGroupDrag(id)) return; // mehrere: commitMove schreibt alle
        apply((d) => updateElement(d, id, { x: e.target.x(), y: e.target.y() }));
      }}
      onTransform={(e) => {
        // Ein Tag behält seine Grösse: die Skalierung der Gruppe nimmt der innere Knoten zurück.
        if (e.target !== e.currentTarget) return;
        keepSize(inner.current, e.currentTarget);
      }}
      onTransformEnd={() => releaseSize(inner.current)}
    >
      <Group ref={inner}>
        <Rect width={width} height={height} fill={fill} cornerRadius={0} />
        {dept ? (
          <>
            <Text {...tagTextConfig(el.props)} x={tagTextX(variant)} y={top} wrap="none" fill={colors[onAccent(fill)]} />
            <Text {...dept} x={tagTextX(variant)} y={top + lineH} wrap="none" fill={colors[onAccent(fill)]} />
          </>
        ) : (
          <Text {...tagTextConfig(el.props)} x={tagTextX(variant)} height={height} verticalAlign="middle" wrap="none" fill={colors[onAccent(fill)]} />
        )}
        {pinFailed && <Rect name={MISSING_BRAND_NODE} width={width} height={height} fill={colors.blauschwarz} />}
        {variant === 'ort' && !pinFailed && pin?.canvas && (
          <KImage image={pin.canvas} width={size} height={size} x={icon.x + icon.w / 2 - size / 2} y={icon.y - (size * pinInk.y) / pinGrid} />
        )}
      </Group>
      {/* Unsichtbare Box: das Skalieren der Gruppe misst sie, der Inhalt darin bleibt unverzerrt. */}
      <Rect width={width} height={height} fillEnabled={false} strokeEnabled={false} listening={false} />
    </Group>
  );
}
