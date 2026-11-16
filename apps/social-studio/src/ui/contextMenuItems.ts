import { elementTypes } from '../core/registries';
import type { MenuItem } from '../core/types';
import { lockedOrHiddenOnSlide } from '../model/selection';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { duplicateMany, patchMany, removeMany, restackMany } from './actions';
import { clipboardCommand, pasteClipboard } from './clipboard';
import { KEYS, keysAttr } from './keys';

const LOCKED = 'Gesperrte Elemente bleiben. Entsperre sie zuerst.';
const SEP: MenuItem = { separator: true };

/** Je ein Eintrag pro gesperrtem oder ausgeblendetem Element der Slide: Wiederherstellen direkt auf der Leinwand. */
function restoreItems(slide: number): MenuItem[] {
  const p = useDoc.getState().project;
  return (p ? lockedOrHiddenOnSlide(p, slide) : []).map((e) => {
    const verbs = [e.locked && 'entsperren', !e.visible && 'einblenden'].filter(Boolean).join(' und ');
    return {
      id: `restore-${e.id}`,
      label: `${e.name} ${verbs}`,
      run: () => {
        patchMany([e.id], { locked: false, visible: true });
        useUi.getState().setSelectedId(e.id);
      },
    };
  });
}

/**
 * Einträge des Rechtsklickmenüs. Die Aktionen arbeiten auf `ids` bzw. der aktuellen Auswahl;
 * `openContextMenu` setzt die Auswahl vorher auf `ids`. Mit `slide` (Rechtsklick auf der Leinwand) stehen oben die Einträge
 * zum Entsperren und Einblenden der Elemente dieser Slide.
 */
export function menuItemsFor(ids: string[], slide?: number): MenuItem[] {
  const restore = slide === undefined ? [] : restoreItems(slide);
  return [...(restore.length ? [...restore, SEP] : []), ...baseItems(ids)];
}

function baseItems(ids: string[]): MenuItem[] {
  const els = useDoc.getState().project?.elements ?? {};
  const sel = ids.map((id) => els[id]).filter((e) => e !== undefined);
  const paste: MenuItem = {
    id: 'paste',
    label: 'Einfügen',
    keys: keysAttr(KEYS.paste),
    run: () => pasteClipboard(),
  };
  if (!sel.length) return [paste];
  const all = sel.map((e) => e.id);
  const locked = sel.every((e) => e.locked);
  const shown = sel.every((e) => e.visible);
  const own = sel.length === 1 && elementTypes.has(sel[0]!.type) ? (elementTypes.get(sel[0]!.type).menuItems?.(sel[0]!) ?? []) : [];
  return [
    { id: 'copy', label: 'Kopieren', keys: keysAttr(KEYS.copy), run: () => clipboardCommand('copy') },
    { id: 'cut', label: 'Ausschneiden', keys: keysAttr(KEYS.cut), disabled: locked ? LOCKED : undefined, run: () => clipboardCommand('cut') },
    paste,
    { id: 'duplicate', label: 'Duplizieren', keys: keysAttr(KEYS.duplicate), run: () => duplicateMany(all) },
    { id: 'duplicate-in-place', label: 'An gleicher Stelle duplizieren', run: () => duplicateMany(all, { inPlace: true }) },
    SEP,
    { id: 'front', label: 'Nach vorne', run: () => restackMany(all, 1) },
    { id: 'back', label: 'Nach hinten', run: () => restackMany(all, -1) },
    SEP,
    { id: 'lock', label: locked ? 'Entsperren' : 'Sperren', run: () => patchMany(all, { locked: !locked }) },
    { id: 'visible', label: shown ? 'Ausblenden' : 'Einblenden', run: () => patchMany(all, { visible: !shown }) },
    {
      id: 'remove',
      label: 'Löschen',
      keys: keysAttr(KEYS.remove),
      disabled: locked ? LOCKED : undefined,
      run: () => removeMany(all),
    },
    ...(own.length ? [SEP, ...own] : []),
  ];
}
