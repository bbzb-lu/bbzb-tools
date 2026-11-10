import { useEffect, useState } from 'react';
import { Group, Image as KImage, Rect } from 'react-konva';
import { doodlesFailed, doodlesLoaded, ensureDoodles, isDoodleId } from '../../../brand/doodles';
import { ensureTabler, isTablerId, tablerFailed, tablerLoaded } from '../../../brand/tabler';
import { useColor } from '../../../canvas/accent';
import { MISSING_BRAND_NODE, useMissingBrandNotice } from '../../../canvas/images';
import { assetPacks } from '../../../core/registries';
import type { ElementRenderProps } from '../../../core/types';
import { updateElement } from '../../../model/elements';
import { apply } from '../../../store/document';
import { colors } from '../../../tokens';
import type { BrandProps } from './schema';
import { tinted } from './tint';
import { inGroupDrag } from '../../../canvas/multiGesture';

const findAsset = (id: string) => assetPacks.all().flatMap((p) => p.assets).find((a) => a.id === id);

export function BrandNode({ el }: ElementRenderProps<BrandProps>) {
  const { id, width, height } = el;
  const color = useColor(el.props.color, el);
  const [, retick] = useState(0);
  const url = findAsset(el.props.brandId)?.url;
  // Tabler-Icon oder Doodle, dessen Datei noch lädt: warten statt Platzhalter. Normalerweise ist sie schon da (Öffnen und Export laden vor).
  const brandId = el.props.brandId;
  const waiting =
    !url &&
    ((isTablerId(brandId) && !tablerLoaded() && !tablerFailed()) || (isDoodleId(brandId) && !doodlesLoaded() && !doodlesFailed()));
  useEffect(() => {
    const tick = () => retick((n) => n + 1);
    if (waiting) Promise.all([ensureTabler([brandId]), ensureDoodles([brandId])]).then(tick, tick);
  }, [waiting, brandId]);
  const key = `${color} ${url}`;
  // Beim Farbwechsel bleibt das alte Bild stehen, bis das neue fertig ist.
  const [state, setState] = useState<{ key: string; canvas?: HTMLCanvasElement }>();
  useEffect(() => {
    if (!url) return;
    let live = true;
    tinted(url, color).then(
      (canvas) => live && setState({ key: `${color} ${url}`, canvas }),
      () => live && setState({ key: `${color} ${url}` }),
    );
    return () => {
      live = false;
    };
  }, [url, color]);
  // Unbekanntes oder kaputtes Markenbild: Platzhalter, der Export bricht dann ab statt es wegzulassen.
  const failed = !waiting && (!url || (state?.key === key && !state.canvas));
  const flip = el.props.flipX ?? false;
  useMissingBrandNotice(failed);

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
    >
      {failed && <Rect name={MISSING_BRAND_NODE} width={width} height={height} fill={colors.blauschwarz} />}
      {!failed && state?.canvas && (
        <KImage image={state.canvas} width={width} height={height} x={flip ? width : 0} scaleX={flip ? -1 : 1} />
      )}
    </Group>
  );
}
