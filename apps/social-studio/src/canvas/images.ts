import { useEffect, useState } from 'react';
import { opfsAssetStore } from '../storage/assets';
import { useUi } from '../store/ui';

export const MISSING_IMAGE = 'Ein Bild fehlt im Speicher. Öffne die Projektdatei erneut.';
/** Name des Platzhalters für ein fehlendes Bild in der Ebene «content»; der Export bricht dann ab. */
export const MISSING_IMAGE_NODE = 'missing-image';
export const MISSING_VIDEO = 'Video fehlt. Füge es neu ein.';
export const BROKEN_VIDEO = 'Video lässt sich nicht abspielen. Füge es neu ein oder wandle es um.';
/** Wie MISSING_IMAGE_NODE, für ein Video, das fehlt oder sich nicht dekodieren lässt; Attribut `notice` trägt die Meldung. */
export const MISSING_VIDEO_NODE = 'missing-video';
/** Videodatei im Speicher? Videos nie als Bild dekodieren (`loadAssetImage`), die Frames liefert `useVideoFrame`. */
export const videoStored = (id: string): Promise<boolean> => opfsAssetStore().get(id).then(() => true, () => false);
export const MISSING_BRAND = 'Ein Scribble oder Icon fehlt. Lösche es und füge es aus der Bibliothek neu ein.';
/** Wie MISSING_IMAGE_NODE, für ein Markenbild (fehlt im Manifest oder lädt nicht). */
export const MISSING_BRAND_NODE = 'missing-brand';

/** Meldung im Editor, sobald ein Markenbild (Scribble, Icon, Pin im Ort-Tag) fehlt. */
export function useMissingBrandNotice(failed: boolean): void {
  useEffect(() => {
    if (!failed) return;
    const { notice, setNotice } = useUi.getState();
    if (notice?.text !== MISSING_BRAND) setNotice({ kind: 'error', text: MISSING_BRAND });
  }, [failed]);
}

// shortcut: Object-URLs werden nie freigegeben, aufräumen falls Speicher bei langen Sitzungen knapp wird
const cache = new Map<string, Promise<HTMLImageElement>>();
/** Zuletzt fehlgeschlagene Bilder; der Export prüft daran, ohne auf React zu warten. */
const failedIds = new Set<string>();
export const imageFailed = (id: string): boolean => failedIds.has(id);

export function loadAssetImage(id: string): Promise<HTMLImageElement> {
  let p = cache.get(id);
  if (!p) {
    p = opfsAssetStore()
      .get(id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        return img.decode().then(
          () => img,
          (e) => {
            URL.revokeObjectURL(url);
            throw e;
          },
        );
      })
      .then(
        (img) => (failedIds.delete(id), img),
        (e) => {
          failedIds.add(id);
          throw e;
        },
      );
    const failed = p;
    // Fehler nicht cachen: nach erneutem Import der Projektdatei soll es wieder klappen.
    failed.catch(() => cache.get(id) === failed && cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/**
 * Gebündeltes Bild (Markenbild) per URL. Nie per fetch: kleine SVGs sind data:-URIs, connect-src 'self' sperrt sie.
 * Im selben Cache wie die Fotos, damit der Export darauf wartet.
 */
export function loadUrlImage(url: string): Promise<HTMLImageElement> {
  const key = `url:${url}`;
  let p = cache.get(key);
  if (!p) {
    const img = new Image();
    img.src = url;
    const loading = img.decode().then(() => img);
    loading.catch(() => cache.get(key) === loading && cache.delete(key));
    cache.set(key, (p = loading));
  }
  return p;
}

/** Wartet auf alle angefragten Bilder (für den Export), auch auf solche, die während des Wartens dazukommen. */
export async function allImagesLoaded(): Promise<void> {
  let seen: Promise<HTMLImageElement>[];
  do {
    seen = [...cache.values()];
    await Promise.allSettled(seen);
  } while ([...cache.values()].some((p) => !seen.includes(p)));
}

/** Lädt: beides leer. Fehlt das Bild: failed, und einmal eine Meldung. Ohne id (leerer Platzhalter): nichts. */
export function useAssetImage(id: string | undefined): { img?: HTMLImageElement; failed: boolean } {
  const [state, setState] = useState<{ id: string; img?: HTMLImageElement }>();
  useEffect(() => {
    if (id === undefined) return;
    let live = true;
    loadAssetImage(id).then(
      (img) => live && setState({ id, img }),
      () => {
        if (!live) return;
        setState({ id });
        const { notice, setNotice } = useUi.getState();
        if (notice?.text !== MISSING_IMAGE) setNotice({ kind: 'error', text: MISSING_IMAGE });
      },
    );
    return () => {
      live = false;
    };
  }, [id]);
  const done = id !== undefined && state?.id === id;
  return { img: done ? state.img : undefined, failed: done && !state.img };
}
