import { elementTypes } from '../core/registries';
import { copyElements, pasteElements } from '../model/clipboard';
import { assetIdOf, maskIdOf } from '../model/elements';
import type { AssetMeta, Element } from '../model/types';
import { editorContext } from '../canvas/editorContext';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { removeMany, tryApply } from './actions';

/** Interner Speicher (nur diese Sitzung, nie nach aussen); Meta der Fotos reist mit, falls das Projekt sie inzwischen verworfen hat. */
let mem: { entries: Element[]; assets: Record<string, AssetMeta>; n: number; step: number; projectId: string } | null = null;
let counter = 0;
const marker = () => `bbzb-social-studio:${mem?.n}`;

export const hasClipboard = (): boolean => mem !== null;

/** Merkt die Auswahl; mit Ereignis auch Marker in `text/plain` (so erkennt Einfügen, dass die Ablage noch von uns ist). */
export function copySelection(e?: ClipboardEvent): boolean {
  const p = useDoc.getState().project;
  const entries = p ? copyElements(p, useUi.getState().selectedIds) : [];
  if (!p || !entries.length) return false;
  const assets: Record<string, AssetMeta> = {};
  for (const el of entries) {
    for (const id of [assetIdOf(el), maskIdOf(el)]) if (id && p.assets[id]) assets[id] = p.assets[id]!;
  }
  mem = { entries, assets, n: ++counter, step: 0, projectId: p.id };
  if (e) {
    e.clipboardData?.setData('text/plain', marker());
    e.preventDefault();
  }
  return true;
}

/** Kopieren, dann Entfernen (ein Undo-Schritt, Gesperrte bleiben). */
export function cutSelection(e?: ClipboardEvent): boolean {
  const els = useDoc.getState().project?.elements ?? {};
  if (useUi.getState().selectedIds.every((id) => els[id]?.locked)) return false; // wie der gesperrte Menüeintrag: nichts tun
  if (!copySelection(e)) return false;
  removeMany(useUi.getState().selectedIds, { hint: false });
  return true;
}

/**
 * Menü «Kopieren»/«Ausschneiden»: löst das echte DOM-Ereignis aus (innerhalb der Klick-Geste), damit der Marker in der
 * Systemablage landet und Strg + V später passt. Fällt zurück auf die interne Funktion, wenn kein Ereignis ankam.
 */
export function clipboardCommand(cmd: 'copy' | 'cut'): void {
  const before = counter;
  document.execCommand?.(cmd);
  if (counter === before) void (cmd === 'copy' ? copySelection() : cutSelection());
}

export function pasteClipboard(e?: ClipboardEvent): void {
  // Word/Excel legen neben dem Text ein Bild davon ab: mit RTF ist es Text, kein Foto
  const files = e?.clipboardData?.types?.includes('text/rtf') ? [] : [...(e?.clipboardData?.files ?? [])];
  if (files.length) {
    e!.preventDefault();
    for (const file of files) {
      const type = elementTypes.all().find((t) => t.acceptsFile?.(file) && t.fromFile);
      if (type) void type.fromFile!(file, editorContext());
      else useUi.getState().setNotice({ kind: 'info', text: 'Diese Datei kann ich nicht verwenden. Erlaubt sind Fotos.' });
    }
    return;
  }
  if (!mem || mem.projectId !== useDoc.getState().project?.id) return;
  if (e && e.clipboardData?.getData('text/plain') !== marker()) return; // fremder Inhalt (z. B. Text in einem Feld)
  e?.preventDefault();
  const { entries, assets, step } = mem;
  let ids: string[] = [];
  const ok = tryApply((d) => {
    for (const [id, meta] of Object.entries(assets)) d.assets[id] ??= meta;
    ids = pasteElements(d, entries, useUi.getState().currentSlide, step);
  });
  if (!ok) return;
  mem.step++;
  useUi.getState().setSelectedIds(ids);
}
