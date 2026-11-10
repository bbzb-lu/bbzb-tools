import { Children, useId, type ReactNode } from 'react';
import { useUi } from '../store/ui';

/**
 * Abschnitt im Eigenschaften-Panel: graue Leiste mit Überschrift, dünner Linie und optionaler Aktion rechts, darunter Zeilen.
 * Ohne Inhalt (alle Kinder leer, z. B. `{cond && …}`) erscheint der Abschnitt nicht.
 * `collapsible`: startet zu (mit `defaultOpen` offen), der Zustand liegt pro `id` im UI-Store (nur Sitzung, überlebt Auswahlwechsel); zu = `hidden`, nicht tabbar.
 * Der Name des Abschnitts ist nur der Kopfknopf, nicht die Aktion daneben (`actions`).
 */
/** `heading` statt `title`: das Wort «title» ist in ui/ gesperrt (Architekturtest, Tooltips laufen über data-tip). */
export function Section({ heading, id, icon, nested, actions, collapsible = false, defaultOpen = false, children }: {
  heading: string;
  icon?: ReactNode;
  id?: string;
  nested?: boolean;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const auto = useId();
  const key = id ?? heading;
  const open = useUi((s) => !collapsible || (s.openSections[key] ?? defaultOpen));
  const toggle = useUi((s) => s.toggleSection);
  if (Children.toArray(children).length === 0) return null;
  const body = `${auto}-body`;
  return (
    <section className={nested ? 'section nested' : 'section'} aria-labelledby={auto}>
      <h3 id={collapsible ? undefined : auto} className="section-title">
        {collapsible ? (
          <button id={auto} type="button" className="section-toggle" aria-expanded={open} aria-controls={body} onClick={() => toggle(key, defaultOpen)}>
            <span className="chevron" aria-hidden="true" />
            {icon}
            {heading}
          </button>
        ) : (
          <>{icon}{heading}</>
        )}
        <span className="section-line" aria-hidden="true" />
        {actions}
      </h3>
      <div id={body} className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
