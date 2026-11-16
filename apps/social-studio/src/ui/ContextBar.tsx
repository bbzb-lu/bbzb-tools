import { IconCheck, IconDots } from '@tabler/icons-react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
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
  hint?: string;
  /** Primärtaste am Ende («Fertig», «Geprüft»); ohne: keine. */
  onDone?(): void;
  doneLabel?: string;
  /** Zeiger oder Fokus in der Leiste (true) bzw. wieder draussen (false), z. B. um einen Timer anzuhalten. */
  onHold?(held: boolean): void;
  /** Eigene Bedienelemente, das Wichtigste zuerst: was nicht in die Zeile passt, steht von hinten her unter «Mehr». */
  children?: ReactNode;
}

/**
 * Schwebende Leiste über der Leinwand: Titel, Hinweis, eigene Bedienelemente (`children`) und optional eine Primärtaste.
 * Immer eine Zeile: Zuerst kürzt sich der Hinweis, dann wandern Bedienelemente von hinten her ins Feld «Mehr» (dort ein zweites Mal gerendert,
 * je Element ist nur eine der beiden Kopien sichtbar). Gemessen im DOM bei jeder Grössenänderung, ohne React-Render.
 * Unten mittig knapp über der waagrechten Bildlaufleiste. Sie ändert die Leinwand nicht (absolut im Rahmen um den Scroll-Container). Läge sie
 * über dem Rahmen der Elemente `ids`, steht sie oben; ist auch dort kein Platz, bleibt sie unten. Geprüft beim Öffnen, bei Grössenänderung, Zoom, Scrollen und Dokumentänderungen,
 * ohne React-Render. Nur sie selbst fängt Zeigerereignisse (Striche daneben gehen an die Leinwand).
 */
export function ContextBar({ ids, label, icon, hint, onDone, doneLabel = 'Fertig', onHold, children }: Props) {
  const zoom = useUi((s) => s.zoom);
  const bar = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const key = ids.join();
  useLayoutEffect(() => {
    const el = bar.current;
    const scroller = el?.parentElement?.querySelector<HTMLElement>('.canvas-scroll');
    if (!el || !scroller) return;
    const fit = () => {
      const kids = [...row.current!.children] as HTMLElement[];
      let n = kids.length;
      // 1 px Spiel: der Hinweis schrumpft zuerst, die Zeile dabei um Bruchteile mit
      const over = () => n > 0 && kids[n - 1]!.getBoundingClientRect().right > row.current!.getBoundingClientRect().right + 1;
      for (const k of kids) k.hidden = false;
      more.current!.hidden = true;
      if (over()) {
        more.current!.hidden = false;
        while (over()) kids[--n]!.hidden = true;
      } else if (menu.current!.matches(':popover-open')) menu.current!.hidePopover();
      [...menu.current!.children].forEach((c, i) => ((c as HTMLElement).hidden = i < n));
    };
    const place = () => {
      fit();
      el.classList.remove('top');
      if (!key) return;
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
    // Platz (Fenster, Panels) oder ein Bedienelement (anderer Text) ändert die Breite, oder es kommen Bedienelemente dazu
    const ro = new ResizeObserver(place);
    const watch = () => {
      ro.disconnect();
      ro.observe(scroller);
      for (const k of row.current!.children) ro.observe(k);
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(row.current!, { childList: true });
    scroller.addEventListener('scroll', place, { passive: true });
    // Elemente verschoben (Ziehen, Pfeiltasten, Undo): höchstens einmal pro Bild prüfen, nur DOM
    let frame = 0;
    const offDoc = useDoc.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), place()));
    });
    return () => {
      ro.disconnect();
      mo.disconnect();
      scroller.removeEventListener('scroll', place);
      offDoc();
      cancelAnimationFrame(frame);
    };
  }, [key, zoom]);
  return (
    <div
      ref={bar}
      className="context-bar"
      role="group"
      aria-label={label}
      onPointerEnter={onHold && (() => onHold(true))}
      // Hover und Fokus halten unabhängig: wer geht, lässt nur los, wenn das andere nicht mehr hält
      onPointerLeave={onHold && ((e) => onHold(e.currentTarget.contains(document.activeElement)))}
      onFocus={onHold && (() => onHold(true))}
      onBlur={onHold && ((e) => onHold(e.currentTarget.matches(':hover') || e.currentTarget.contains(e.relatedTarget as Node | null)))}
    >
      <span className="context-bar-title">
        {icon}
        {label}
      </span>
      {hint && (
        <span className="context-bar-hint" data-tip={hint}>
          {hint}
        </span>
      )}
      <div ref={row} className="context-bar-items">
        {children}
      </div>
      <button ref={more} type="button" className="context-bar-more" aria-haspopup="dialog" popoverTarget={menuId} hidden>
        <IconDots aria-hidden="true" />
        Mehr
      </button>
      {/* Esc schliesst nur das Feld, der Bearbeitungsmodus bleibt (shortcuts.ts) */}
      <div ref={menu} id={menuId} className="context-bar-menu" popover="auto" role="dialog" aria-label={`${label}: mehr`}>
        {children}
      </div>
      {onDone && (
        <button type="button" className="primary" onClick={onDone}>
          <IconCheck aria-hidden="true" />
          {doneLabel}
        </button>
      )}
    </div>
  );
}
