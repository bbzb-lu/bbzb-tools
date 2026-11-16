import { IconFlipHorizontal, IconFlipVertical, IconPhotoPlus } from '@tabler/icons-react';
import type { ElementType } from '../../../core/types';
import { coverCrop, proportional, resizeCrop } from '../../../model/crop';
import { useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { AI_RUNNING } from './cutoutOps';
import { fillPhoto, photoFromFile, pickImage } from './fromFile';
import { isHeic } from './importImage';
import { isVideoFile } from './importVideo';
import { PhotoInspector } from './PhotoInspector';
import { setProps } from './setProps';
import { PhotoNode } from './PhotoNode';
import { flipOf, flipYOf, imageArea, isVideo, photoPropsSchema, scrimsOf, type PhotoProps, type Scrim } from './schema';
import { scrim as scrimTokens } from '../../../tokens';

const sameScrim = (a: Scrim, b: Scrim) =>
  a.side === b.side && a.strength === b.strength && (a.reach ?? scrimTokens.reach.default) === (b.reach ?? scrimTokens.reach.default) && !!a.light === !!b.light;
const sameScrims = (a: Scrim[], b: Scrim[]) => a.length === b.length && a.every((s, i) => sameScrim(s, b[i]!));

export { photoFromFile };

export const photoType: ElementType<PhotoProps> = {
  id: 'photo',
  label: 'Foto',
  propsSchema: photoPropsSchema,
  Render: PhotoNode,
  Inspector: PhotoInspector,
  menuItems: (el) =>
    el.props.assetId === undefined
      ? []
      : [
          { id: 'crop', label: 'Ausschnitt bearbeiten', run: () => useUi.getState().setCropEditId(el.id) },
          ...(isVideo(el.props)
            ? []
            : [
                { id: 'mask', label: 'Maske bearbeiten', disabled: useUi.getState().ai?.id === el.id ? AI_RUNNING : undefined, run: () => useUi.getState().setMaskEditId(el.id) },
                {
                  id: 'flip',
                  label: 'Spiegeln',
                  run: () => undefined,
                  sub: [
                    { id: 'flip-x', label: 'Waagrecht', icon: IconFlipHorizontal, run: () => setProps(el.id, { flipX: !flipOf(el.props) }) },
                    { id: 'flip-y', label: 'Senkrecht', icon: IconFlipVertical, run: () => setProps(el.id, { flipY: !flipYOf(el.props) }) },
                  ],
                },
              ]),
        ],
  anchors: ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
  afterTransform(el, box, project = useDoc.getState().project ?? undefined) {
    const id = el.props.assetId;
    const img = id === undefined ? undefined : project?.assets[id];
    const crop = img ? resizeCrop(imageArea(el.props, el), imageArea(el.props, box), img, el.props.crop, proportional(el, box)) : el.props.crop;
    return { ...box, props: { ...el.props, crop } };
  },
  add: { label: 'Foto oder Video hinzufügen', icon: IconPhotoPlus, run: (ctx) => pickImage((file) => photoFromFile(file, ctx)) },
  acceptsFile: (file) => file.type.startsWith('image/') || isHeic(file) || isVideoFile(file),
  fromFile: photoFromFile,
  fillFromFile: fillPhoto,
  // Layoutdaten haben für den leeren Platzhalter keinen Ausschnitt. Korn und Look ausdrücklich an (R10);
  // ein beim Layoutwechsel umgezogenes Foto behält seine Wahl, ohne Angabe (altes Projekt) auch an.
  fromLayout: (el) => {
    const props = el.props as Partial<PhotoProps>;
    const keep = props.assetId !== undefined;
    const grain = keep ? (props.grain ?? true) : true;
    const look = keep ? (props.look ?? true) : true;
    return { ...el, props: { crop: { x: 0, y: 0, scale: 1 }, ...props, grain, look } };
  },
  hasContent: (el) => el.props.assetId !== undefined,
  takeContent(into, from, p, base) {
    const img = from.props.assetId === undefined ? undefined : p.assets[from.props.assetId];
    // Rahmen (samt Lage aussen/innen) gehört zum Platzhalter des Layouts, nicht zum Bild. Verläufe (Liste) wie im bisherigen Platzhalter (frei: keine) → die
    // des neuen Layouts; selbst gewählt (auch «Aus») bleiben sie (R8). Geschrieben wird nur `scrims`, nie das alte `scrim`.
    const scrims = sameScrims(scrimsOf(from.props), base ? scrimsOf(base.props) : []) ? scrimsOf(into.props) : scrimsOf(from.props);
    return img && { ...into, props: { ...from.props, frame: into.props.frame, frameOutside: into.props.frameOutside, scrim: undefined, scrims: scrims.length ? scrims : undefined, crop: coverCrop(imageArea(into.props, into), img) } };
  },
};
