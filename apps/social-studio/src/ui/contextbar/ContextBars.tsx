import { useEffect, useSyncExternalStore } from 'react';
import { contextBars } from '../../core/registries';
import { useDoc } from '../../store/document';
import { useUi } from '../../store/ui';
import { editBars } from './editBars';
import { hintBars } from './hintBars';
import { pickBar } from './pick';

const core = [...editBars, ...hintBars];
const states = () => [...core, ...contextBars.all()];
const top = () => pickBar(states())?.id ?? null;
/** Ansage: aktive Leiste mit kleinstem Rang, die etwas zu sagen hat (KI auch, wenn eine andere Leiste oben steht). */
const announcement = () => pickBar(states().filter((s) => s.announce))?.announce!() ?? '';
const subscribe = (cb: () => void) => {
  const a = useUi.subscribe(cb);
  const b = useDoc.subscribe(cb);
  return () => {
    a();
    b();
  };
};

/** Höchstens eine Kontextleiste: die oberste aktive aus Kern und Registry (`contextBars`). Rendert nur, wenn sich die oberste ändert. */
export function ContextBars() {
  const id = useSyncExternalStore(subscribe, top);
  // Rückgängig-Hinweis gilt nur für den Stand direkt nach der Aktion: jede Änderung (auch Undo) beendet ihn, ein späteres Redo bringt ihn nicht zurück
  useEffect(
    () =>
      useDoc.subscribe(({ project }) => {
        const h = useUi.getState().undoHint;
        if (h && h.project !== project) useUi.getState().setUndoHint(null);
      }),
    [],
  );
  const say = useSyncExternalStore(subscribe, announcement);
  const s = id ? states().find((x) => x.id === id) : undefined;
  return (
    <>
      {/* immer im DOM, sonst ginge die erste Ansage verloren; ändert sich nur mit dem Text (KI je Phase, nicht je Prozent) */}
      <span id="context-live" className="sr-only" role="status">
        {say}
      </span>
      {s && <s.Bar key={id} />}
    </>
  );
}
