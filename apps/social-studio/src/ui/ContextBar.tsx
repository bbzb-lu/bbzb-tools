import { IconCheck } from '@tabler/icons-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { getContentLayer } from '../canvas/contentLayer';
import { elementBounds } from '../model/geometry';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';

/** Abstand der Leiste zum Rahmen des Bearbeiteten (Linie und etwas Luft). */
const MARGIN = 8;

interface Props {
  /** Elemente, die die Leiste nicht verdecken darf (leer: keine). */
  ids: string[];
  label: string;
  icon: ReactNode;
  hint?: ReactNode;
  /** Nur das Symbol statt des Titels zeigen (der Titel bleibt für Screenreader und als Tooltip): spart Breite bei vielen Bedienelementen. */
  compact?: boolean;
  /** Primärtaste am Ende («Fertig», «Geprüft»); ohne: keine. */
  onDone?(): void;
  doneLabel?: string;
  /** Zeiger oder Fokus in der Leiste (true) bzw. wieder draussen (false), z. B. um einen Timer anzuhalten. */
  onHold?(held: boolean): void;
  children?: ReactNode;
}

/**
 * Schwebende Leiste über der Leinwand: Titel, Hinweis, eigene Bedienelemente (`children`) und optional eine Primärtaste.
 * Unten mittig knapp über der waagrechten Bildlaufleiste. Sie ändert die Leinwand nicht (absolut im Rahmen um den Scroll-Container). Läge sie
 * über dem Rahmen der Elemente `ids`, steht sie oben; ist auch dort kein Platz, bleibt sie unten. Geprüft beim Öffnen, bei Grössenänderung, Zoom, Scrollen und Dokumentänderungen,
 * ohne React-Render. Nur sie selbst fängt Zeigerereignisse (Striche daneben gehen an die Leinwand).
 */
export function ContextBar({ ids, label, icon, hint, compact, onDone, doneLabel = 'Fertig', onHold, children }: Props) {
  const zoom = useUi((s) => s.zoom);
  const bar = useRef<HTMLDivElement>(null);
  const key = ids.join();
  useLayoutEffect(() => {
    const el = bar.current;
    const scroller = el?.parentElement?.querySelector<HTMLElement>('.canvas-scroll');
    if (!el || !scroller || !key) return;
    const place = () => {
      el.classList.remove('top');
      const stage = getContentLayer()?.getStage();
      const els = useDoc.getState().project?.elements;
      const bs = key.split(',').flatMap((id) => (els?.[id] ? [elementBounds(els[id])] : []));
      if (!stage || !bs.length) return;
      const c = stage.container().getBoundingClientRect();
      const s = stage.scaleX();
      const left = c.left + stage.x() + Math.min(...bs.map((b) => b.x)) * s - MARGIN;
      const top = c.top + stage.y() + Math.min(...bs.map((b) => b.y)) * s - MARGIN;
      const right = c.left + stage.x() + Math.max(...bs.map((b) => b.x + b.width)) * s + MARGIN;
      const bottom = c.top + stage.y() + Math.max(...bs.map((b) => b.y + b.height)) * s + MARGIN;
      const covers = () => {
        const r = el.getBoundingClientRect();
        return r.left < right && r.right > left && r.top < bottom && r.bottom > top;
      };
      if (!covers()) return;
      el.classList.add('top');
      if (covers()) el.classList.remove('top');
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(scroller);
    scroller.addEventListener('scroll', place, { passive: true });
    // Elemente verschoben (Ziehen, Pfeiltasten, Undo): höchstens einmal pro Bild prüfen, nur DOM
    let frame = 0;
    const offDoc = useDoc.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), place()));
    });
    return () => {
      ro.disconnect();
      scroller.removeEventListener('scroll', place);
      offDoc();
      cancelAnimationFrame(frame);
    };
  }, [key, zoom]);
  return (
    <div
      ref={bar}
      className={compact ? 'context-bar compact' : 'context-bar'}
      role="group"
      aria-label={label}
      onPointerEnter={onHold && (() => onHold(true))}
      // Hover und Fokus halten unabhängig: wer geht, lässt nur los, wenn das andere nicht mehr hält
      onPointerLeave={onHold && ((e) => onHold(e.currentTarget.contains(document.activeElement)))}
      onFocus={onHold && (() => onHold(true))}
      onBlur={onHold && ((e) => onHold(e.currentTarget.matches(':hover') || e.currentTarget.contains(e.relatedTarget as Node | null)))}
    >
      <span className="context-bar-title" data-tip={compact ? label : undefined}>
        {icon}
        <span className="context-bar-label">{label}</span>
      </span>
      {hint && <span className="context-bar-hint">{hint}</span>}
      {children}
      {onDone && (
        <button type="button" className="primary" onClick={onDone}>
          <IconCheck aria-hidden="true" />
          {doneLabel}
        </button>
      )}
    </div>
  );
}
