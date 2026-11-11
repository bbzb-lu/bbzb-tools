import { produce } from 'immer';
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Project } from '../model/types';
import { useUi } from './ui';

interface DocState {
  project: Project | null;
}

const LIMIT = 100;

export const useDoc = create<DocState>()(
  temporal(() => ({ project: null }) as DocState, {
    partialize: (s) => ({ project: s.project }),
    limit: LIMIT,
  }),
);

const temporalState = () => useDoc.temporal.getState();

let gestureStart: Project | null | undefined;

export function load(p: Project | null): void {
  gestureStart = undefined; // offene Geste gehört zum alten Dokument
  if (useDoc.getState().project?.id !== p?.id) {
    // Auswahl, Slide und Zoom gehören zum alten Projekt
    useUi.setState({ selectedIds: [], selectedId: null, currentSlide: 0, cropEditId: null, textEditId: null, maskEditId: null, zoom: 1 });
  }
  temporalState().pause();
  useDoc.setState({ project: p });
  temporalState().clear();
  temporalState().resume();
}

/** Wirft das Rezept, bleibt Projekt und History unverändert. */
export function apply(recipe: (draft: Project) => void): void {
  const { project } = useDoc.getState();
  if (!project) return;
  const next = produce(project, (d) => {
    recipe(d);
    d.updatedAt = Date.now();
  });
  useDoc.setState({ project: next });
}

/** Läuft gerade eine Geste (History pausiert)? */
export const gestureOpen = (): boolean => gestureStart !== undefined;

export function startGesture(): void {
  if (gestureStart !== undefined) return;
  gestureStart = useDoc.getState().project;
  temporalState().pause();
}

export function endGesture(): void {
  if (gestureStart === undefined) return;
  const start = gestureStart;
  gestureStart = undefined;
  const t = temporalState();
  t.resume();
  if (useDoc.getState().project === start) return;
  useDoc.temporal.setState({
    pastStates: [...t.pastStates, { project: start }].slice(-LIMIT),
    futureStates: [],
  });
}

/** Ausstehende Schreibvorgänge, deren Ergebnis noch ins Dokument kommt (z. B. Maske speichern): Undo/Redo warten, sonst überschriebe der späte `apply` den neuen Stand. */
let writes = 0;
export const writePending = (): boolean => writes > 0;
export const beginWrite = (): void => void writes++;
export const endWrite = (): void => void (writes = Math.max(0, writes - 1));

// Während einer Geste oder eines ausstehenden Schreibens wirkungslos.
export const undo = (): void => { if (gestureStart === undefined && writes === 0) temporalState().undo(); };
export const redo = (): void => { if (gestureStart === undefined && writes === 0) temporalState().redo(); };
