import { invertMask, maskScale, maskSize, newMask, softenMask, type Mask } from '../../../model/mask';
import type { AssetMeta, Element } from '../../../model/types';
import { opfsAssetStore } from '../../../storage/assets';
import { loadMask, maskMeta, saveMask } from '../../../storage/maskAsset';
import { apply, beginWrite, endWrite, gestureOpen, useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { errorText } from '../../../ui/errors';
import { maskOf, type PhotoProps } from './schema';

const FAILED = 'Die Maske liess sich nicht ändern. Versuch es nochmals.';
export const SAVE_FAILED = 'Der Strich ist nicht gespeichert. Mal weiter, dann wird er beim nächsten Strich mitgespeichert.';
export const DROPPED = 'Der Strich ist nicht übernommen, weil die Maske inzwischen anders geändert wurde. Mal ihn nochmals.';
export const MASK_BUSY = 'Die Maske wird gerade geändert. Mal gleich nochmals.';
export const AI_DROPPED = 'Das Freistellen ist nicht übernommen, weil das Foto inzwischen anders bearbeitet wurde.';
const OP_DROPPED = 'Die Änderung ist nicht übernommen, weil die Maske inzwischen anders geändert wurde. Versuch es nochmals.';

const photoOf = (id: string) => useDoc.getState().project?.elements[id] as Element<PhotoProps> | undefined;
const notify = (text: string) => useUi.getState().setNotice({ kind: 'error', text });

/** Eine Kette je Foto: Strich-Speichern und Umkehren/Weich zeichnen laufen der Reihe nach, jeder liest den Stand des Vorgängers. */
const chains = new Map<string, Promise<unknown>>();
const ops = new Map<string, number>();

/** Wartet, bis alle ausstehenden Maskenschreibvorgänge am Foto fertig sind. */
export const maskIdle = (id: string): Promise<unknown> => chains.get(id) ?? Promise.resolve();
/** Läuft gerade Umkehren oder Weich zeichnen am Foto? Dann beginnt kein Strich. */
export const maskOpRunning = (id: string): boolean => (ops.get(id) ?? 0) > 0;

/** `apply` erst, wenn keine Geste offen ist: sonst verschmölze der späte Schritt mit der Geste (z. B. dem nächsten Strich). */
async function applyIdle(recipe: Parameters<typeof apply>[0]): Promise<void> {
  while (gestureOpen()) await new Promise((r) => setTimeout(r, 16));
  apply(recipe);
}

function enqueue(id: string, job: () => Promise<void>, op: boolean): Promise<void> {
  beginWrite(); // Undo/Redo warten, bis das Ergebnis im Dokument ist
  if (op) ops.set(id, (ops.get(id) ?? 0) + 1);
  const run = (chains.get(id) ?? Promise.resolve()).then(job).finally(() => {
    endWrite();
    if (op) ops.set(id, ops.get(id)! - 1);
    if (chains.get(id) === run) chains.delete(id);
  });
  chains.set(id, run);
  return run;
}

/**
 * Speichern eines Strichs: `saving` (aus `saveMask`, liest die Maske sofort) abwarten und die Maske `s` ins Foto schreiben (ein Undo-Schritt).
 * `s.maskId` ist der Stand im Store, auf dem der Strich gemalt wurde; hat ihn inzwischen etwas anderes geändert, wird der Strich nicht
 * darübergeschrieben (Meldung). Nach dem Schreiben gilt `s.maskId = mid`, so passt der nächste Strich der Kette.
 */
export function saveStroke(id: string, s: { mask: Mask; maskId: string | undefined }, saving: Promise<string>): Promise<void> {
  saving.catch(() => {}); // das Ergebnis wird in der Kette abgeholt
  return enqueue(
    id,
    async () => {
      try {
        const mid = await saving;
        const cur = photoOf(id);
        if (!cur) return;
        if (maskOf(cur.props) !== s.maskId) return notify(DROPPED);
        if (mid === s.maskId) return;
        s.maskId = mid;
        await applyIdle((d) => {
          d.assets[mid] ??= maskMeta(s.mask);
          (d.elements[id] as Element<PhotoProps>).props.mask = mid;
        });
      } catch (e) {
        console.error(e);
        // der Modus bleibt offen: die Arbeitskopie hält den Strich, der nächste Strich speichert die ganze Maske
        notify(errorText(e, SAVE_FAILED));
      }
    },
    false,
  );
}

/** Zurücksetzen: die Maske fällt weg, das Foto ist ganz sichtbar (ein Undo-Schritt; die Datei bleibt für Undo). */
export const resetMaskOf = (id: string) => photoOf(id)?.props.mask !== undefined && apply((d) => void delete (d.elements[id] as Element<PhotoProps>).props.mask);

/**
 * Umkehren oder Weich zeichnen der gespeicherten Maske: lesen, ändern, speichern, ein `apply` (ein Undo-Schritt), in der Kette des Fotos
 * (nach ausstehenden Strichen). Bis die neue Maske geladen ist, bleibt die alte Anzeige stehen. Ohne Maske kehrt Umkehren die volle Maske
 * um (alles aus), Weich zeichnen tut nichts. Hat sich die Maske unterwegs geändert (Zurücksetzen), kommt eine Meldung statt Überschreiben.
 */
export function changeMask(id: string, change: (m: Mask, el: Element<PhotoProps>, meta: AssetMeta) => void, needsMask = false): Promise<void> {
  return enqueue(
    id,
    async () => {
      const el = photoOf(id);
      const meta = el && useDoc.getState().project?.assets[el.props.assetId ?? ''];
      const from = el && maskOf(el.props);
      if (!el || !meta || (needsMask && from === undefined)) return;
      try {
        const size = maskSize(meta);
        const m = from ? await loadMask(opfsAssetStore(), from) : newMask(size.width, size.height);
        change(m, el, meta);
        const mid = await saveMask(opfsAssetStore(), m);
        const cur = photoOf(id);
        if (!cur) return;
        if (maskOf(cur.props) !== from) return notify(OP_DROPPED);
        if (mid === from) return;
        await applyIdle((d) => {
          d.assets[mid] ??= maskMeta(m);
          (d.elements[id] as Element<PhotoProps>).props.mask = mid;
        });
      } catch (e) {
        console.error(e);
        notify(errorText(e, FAILED));
      }
    },
    true,
  );
}

export const invertMaskOf = (id: string) => changeMask(id, invertMask);
/** `radius` in Leinwandpixeln (wie die Pinselgrösse), umgerechnet in Maskenpixel: die sichtbare Weichheit hängt nicht von der Auflösung ab. */
export const softenMaskOf = (id: string, radius: number) => changeMask(id, (m, el, meta) => softenMask(m, radius * maskScale(meta, m, el.props.crop)), true);

/**
 * Fertige KI-Maske ins Foto schreiben (ein Undo-Schritt), in der Kette des Fotos (nach ausstehenden Strichen). `from` ist die Masken-ID
 * beim Start des Laufs: hat sich die Maske seither geändert oder ist das Foto weg, wird das Ergebnis verworfen (Meldung).
 */
export function setMaskFromAi(id: string, m: Mask, from: string | undefined): Promise<void> {
  return enqueue(
    id,
    async () => {
      try {
        const mid = await saveMask(opfsAssetStore(), m);
        const cur = photoOf(id);
        if (!cur || maskOf(cur.props) !== from) return notify(AI_DROPPED);
        if (mid === from) return;
        await applyIdle((d) => {
          d.assets[mid] ??= maskMeta(m);
          (d.elements[id] as Element<PhotoProps>).props.mask = mid;
        });
      } catch (e) {
        console.error(e);
        notify(errorText(e, FAILED));
      }
    },
    true,
  );
}
