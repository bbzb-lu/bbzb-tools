import { useId, useRef, type KeyboardEvent } from 'react';
import { SlideHighlight, useSlidingHighlight } from '@bbzb/ui';
import { useUi } from '../store/ui';
import { AddBar } from './AddBar';
import { BrandLibrary } from './BrandLibrary';
import { LayersPanel } from './LayersPanel';

const tabs = [
  { id: 'bibliothek', label: 'Bibliothek' },
  { id: 'ebenen', label: 'Ebenen' },
] as const;

/** Fach links: «Foto oder Video» und «Text» oben, darunter die Reiter Bibliothek und Ebenen. Beide Fächer bleiben eingehängt (Suche und Kategorie bleiben), das inaktive ist `hidden`. */
export function LeftPanel() {
  const active = useUi((s) => s.leftTab);
  const id = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  useSlidingHighlight(tabsRef, "[role='tab'][aria-selected='true']");
  const refs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length]!.id;
    useUi.getState().setLeftTab(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="left-panel">
      <AddBar />
      <div className="left-box">
        <div className="left-tabs" ref={tabsRef} role="tablist" aria-label="Fach links" onKeyDown={onKey}>
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(b) => void (refs.current[t.id] = b)}
              type="button"
              role="tab"
              id={`${id}-${t.id}`}
              aria-selected={t.id === active}
              aria-controls={`${id}-${t.id}-panel`}
              tabIndex={t.id === active ? 0 : -1}
              onClick={() => useUi.getState().setLeftTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <SlideHighlight>
            {tabs.map((t) => (
              <i key={t.id} className={t.id === active ? 'sel' : undefined} data-t={t.label} />
            ))}
          </SlideHighlight>
        </div>
        {tabs.map((t) => (
          <div key={t.id} className="left-tabpanel" role="tabpanel" id={`${id}-${t.id}-panel`} aria-labelledby={`${id}-${t.id}`} hidden={t.id !== active}>
            {t.id === 'bibliothek' ? <BrandLibrary /> : <LayersPanel />}
          </div>
        ))}
      </div>
    </div>
  );
}
