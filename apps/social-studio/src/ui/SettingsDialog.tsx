import { IconSettings } from '@tabler/icons-react';
import { useRef } from 'react';
import { AccentMode } from './AccentMode';
import { ExportQualityChoice } from './ExportQualityChoice';
import { LicensesDialog } from './LicensesDialog';

/** Projekteinstellungen: Akzentfarbe und Exportqualität. Natives Dialog wie beim Export, Esc gibt den Fokus an den Knopf zurück. */
export function SettingsDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="icon-btn" aria-label="Einstellungen" data-tip="Einstellungen" onClick={() => dialog.current?.showModal()}>
        <IconSettings aria-hidden="true" />
      </button>
      <dialog ref={dialog} aria-labelledby="einstellungen-titel" className="settings-dialog">
        <h2 id="einstellungen-titel">Projekteinstellungen</h2>
        <AccentMode />
        <ExportQualityChoice />
        <LicensesDialog />
        <div className="actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            Schliessen
          </button>
        </div>
      </dialog>
    </>
  );
}
