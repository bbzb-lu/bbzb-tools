import { IconHelp } from '@tabler/icons-react';
import { useRef } from 'react';

const STEPS: [head: string, text: string][] = [
  ['Format wählen', 'Lege ein Projekt als «Post 4:5» oder «Story 9:16» an.'],
  ['Layout wählen', 'Wähle für jede Slide ein Layout. Mit «Layout ändern» wechselst du später.'],
  ['Foto oder Video einfügen', 'Klicke auf «Foto oder Video», ziehe eine Datei in die Slide oder füge sie mit Strg + V ein.'],
  ['Text und Standort anpassen', 'Doppelklicke einen Text, um ihn zu ändern. Den Standort wählst du beim Tag in der Spalte rechts.'],
  ['Exportieren', 'Klicke auf «Exportieren» und wähle «ZIP herunterladen» oder «In Ordner speichern».'],
  ['Projektdatei sichern', 'Drücke Strg + S oder klicke auf «Projektdatei sichern». So hast du eine Datei (.bbzbsocial) als Backup.'],
];

/** «Kurzanleitung»: sechs Schritte und der Hinweis zu den Daten. `icon`: Icon-Knopf «Hilfe» in der Kopfzeile, sonst Textknopf der Startseite. Natives Dialog wie bei den Lizenzen, Esc gibt den Fokus an den Knopf zurück. */
export function HelpDialog({ icon = false }: { icon?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = () => dialog.current?.showModal();
  return (
    <>
      {icon ? (
        <button type="button" className="icon-btn" aria-label="Hilfe" data-tip="Hilfe" onClick={open}>
          <IconHelp aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={open}>
          <IconHelp aria-hidden="true" />
          Kurzanleitung
        </button>
      )}
      <dialog ref={dialog} aria-labelledby="hilfe-titel" className="help-dialog">
        <h2 id="hilfe-titel">Kurzanleitung</h2>
        <ol className="help-steps">
          {STEPS.map(([head, text]) => (
            <li key={head}>
              <strong>{head}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <section className="help-data">
          <h3>Deine Daten</h3>
          <p>
            Alles bleibt in diesem Browser auf diesem Gerät. Nichts wird hochgeladen. Der Browser kann seinen Speicher leeren, darum ist die Projektdatei deine Sicherung.
          </p>
        </section>
        <div className="actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            Schliessen
          </button>
        </div>
      </dialog>
    </>
  );
}
