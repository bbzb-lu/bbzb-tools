import { referencedAssetIds, withReferencedAssets } from '../model/elements';
import type { Project } from '../model/types';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { saveProject } from './db';

const DELAY_MS = 500;
export const ERROR_TEXT = 'Speichern hat nicht geklappt. Sichere dein Projekt als Datei.';

/**
 * Dateien aller Stände, die Undo/Redo noch erreicht (Bilder, Masken): gespeichert wird `assets` nur für das Aktuelle, damit
 * überholte Masken nicht ewig in der Zeile stehen; was Undo braucht, schützt die GC über `keep`.
 */
function historyAssets(p: Project): string[] {
  const t = useDoc.temporal.getState();
  const all = new Set<string>();
  for (const s of [...t.pastStates, ...t.futureStates]) if (s.project) for (const id of referencedAssetIds(s.project)) all.add(id);
  const saved = withReferencedAssets(p).assets;
  return [...all].filter((id) => !(id in saved));
}

export function startAutosave(target: EventTarget = window): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;

  // Startet den Schreibvorgang synchron (pagehide erlaubt kein await davor).
  const flush = () => {
    clearTimeout(timer);
    const p = useDoc.getState().project;
    if (!p || !dirty) return;
    dirty = false;
    saveProject(withReferencedAssets(p), historyAssets(p)).then(
      () => {
        if (useUi.getState().notice?.text === ERROR_TEXT) useUi.getState().setNotice(null);
      },
      () => {
        dirty = true;
        useUi.getState().setNotice({ kind: 'error', text: ERROR_TEXT });
      },
    );
  };
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush();
  };

  const unsub = useDoc.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    dirty = s.project !== null;
    clearTimeout(timer);
    timer = setTimeout(flush, DELAY_MS);
  });
  target.addEventListener('pagehide', flush);
  target.addEventListener('visibilitychange', onVisibility);
  return () => {
    unsub();
    clearTimeout(timer);
    target.removeEventListener('pagehide', flush);
    target.removeEventListener('visibilitychange', onVisibility);
  };
}
