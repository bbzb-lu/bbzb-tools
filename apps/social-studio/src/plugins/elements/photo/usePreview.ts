import Konva from 'konva';
import { useSyncExternalStore } from 'react';
import { effectFailed, PREVIEW_MAX, previewStats } from '../../../canvas/effects';
import { BROKEN_VIDEO } from '../../../canvas/images';
import { effects } from '../../../core/registries';
import { sourceRect } from '../../../model/crop';
import type { Element } from '../../../model/types';
import { opfsAssetStore } from '../../../storage/assets';
import { useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { imageArea, type PhotoProps } from './schema';
import { photoSteps } from './steps';

/**
 * Video-Vorschau auf der Leinwand: ein `<video>` ist Uhr, Ton und Bildquelle zugleich. Bei jedem neuen Videobild
 * (requestVideoFrameCallback) zeichnet die Schleife den Ausschnitt in eine Canvas von höchstens 540 px Breite, rechnet die Effekte
 * des Elements (gleiche Liste wie die Leinwand) und zeichnet nur die Konva-Ebene neu: kein React-Render, kein Store-Schreiben je Bild.
 * Höchstens eine Vorschau zugleich. Nie im Undo, nie im Export (der Knoten ist editor-only).
 */
type Playing = { id: string; canvas: HTMLCanvasElement; node: Konva.Image | null; stop(): void };

let playing: Playing | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

const photoOf = (id: string) => useDoc.getState().project?.elements[id] as Element<PhotoProps> | undefined;

/** Beendet die laufende Vorschau (nur die von `id`, wenn angegeben). */
export function stopPreview(id?: string): void {
  if (playing && (id === undefined || playing.id === id)) playing.stop();
}

export function startPreview(id: string): void {
  stopPreview();
  const assetId = photoOf(id)?.props.assetId;
  if (!assetId || !photoOf(id)?.props.video) return;
  const canvas = document.createElement('canvas');
  // Effekte lesen jedes Bild zurück (Look)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const v = document.createElement('video');
  v.playsInline = true;
  v.loop = true; // Ende = Dateiende: der Browser springt selbst an den Anfang, die Schleife dann auf den Start
  let url: string | undefined;
  let handle = 0;
  let stopped = false;

  const p: Playing = {
    id,
    canvas,
    node: null,
    stop() {
      if (stopped) return;
      stopped = true;
      if (handle) v.cancelVideoFrameCallback(handle);
      v.pause();
      v.removeAttribute('src');
      v.load(); // Dekoder und Ton freigeben
      if (url) URL.revokeObjectURL(url);
      p.node?.visible(false); // bis React den Knoten abbaut: die freigegebene Canvas nicht mehr zeichnen
      Konva.Util.releaseCanvas(canvas);
      previewStats.open--;
      playing = null;
      notify();
    },
  };

  /** Ausschnitt des aktuellen Videobilds in die Canvas, dann die Effekte des Elements. */
  const draw = async (el: Element<PhotoProps>) => {
    const area = imageArea(el.props, el);
    const k = Math.min(1, PREVIEW_MAX / area.width);
    const [w, h] = [Math.max(1, Math.round(area.width * k)), Math.max(1, Math.round(area.height * k))];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    const meta = useDoc.getState().project!.assets[assetId]!;
    const f = sourceRect(el.props.crop, area, v.videoWidth / meta.width, v.videoHeight / meta.height);
    ctx.drawImage(v, f.x, f.y, f.width, f.height, 0, 0, w, h);
    for (const s of photoSteps(el.props)) {
      const fx = effects.get(s.id);
      if (fx.active(s.params)) await fx.apply(ctx, s.params, k);
    }
  };

  // Werte je Bild aus dem Store: Start, Ende, Ton und Effekte gelten sofort, ohne Neustart
  const onFrame = async (_now: number, frame: VideoFrameCallbackMetadata) => {
    handle = 0;
    const el = photoOf(id);
    const vid = el?.props.video;
    if (stopped) return;
    // gelöscht, ausgeblendet oder kein Video mehr
    if (!el || !vid || !el.visible || el.props.assetId !== assetId) return p.stop();
    v.muted = !vid.sound;
    if (frame.mediaTime >= vid.end || frame.mediaTime < vid.start - 1 / 10) v.currentTime = vid.start;
    else {
      try {
        await draw(el);
      } catch (e) {
        // z. B. Rücklesen scheitert bei Speicherdruck: nicht still hängen bleiben («Stopp» ohne Bild)
        console.error(e);
        p.stop();
        effectFailed();
        return;
      }
      if (stopped) return;
      previewStats.frames++;
      p.node?.getLayer()?.batchDraw();
    }
    // Rechnet ein Bild länger als eines dauert, fallen Bilder aus, statt sich zu stauen
    handle = v.requestVideoFrameCallback(onFrame);
  };

  playing = p;
  previewStats.open++;
  notify();
  const first = photoOf(id)!.props.video!;
  v.muted = !first.sound;
  opfsAssetStore()
    .get(assetId)
    .then((blob) => {
      if (stopped) return;
      url = URL.createObjectURL(blob);
      v.src = url;
      v.currentTime = first.start;
      handle = v.requestVideoFrameCallback(onFrame);
      return v.play();
    })
    .catch((e: unknown) => {
      if (stopped) return; // Stopp bricht play() ab: kein Fehler
      console.error(e);
      p.stop();
      useUi.getState().setNotice({ kind: 'error', text: BROKEN_VIDEO });
    });
}

/** Läuft die Vorschau dieses Elements? Ändert sich nur bei Start und Stopp. */
export const usePlaying = (id: string): boolean => useSyncExternalStore(subscribe, () => playing?.id === id);

/** Canvas der laufenden Vorschau dieses Elements (für den Konva-Knoten), sonst undefined. */
export const usePreviewCanvas = (id: string): HTMLCanvasElement | undefined =>
  useSyncExternalStore(subscribe, () => (playing?.id === id ? playing.canvas : undefined));

/** Der Knoten meldet sich an: die Schleife zeichnet nur seine Ebene neu. */
export function attachPreview(id: string, node: Konva.Image | null): void {
  if (playing?.id === id) playing.node = node;
}
