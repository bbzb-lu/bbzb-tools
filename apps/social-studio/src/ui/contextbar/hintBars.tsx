import { IconAlertCircle, IconArrowBackUp, IconLayersSubtract, IconTrash } from '@tabler/icons-react';
import { useEffect } from 'react';
import { barRank } from '../../core/registries';
import type { ContextBarState } from '../../core/types';
import { useDoc } from '../../store/document';
import { useUi } from '../../store/ui';
import { notice } from '../../tokens';
import { markReviewed, undoFromHint } from '../actions';
import { ContextBar } from '../ContextBar';
import { MultiActions } from '../MultiActions';

function MultiBar() {
  const ids = useUi((s) => s.selectedIds);
  return (
    <ContextBar ids={ids} label={`${ids.length} Elemente`} icon={<IconLayersSubtract aria-hidden="true" />}>
      <MultiActions ids={ids} />
    </ContextBar>
  );
}

function ReviewBar() {
  const i = useUi((s) => s.currentSlide);
  return <ContextBar ids={[]} label="Bitte prüfen" icon={<IconAlertCircle aria-hidden="true" />} hint="Diese Slide kommt aus dem anderen Format, bitte prüfen" onDone={() => markReviewed(i)} doneLabel="Geprüft" />;
}

/** Nach dem Löschen: «Rückgängig», solange die Aktion die letzte in der History ist. Verschwindet nach `notice.undoMs`; Hover und Fokus halten ihn. */
function UndoBar() {
  const hint = useUi((s) => s.undoHint)!;
  useEffect(() => {
    if (hint.until === Infinity) return;
    const t = window.setTimeout(() => useUi.getState().setUndoHint(null), hint.until - Date.now());
    return () => clearTimeout(t);
  }, [hint]);
  // Halten: kein Ablauf; loslassen: die volle Zeit läuft neu (wie bei Meldungen)
  const hold = (held: boolean) => {
    const h = useUi.getState().undoHint;
    if (h && (h.until === Infinity) !== held) useUi.getState().setUndoHint({ ...h, until: held ? Infinity : Date.now() + notice.undoMs });
  };
  // verdrängt eine höhere Leiste den gehaltenen Hinweis (kein pointerleave/blur), läuft seine Zeit trotzdem ab
  useEffect(() => () => hold(false), []);
  return (
    <ContextBar ids={[]} label={hint.text} icon={<IconTrash aria-hidden="true" />} onHold={hold}>
      <button type="button" onClick={undoFromHint}>
        <IconArrowBackUp aria-hidden="true" />
        Rückgängig
      </button>
    </ContextBar>
  );
}

const ui = useUi.getState;
const review = () => !!useDoc.getState().project?.slides[ui().currentSlide]?.review;

/** Hinweise ohne Bearbeitungsmodus: Mehrfachauswahl, «Bitte prüfen», Rückgängig nach dem Löschen. */
export const hintBars: ContextBarState[] = [
  { id: 'multi', rank: barRank.multi, active: () => ui().selectedIds.length > 1, Bar: MultiBar },
  { id: 'review', rank: barRank.review, active: review, Bar: ReviewBar },
  { id: 'undo', rank: barRank.undo, active: () => !!ui().undoHint && ui().undoHint!.project === useDoc.getState().project && Date.now() < ui().undoHint!.until, announce: () => ui().undoHint!.text, Bar: UndoBar },
];
