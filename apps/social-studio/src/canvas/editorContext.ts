import type { EditorContext } from '../core/types';
import { opfsAssetStore } from '../storage/assets';
import { apply, useDoc } from '../store/document';
import { useUi } from '../store/ui';

/** Momentaufnahme für eine Aktion (Hinzufügen, Datei-Drop). */
export function editorContext(): EditorContext {
  const project = useDoc.getState().project!;
  // Ein Foto-Import wartet; wer inzwischen das Projekt gewechselt hat, bekommt nichts davon (das Asset räumt die GC weg).
  const current = () => useDoc.getState().project?.id === project.id;
  return {
    project,
    currentSlide: useUi.getState().currentSlide,
    apply: (recipe) => { if (current()) apply(recipe); },
    assets: opfsAssetStore(),
    select: (id) => { if (current()) useUi.getState().setSelectedId(id); },
    notify: (kind, text) => useUi.getState().setNotice({ kind, text }),
  };
}
