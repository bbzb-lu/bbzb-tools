import type { EditorContext } from '../../../core/types';
import { coverCrop, insertFrame } from '../../../model/crop';
import { addElement, nextName } from '../../../model/elements';
import { slideRect } from '../../../model/geometry';
import type { Element, Project } from '../../../model/types';
import { StorageFullError, videoAssetId } from '../../../storage/assets';
import { ImportError, importImage } from './importImage';
import { importVideo, isVideoFile, VideoImportError, type ImportedVideo } from './importVideo';
import { imageArea, type PhotoProps, type VideoProps } from './schema';

/** Dateiauswahl für ein Bild (auch ohne Maus: Ersatz für das Ziehen in einen Platzhalter). */
export function pickImage(onFile: (file: File) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.heic,.heif,video/mp4,video/quicktime,.mp4,.mov';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  };
  input.click();
}

type Imported = Pick<ImportedVideo, 'mime' | 'width' | 'height'> & { blob: Blob; assetId: string; video?: VideoProps; warning?: string };

/** Erst Bild oder Video prüfen und speichern, dann ein einziges apply (in `then`): ein Fehler hinterlässt kein Element. */
async function withImage(file: File, ctx: EditorContext, then: (img: Imported) => void): Promise<void> {
  try {
    const img: Omit<Imported, 'assetId'> = isVideoFile(file) ? await importVideo(file) : await importImage(file);
    const assetId = img.video ? await ctx.assets.put(img.blob, await videoAssetId(img.blob)) : await ctx.assets.put(img.blob);
    then({ ...img, assetId });
    if (img.warning) ctx.notify('info', img.warning);
  } catch (e) {
    const known = e instanceof ImportError || e instanceof VideoImportError || e instanceof StorageFullError;
    if (!known) console.error(e);
    ctx.notify('error', known ? e.message : 'Das Foto konnte nicht hinzugefügt werden.');
  }
}

const addAsset = (d: Project, img: Imported, file: File) =>
  void (d.assets[img.assetId] ??= { mime: img.mime, width: img.width, height: img.height, name: file.name.slice(0, 255) });

export const photoFromFile = (file: File, ctx: EditorContext): Promise<void> =>
  withImage(file, ctx, (img) => {
    const id = crypto.randomUUID();
    ctx.apply((d) => {
      addAsset(d, img, file);
      const frame = insertFrame(slideRect(d, ctx.currentSlide), img);
      addElement(d, {
        id,
        type: 'photo',
        name: nextName(d, 'Foto'),
        ...frame,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        props: { assetId: img.assetId, crop: coverCrop(frame, img), grain: false, look: true, ...(img.video && { video: img.video }) } satisfies PhotoProps,
      });
    });
    ctx.select(id);
  });

/** Platzhalter füllen oder Foto ersetzen: Rahmen bleibt, Bild deckend; Look ausdrücklich an. Korn: leerer Platzhalter aus (Phase 2.5), beim Ersetzen bleibt die Wahl. */
export const fillPhoto = (el: Element<PhotoProps>, file: File, ctx: EditorContext): Promise<void> =>
  withImage(file, ctx, (img) => {
    let filled = false;
    ctx.apply((d) => {
      const target = d.elements[el.id] as Element<PhotoProps> | undefined;
      if (!target) return; // inzwischen gelöscht; das Asset räumt die GC weg
      addAsset(d, img, file);
      target.props = { ...target.props, assetId: img.assetId, crop: coverCrop(imageArea(target.props, target), img), grain: target.props.assetId === undefined ? false : (target.props.grain ?? false), look: true, video: img.video };
      delete target.props.mask; // die Maske gehört zum alten Bild (Alt-Asset und -Maske räumt die GC weg)
      if (!img.video) delete target.props.video; // Foto ersetzt Video: Ausschnitt und Ton fallen weg; neues Video startet bei 0
      else for (const k of ['frame', 'frameOutside', 'flipX', 'flipY', 'adjust'] as const) delete target.props[k]; // gibt es am Video nicht
      filled = true;
    });
    if (filled) ctx.select(el.id);
  });

