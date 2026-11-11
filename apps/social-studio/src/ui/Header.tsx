import { Header as BbzbHeader } from '@bbzb/ui';
import { IconHome, IconArrowForwardUp, IconDeviceFloppy, IconArrowBackUp } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { blurIntoMenu } from './ContextMenu';
import { useStore } from 'zustand';
import { withReferencedAssets } from '../model/elements';
import { apply, load, redo, undo, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { ERROR_TEXT } from '../storage/autosave';
import { saveProject } from '../storage/db';
import { ExportDialog } from './ExportDialog';
import { SettingsDialog } from './SettingsDialog';
import { saveProjectFile } from './projectFileActions';
import { KEYS, keysAttr } from './keys';

export function Header() {
  const name = useDoc((s) => s.project?.name ?? '');
  const [draft, setDraft] = useState(name);
  const canUndo = useStore(useDoc.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDoc.temporal, (s) => s.futureStates.length > 0);
  const [shown, setShown] = useState(name);
  if (name !== shown) {
    // Name von aussen geändert (z. B. Rückgängig)
    setShown(name);
    setDraft(name);
  }

  const cancelled = useRef(false); // Esc: das Verlassen des Felds übernimmt den Entwurf nicht
  const commit = () => {
    if (cancelled.current) return void (cancelled.current = false);
    const next = draft.trim();
    if (!next) return setDraft(name);
    if (next !== name) apply((p) => void (p.name = next));
  };

  const back = async () => {
    const p = useDoc.getState().project;
    try {
      // History endet hier, also dürfen nicht mehr referenzierte Bilder raus (GC räumt sie dann weg).
      if (p) await saveProject(withReferencedAssets(p));
      load(null);
    } catch {
      useUi.getState().setNotice({ kind: 'error', text: ERROR_TEXT });
    }
  };

  const [saving, setSaving] = useState(false);
  const saveFile = async () => {
    if (saving) return; // aria-disabled statt disabled: der Fokus bleibt am Knopf
    setSaving(true);
    await saveProjectFile();
    setSaving(false);
  };

  return (
    <BbzbHeader tool="Social Studio" feedback="Social Studio" className="editor-header">
      <button type="button" className="icon-btn" aria-label="Übersicht" data-tip="Übersicht" onClick={back}>
        <IconHome aria-hidden="true" />
      </button>
      <input
        className="project-name"
        aria-label="Projektname"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => !blurIntoMenu(e) && commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') {
            cancelled.current = true;
            setDraft(name);
            e.currentTarget.blur(); // der nächste Esc hebt die Auswahl auf
          }
        }}
      />
      <div className="header-actions">
        <button type="button" className="icon-btn" aria-label="Rückgängig" aria-disabled={!canUndo} data-tip="Rückgängig" data-keys={keysAttr(KEYS.undo)} onClick={() => canUndo && undo()}>
          <IconArrowBackUp aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="Wiederholen" aria-disabled={!canRedo} data-tip="Wiederholen" data-keys={keysAttr(KEYS.redo)} onClick={() => canRedo && redo()}>
          <IconArrowForwardUp aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="Projektdatei sichern" aria-disabled={saving} data-tip="Projektdatei sichern" data-keys={keysAttr(KEYS.save)} onClick={saveFile}>
          <IconDeviceFloppy aria-hidden="true" />
        </button>
        <SettingsDialog />
        <ExportDialog />
      </div>
    </BbzbHeader>
  );
}
