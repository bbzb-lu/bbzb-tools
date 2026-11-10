import Konva from 'konva';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Mask } from '../../../model/mask';
import { opfsAssetStore } from '../../../storage/assets';
import { loadMask } from '../../../storage/maskAsset';
import { useUi } from '../../../store/ui';

export const MASK_FAILED = 'Eine Maske liess sich nicht lesen. Das Foto erscheint ohne Maske.';

/**
 * Arbeitskopien (Pinsel, Task 3): Element-Id → Maske, die statt der gespeicherten angezeigt wird. Setzen oder Entfernen rendert das
 * Element einmal neu (am Anfang und Ende des Malens), nie pro Mausbewegung: dazwischen malt der Pinsel mit `paintMasked` direkt in die
 * angezeigte Canvas (`image()` des Bildknotens) und zeichnet nur die Ebene neu.
 */
const working = new Map<string, Mask>();
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export function setWorkingMask(id: string, m: Mask | undefined): void {
  if (m) working.set(id, m);
  else working.delete(id);
  subs.forEach((f) => f());
}

/** Foto mit Maske als Deckkraft in `canvas` (Grösse des Fotos): die Maske liegt im Pixelraum des Fotos, wird auf das ganze Foto gestreckt. */
export function paintMasked(canvas: HTMLCanvasElement, img: HTMLImageElement, m: Mask): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const alpha = new ImageData(m.width, m.height);
  for (let i = 0; i < m.data.length; i++) alpha.data[i * 4 + 3] = m.data[i]!;
  const a = new OffscreenCanvas(m.width, m.height);
  a.getContext('2d')!.putImageData(alpha, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(a, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  a.width = a.height = 0;
}

let serial = 0;

/**
 * Bildquelle eines Fotos mit Maske: Canvas in Fotogrösse mit der Maske als Deckkraft. Weil sie das Foto ersetzt, gelten Ausschnitt,
 * Spiegeln, Box und Drehung für beide gleich, und Effekte, Kontur und Export rechnen schon mit der Maske. Ohne Maske das Foto selbst.
 * Lädt die Maske: kein Bild, `pending` (der Export wartet). Defekte Maske: Foto ohne Maske und einmal eine Meldung.
 * `key` ändert sich mit jeder neuen Canvas (für die Schlüssel von Effekt und Kontur).
 * shortcut: eine Canvas in Fotogrösse je Element mit Maske (bis 64 MB bei 4096²); bei Speichernot in Bildbereichsgrösse rechnen.
 */
export function useMaskedImage(id: string, img: HTMLImageElement | undefined, maskId: string | undefined) {
  const work = useSyncExternalStore(subscribe, () => working.get(id));
  const [loaded, setLoaded] = useState<{ maskId: string; mask?: Mask }>();
  const done = loaded !== undefined && loaded.maskId === maskId;
  useEffect(() => {
    // schon geladen (z. B. Arbeitskopie wieder entfernt, ohne neue Maske): nicht nochmals lesen
    if (maskId === undefined || work || done) return;
    let live = true;
    loadMask(opfsAssetStore(), maskId).then(
      (mask) => live && setLoaded({ maskId, mask }),
      (e: unknown) => {
        console.error(e);
        if (!live) return;
        setLoaded({ maskId });
        const { notice, setNotice } = useUi.getState();
        if (notice?.text !== MASK_FAILED) setNotice({ kind: 'error', text: MASK_FAILED });
      },
    );
    return () => {
      live = false;
    };
  }, [maskId, work, done]);
  const mask = work ?? (done ? loaded.mask : undefined);

  const [shown, setShown] = useState<{ img: HTMLImageElement; mask: Mask; canvas: HTMLCanvasElement; key: string }>();
  const current = !!img && !!mask && shown?.img === img && shown.mask === mask;
  // nichts zu maskieren: kein Foto, keine Maske, oder Maske defekt (nicht: neue Maske lädt noch)
  const none = !img || (!work && (maskId === undefined || (done && !loaded.mask)));
  useEffect(() => {
    // lädt die Maske noch, bleibt die alte Canvas stehen (kein Aufblitzen); sie wird erst mit der neuen ersetzt und freigegeben
    if (current || (!mask && !(none && shown))) return;
    // ein Bild abwarten (wie Effekte und Kontur); ohne Foto oder Maske die alte Canvas abgeben
    const frame = requestAnimationFrame(() => {
      if (!img || !mask) return setShown(undefined);
      const canvas = document.createElement('canvas');
      [canvas.width, canvas.height] = [img.naturalWidth, img.naturalHeight];
      paintMasked(canvas, img, mask);
      setShown({ img, mask, canvas, key: `m${++serial}` });
    });
    return () => cancelAnimationFrame(frame);
  }, [img, mask, shown, current, none]);
  // ersetzte oder verworfene Canvas freigeben
  useEffect(() => () => void (shown && Konva.Util.releaseCanvas(shown.canvas)), [shown]);

  if (!img) return { img: undefined, pending: false, key: '' };
  if (none) return { img, pending: false, key: '' };
  if (current) return { img: shown!.canvas, pending: false, key: shown!.key };
  // neue Maske lädt (Undo/Redo, Strichende): die alte bleibt stehen, kein Aufblitzen; der Export wartet trotzdem
  if (shown?.img === img) return { img: shown.canvas, pending: true, key: shown.key };
  return { img: undefined, pending: true, key: '' };
}
