import { duplicateElement, duplicateElements, layerStep, moveElements, moveInOrder, removeElement, removeElements, updateElement } from '../model/elements';
import { elementBounds, elementsOnSlide, intersects, slideIndexOf } from '../model/geometry';
import { ModelError } from '../model/slides';
import type { Element, Project } from '../model/types';
import { apply, undo, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { notice } from '../tokens';

/** Ein apply; Modellfehler (z. B. Slide-Grenze) als Meldung statt Absturz. */
export function tryApply(recipe: (d: Project) => void): boolean {
  try {
    apply(recipe);
    return true;
  } catch (e) {
    if (!(e instanceof ModelError)) throw e;
    useUi.getState().setNotice({ kind: 'error', text: e.message });
    return false;
  }
}

/**
 * Hält die Auswahl gültig: ein gewähltes Element bestimmt die aktuelle Slide;
 * verschwindet es (Löschen, Undo, Redo) oder liegt es nicht auf der neuen aktuellen Slide, enden Auswahl und Modi.
 * Fallen Slides weg, wird die aktuelle Slide auf die letzte gesetzt.
 * Gibt die Abmeldung zurück.
 */
export function installSelectionSync(): () => void {
  /** Auswahl auf `keep` kürzen; Modi enden mit. */
  const shrink = (keep: string[]) => {
    const ui = useUi.getState();
    if (keep.length === ui.selectedIds.length) return;
    ui.setSelectedIds(keep);
    useUi.setState({ cropEditId: null, textEditId: null, maskEditId: null });
  };
  const offDoc = useDoc.subscribe(({ project }) => {
    const { selectedIds, currentSlide } = useUi.getState();
    if (project) shrink(selectedIds.filter((id) => project.elements[id]));
    else shrink([]);
    // Einzige Stelle, die die aktuelle Slide gültig hält (Undo/Redo kann Slides entfernen).
    if (project && currentSlide >= project.slides.length) useUi.getState().setCurrentSlide(project.slides.length - 1);
  });
  const offUi = useUi.subscribe(({ selectedId, selectedIds, currentSlide }, prev) => {
    const p = useDoc.getState().project;
    if (!p || !selectedIds.length) return;
    const el = selectedId && selectedId !== prev.selectedId ? p.elements[selectedId] : undefined;
    // Kein Kreislauf: slideIndexOf liefert eine Slide, auf der das Element liegt, die zweite Regel greift dann nicht.
    if (el) useUi.getState().setCurrentSlide(slideIndexOf(p, el));
    else if (currentSlide !== prev.currentSlide) {
      const here = elementsOnSlide(p, currentSlide);
      shrink(selectedIds.filter((id) => here.includes(id)));
    }
  });
  return () => {
    offDoc();
    offUi();
  };
}

/** updateElement ohne leeren Undo-Schritt, wenn sich kein Wert ändert. */
export function patchElement(id: string, patch: Partial<Element>): void {
  const cur = useDoc.getState().project?.elements[id];
  if (!cur) return;
  const same = (Object.keys(patch) as (keyof Element)[]).every((k) => JSON.stringify(cur[k]) === JSON.stringify(patch[k]));
  if (!same) tryApply((d) => updateElement(d, id, patch));
}

const exists = (id: string) => useDoc.getState().project?.elements[id];

/** `inPlace`: Kopie genau auf dem Original statt um 40 px versetzt. */
export function duplicate(id: string, { inPlace = false } = {}): void {
  if (!exists(id)) return;
  let copy = '';
  if (tryApply((d) => void (copy = duplicateElement(d, id, inPlace ? 0 : 40)))) useUi.getState().setSelectedId(copy);
}

/** Rückgängig-Hinweis in der Kontextleiste für die eben ausgeführte Aktion (der aktuelle Stand). */
export const undoHint = (text: string): void => useUi.getState().setUndoHint({ text, project: useDoc.getState().project!, until: Date.now() + notice.undoMs });

/** «Rückgängig» im Hinweis: nur wenn die Aktion noch die letzte ist; bleibt das Undo wirkungslos (Schreiben steht aus), bleibt der Hinweis. */
export function undoFromHint(): void {
  const h = useUi.getState().undoHint;
  if (h && useDoc.getState().project === h.project) undo();
  if (useDoc.getState().project !== h?.project) useUi.getState().setUndoHint(null);
}
const removedText = (n: number) => (n === 1 ? 'Ebene gelöscht' : `${n} Elemente gelöscht`);

/** Gesperrte Elemente bleiben. */
export function remove(id: string): void {
  if (exists(id)?.locked === false && tryApply((d) => removeElement(d, id))) undoHint(removedText(1));
}

const existing = (ids: string[]) => ids.filter(exists);

/** Gesperrte bleiben; ein Undo-Schritt. `hint`: Rückgängig-Hinweis zeigen (nicht beim Ausschneiden). */
export function removeMany(ids: string[], { hint = true } = {}): void {
  const go = existing(ids).filter((id) => !exists(id)!.locked);
  if (go.length && tryApply((d) => removeElements(d, go)) && hint) undoHint(removedText(go.length));
}

/** Wählt danach die Kopien. */
export function duplicateMany(ids: string[], { inPlace = false } = {}): void {
  const src = existing(ids);
  let copies: string[] = [];
  if (src.length && tryApply((d) => void (copies = duplicateElements(d, src, inPlace ? 0 : 40)))) useUi.getState().setSelectedIds(copies);
}

/** Setzt `patch` auf alle (auch Gesperrte, für locked/visible); kein leerer Undo-Schritt. */
export function patchMany(ids: string[], patch: Partial<Element>): void {
  const keys = Object.keys(patch) as (keyof Element)[];
  // JSON-Vergleich: props/Objekte gelten als gleich, wenn der Inhalt gleich ist.
  const todo = existing(ids).filter((id) => keys.some((k) => JSON.stringify(exists(id)![k]) !== JSON.stringify(patch[k])));
  if (todo.length) tryApply((d) => todo.forEach((id) => updateElement(d, id, patch)));
}

/** Gesperrte und Ausgeblendete bleiben. */
export function nudge(ids: string[], dx: number, dy: number): void {
  const go = existing(ids).filter((id) => !exists(id)!.locked && exists(id)!.visible);
  if (go.length && (dx || dy)) tryApply((d) => moveElements(d, go, dx, dy));
}

/** «Nach vorne» (1) bzw. «Nach hinten» (-1): am nächsten überlagernden Element vorbei. */
export function restack(id: string, dir: 1 | -1): void {
  tryApply((d) => {
    const to = layerStep(d, id, dir);
    if (to >= 0) moveInOrder(d, id, to);
  });
}

/**
 * Mehrere Elemente in Ablagereihenfolge (vorne: oberstes zuerst), ein Undo-Schritt. Jedes Element geht an dem nächsten
 * überlagernden Nicht-Gewählten vorbei; trifft es vorher auf ein anderes gewähltes, bleibt es (Reihenfolge der Gruppe bleibt).
 */
export function restackMany(ids: string[], dir: 1 | -1): void {
  tryApply((d) => {
    const sel = new Set(ids);
    const sorted = d.order.filter((id) => sel.has(id));
    if (dir === 1) sorted.reverse();
    for (const id of sorted) {
      const b = elementBounds(d.elements[id]!);
      for (let j = d.order.indexOf(id) + dir; j >= 0 && j < d.order.length; j += dir) {
        const other = d.order[j]!;
        if (sel.has(other)) break;
        if (intersects(b, elementBounds(d.elements[other]!))) {
          moveInOrder(d, id, j);
          break;
        }
      }
    }
  });
}

/** «Bitte prüfen» der Slide `i` erledigt, ein Undo-Schritt. */
export const markReviewed = (i: number): boolean => tryApply((d) => void delete d.slides[i]!.review);
