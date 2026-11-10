import { useId, type ReactNode } from 'react';

/** Abschnitt im linken Panel: graue Leiste mit Überschrift und dünner Linie, darunter die Zeilen. `grow`: füllt den Rest der Leiste, der Inhalt darf darin selbst scrollen. */
export function Section({ heading, actions, grow, children }: { heading: string; actions?: ReactNode; grow?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <section className={grow ? 'section grow' : 'section'} aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {heading}
        <span className="section-line" aria-hidden="true" />
        {actions}
      </h2>
      <div className="section-body">{children}</div>
    </section>
  );
}
