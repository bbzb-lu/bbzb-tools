import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useUi } from '../store/ui';
import { Section } from './Section';

export type EffectEntry = {
  id: string;
  /** Dasselbe Icon wie in der Zeile (EffectRow). */
  icon: ReactNode;
  label: string;
  /** Kurzhinweis in der Auswahl, z. B. «Filmkörnung». */
  hint: string;
  /** Schon hinzugefügt: Haken, nicht mehr wählbar (ausser `multi`). */
  active: boolean;
  multi?: boolean;
  /** Grund, warum der Eintrag gerade nicht geht (z. B. Höchstzahl erreicht); ohne Haken, gesperrt. */
  limit?: string;
};

/** Klappt Abschnitte auf (Sitzungszustand im UI-Store), z. B. den neuen Effekt. */
export const openSections = (...ids: string[]) =>
  useUi.setState((s) => ({ openSections: { ...s.openSections, ...Object.fromEntries(ids.map((id) => [id, true])) } }));

/** Abschnitt «Effekte» mit «+» in der Kopfzeile (das Menü liegt ausserhalb des Abschnitts, damit es auch bei zugeklapptem Abschnitt aufgeht). `onAdd` bekommt die `id` des gewählten Eintrags; die Zeilen (EffectRow) liefert der Aufrufer. */
export function EffectsSection({ entries, onAdd, children }: { entries: EffectEntry[]; onAdd(id: string): void; children?: ReactNode }) {
  const id = useId();
  const pop = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const items = () => Array.from(pop.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const move = (e: KeyboardEvent) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'ArrowDown' ? (at + 1) % all.length : e.key === 'ArrowUp' ? (at - 1 + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    all[to]?.focus();
  };
  return (
    <>
    <Section
      heading="Effekte"
      collapsible
      actions={
        <button ref={add} type="button" className="icon-btn effects-add" aria-label="Effekt hinzufügen" aria-haspopup="menu" data-tip="Effekt hinzufügen" popoverTarget={id}>
          <IconPlus aria-hidden="true" />
        </button>
      }
    >
      {children ?? <p className="muted hint">Noch kein Effekt.</p>}
    </Section>
    <div
      ref={pop}
      id={id}
      className="effects-menu"
      popover="auto"
      role="menu"
      aria-label="Effekt hinzufügen"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation(); // schliesst nur das Menü, die Auswahl bleibt
        move(e);
      }}
      onToggle={(e) => {
        if ((e.nativeEvent as ToggleEvent).newState === 'open') (items().find((el) => el.getAttribute('aria-disabled') !== 'true') ?? pop.current)?.focus(); // alles gesperrt: das Menü selbst, damit Esc es erreicht
        else add.current?.focus();
      }}
    >
      <p className="effects-menu-title" aria-hidden="true">Effekt hinzufügen</p>
      {entries.map((en) => {
        const taken = (en.active && !en.multi) || !!en.limit;
        return (
          <button
            key={en.id}
            type="button"
            role="menuitem"
            aria-disabled={taken || undefined}
            data-tip={en.limit}
            onClick={() => {
              if (taken) return;
              pop.current?.hidePopover();
              onAdd(en.id);
            }}
          >
            {en.icon}
            <span className="effects-menu-name">{en.label}</span>
            <span className="effects-menu-hint">{en.hint}</span>
            {en.limit && <span className="sr-only">{en.limit}</span>}
            {taken && !en.limit && (
              <>
                <IconCheck aria-hidden="true" />
                <span className="sr-only">schon hinzugefügt</span>
              </>
            )}
          </button>
        );
      })}
    </div>
    </>
  );
}

/** Ein Effekt im Abschnitt: einklappbar, mit Papierkorb rechts. `id` muss je Effekt stabil sein (Klappzustand). */
export function EffectRow({ id, icon, label, onRemove, children }: { id: string; icon: ReactNode; label: string; onRemove(): void; children: ReactNode }) {
  return (
    <Section
      nested
      collapsible
      id={id}
      icon={icon}
      heading={label}
      actions={
        <button type="button" className="icon-btn" aria-label={`${label} entfernen`} data-tip="Entfernen" onClick={(e) => {
          const add = e.currentTarget.closest<HTMLElement>('.section:not(.nested)')?.querySelector<HTMLElement>('.effects-add');
          onRemove();
          add?.focus(); // die Zeile verschwindet, der Fokus bleibt im Abschnitt (WCAG 2.4.3)
        }}>
          <IconTrash aria-hidden="true" />
        </button>
      }
    >
      {children}
    </Section>
  );
}
