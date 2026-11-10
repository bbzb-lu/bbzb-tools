import type { MenuItem } from '../core/types';
import { groupOf, LIMIT_TEXT, MAX_SLIDES } from '../model/slides';
import { redo, undo, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { KEYS, keysAttr } from './keys';
import { duplicateSlideAt, removeSlideAt, stepSlide } from './layoutActions';
import { saveProjectFile } from './projectFileActions';

/** Rechtsklick auf eine Slide-Kachel: duplizieren, verschieben, löschen (verknüpfte Slides als Gruppe). */
export function slideMenuItems(i: number): MenuItem[] {
  const slides = useDoc.getState().project!.slides;
  const [first, last] = groupOf({ slides }, i);
  const n = last - first + 1;
  const what = n > 1 ? `${n} Slides` : 'Slide';
  return [
    {
      id: 'slide-duplicate',
      label: `${what} duplizieren`,
      disabled: slides.length + n > MAX_SLIDES ? LIMIT_TEXT : undefined,
      run: () => duplicateSlideAt(i),
    },
    { id: 'slide-left', label: 'Nach links', disabled: first === 0 ? 'Das ist schon die erste Slide.' : undefined, run: () => stepSlide(i, -1) },
    { id: 'slide-right', label: 'Nach rechts', disabled: last === slides.length - 1 ? 'Das ist schon die letzte Slide.' : undefined, run: () => stepSlide(i, 1) },
    { separator: true },
    { id: 'slide-remove', label: `${what} löschen`, disabled: slides.length <= n ? 'Eine Slide bleibt immer.' : undefined, run: () => removeSlideAt(i) },
  ];
}

/** Rechtsklick irgendwo sonst im Editor (Kopfzeile, Bibliothek, Inspektor, leere Flächen). */
export function appMenuItems(): MenuItem[] {
  const { pastStates, futureStates } = useDoc.temporal.getState();
  return [
    { id: 'undo', label: 'Rückgängig', keys: keysAttr(KEYS.undo), disabled: pastStates.length ? undefined : 'Es gibt nichts rückgängig zu machen.', run: undo },
    { id: 'redo', label: 'Wiederholen', keys: keysAttr(KEYS.redo), disabled: futureStates.length ? undefined : 'Es gibt nichts zu wiederholen.', run: redo },
    { separator: true },
    { id: 'save', label: 'Projektdatei sichern', keys: keysAttr(KEYS.save), run: () => void saveProjectFile() },
    { id: 'export', label: 'Exportieren', keys: keysAttr(KEYS.export), run: () => useUi.getState().requestExport() },
  ];
}
