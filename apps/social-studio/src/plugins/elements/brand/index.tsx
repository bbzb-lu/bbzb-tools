import { loadUrlImage } from '../../../canvas/images';
import type { ElementType } from '../../../core/types';
import { addElement, nextName } from '../../../model/elements';
import { akzent } from '../../../tokens';
import { BrandInspector, BrandLayerActions } from './BrandInspector';
import { BrandNode } from './BrandNode';
import { brandPropsSchema, type BrandProps } from './schema';

/** Breite beim Einfügen als Anteil der Slide-Breite. */
const insertWidth = { scribble: 0.3, icon: 0.15, maxSide: 0.6 } as const;

export const brandType: ElementType<BrandProps> = {
  id: 'brand',
  label: 'Markenbild',
  propsSchema: brandPropsSchema,
  Render: BrandNode,
  Inspector: BrandInspector,
  LayerActions: BrandLayerActions,
  // Nur Ecken: Scribbles und Icons verzerren nie.
  anchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  // Auch mit Shift (freies Skalieren beim Transformer) bleibt das Seitenverhältnis.
  afterTransform: (el, box) => ({ ...box, height: (box.width * el.height) / el.width }),
  acceptsAsset: (asset) => asset.category === 'scribble' || asset.category === 'icon',
  async fromAsset(asset, ctx, at) {
    let img: HTMLImageElement;
    try {
      img = await loadUrlImage(asset.url);
    } catch {
      return ctx.notify('error', `«${asset.name}» konnte nicht geladen werden. Lade die Seite neu.`);
    }
    const { width: W, height: H } = ctx.project.format;
    // Gleiche Fläche wie ein Quadrat der Kantenlänge W × Faktor, längste Seite höchstens maxSide × W: hohe und breite Motive wirken gleich gross.
    const ratio = img.naturalWidth / img.naturalHeight;
    const side = W * (asset.category === 'icon' ? insertWidth.icon : insertWidth.scribble);
    const scale = Math.min(1, (W * insertWidth.maxSide) / (side * Math.max(Math.sqrt(ratio), 1 / Math.sqrt(ratio))));
    const width = Math.round(side * Math.sqrt(ratio) * scale);
    const height = Math.round(side / Math.sqrt(ratio) * scale);
    const center = (typeof at === 'function' ? at() : at) ?? { x: ctx.currentSlide * W + W / 2, y: H / 2 };
    const id = crypto.randomUUID();
    ctx.apply((d) =>
      addElement(d, {
        id,
        type: 'brand',
        name: nextName(d, asset.category === 'icon' ? 'Icon' : 'Scribble'),
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        props: { brandId: asset.id, color: asset.defaultColor ?? akzent },
      }),
    );
    ctx.select(id);
  },
};
