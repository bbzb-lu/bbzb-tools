import { IconCopy, IconCopyPlus, IconStackBack, IconStackFront, IconTrash } from '@tabler/icons-react';
import { useDoc } from '../store/document';
import { duplicateMany, removeMany, restackMany } from './actions';
import { KEYS, keysAttr } from './keys';

/** Ebene-Aktionen für mehrere Elemente (Inspector und Kontextleiste): Duplizieren, an gleicher Stelle, Nach vorne, Nach hinten, Löschen. */
export function MultiActions({ ids }: { ids: string[] }) {
  const els = useDoc((s) => s.project?.elements);
  const all = ids.filter((id) => els?.[id]);
  const allLocked = all.every((id) => els![id]!.locked);
  return (
    <>
      <button type="button" className="icon-btn" aria-label="Duplizieren" data-tip="Duplizieren" data-keys={keysAttr(KEYS.duplicate)} onClick={() => duplicateMany(all)}>
        <IconCopy aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" aria-label="An gleicher Stelle duplizieren" data-tip="An gleicher Stelle duplizieren" onClick={() => duplicateMany(all, { inPlace: true })}>
        <IconCopyPlus aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" aria-label="Nach vorne" data-tip="Nach vorne" onClick={() => restackMany(all, 1)}>
        <IconStackFront aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" aria-label="Nach hinten" data-tip="Nach hinten" onClick={() => restackMany(all, -1)}>
        <IconStackBack aria-hidden="true" />
      </button>
      <button type="button" data-tip="Löschen" data-keys={keysAttr(KEYS.remove)} disabled={allLocked} onClick={() => removeMany(all)}>
        <IconTrash aria-hidden="true" />
        Löschen
      </button>
    </>
  );
}
