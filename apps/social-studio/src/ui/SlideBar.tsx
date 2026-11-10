import { IconCopy, IconPlus, IconTrash, IconVideo } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { isVideoSlide } from '../export/exportVideoSlide';
import { addSlide, groupOf, LIMIT_TEXT, MAX_SLIDES } from '../model/slides';
import type { Project } from '../model/types';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { tryApply } from './actions';
import { addSlidesWithLayout, applyToCurrentSlide, duplicateSlideAt, layoutsFor, moveSlideTo, newSlideAt, removeSlideAt, stepSlide } from './layoutActions';
import { LayoutPicker } from './LayoutPicker';
import { ViewTools } from './ViewTools';

/**
 * Nummerierte Kacheln unter der Leinwand: wählen, umsortieren (Ziehen oder Alt + Pfeiltaste), hinzufügen, löschen.
 * Dazwischen die Ansicht (Zoom, Sicherheitszonen, Unterlage), damit nichts die Leinwand verdeckt.
 * Verknüpfte Slides (Panorama) hängen zusammen und werden immer gemeinsam verschoben, dupliziert und gelöscht.
 */
export function SlideBar() {
  const slides = useDoc((s) => s.project!.slides);
  const format = useDoc((s) => s.project!.format);
  // Zeichenkette statt Array: gleicher Wert, kein Neu-Rendern bei Änderungen, die keine Slide zum Video machen
  const videoKey = useDoc((s) => s.project!.slides.map((_, i) => (isVideoSlide(s.project!, i) ? 'v' : '-')).join(''));
  const { width, height } = format;
  const presets = layoutsFor(format.id);
  const picker = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const current = useUi((s) => s.currentSlide);
  const listRef = useRef<HTMLOListElement>(null);
  const dragFrom = useRef<number | null>(null);
  // Einfügelinie beim Ziehen: Kachel und Seite, auf der die gezogene Slide landet
  const [drop, setDrop] = useState<{ at: number; side: 'before' | 'after' } | null>(null);
  const refocus = useRef(false);
  const full = slides.length >= MAX_SLIDES;
  const group = (i: number) => groupOf({ slides }, i);
  const [first, last] = group(current);
  const n = last - first + 1;
  const many = n > 1 ? `${n} Slides` : 'Slide';
  // Neues Projekt: dasselbe Popover, aber die Wahl gilt der ersten Slide statt einer neuen.
  const [start, setStart] = useState(false);
  useEffect(() => {
    if (!useUi.getState().chooseLayoutOnStart) return;
    useUi.setState({ chooseLayoutOnStart: false });
    if (!picker.current) return;
    setStart(true);
    picker.current.showPopover();
    picker.current.querySelector('button')?.focus();
  }, []);

  // Aktuelle Kachel sichtbar halten; nach Alt + Pfeil behält die verschobene Kachel den Fokus.
  useEffect(() => {
    const tiles = listRef.current?.querySelectorAll('button');
    const tile = tiles?.[current];
    // Die ganze Gruppe zeigen (Panorama-Paar), zuerst das Ende, dann den Anfang.
    const [f, l] = groupOf({ slides }, current);
    for (const k of [l, f]) tiles?.[k]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (refocus.current) tile?.focus();
    refocus.current = false;
  }, [current, slides]);

  const go = (i: number) => useUi.getState().setCurrentSlide(i);
  const run = (recipe: (d: Project) => void, next: number) => {
    if (tryApply(recipe)) go(next);
  };
  // Einen Schritt; `focus`: die verschobene Kachel behält den Fokus.
  const step = (from: number, dir: -1 | 1, focus = false) => {
    refocus.current = focus; // vor dem Verschieben: der Effekt läuft nach dem Rendern
    if (!stepSlide(from, dir)) refocus.current = false; // am Rand: nichts bewegt, später kein Fokusraub
  };

  // Alt + Pfeil verschiebt die Slide (Kachel: diese, Buttonreihe: die aktuelle).
  const altArrow = (e: React.KeyboardEvent, from: number, focus = false) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); // Edge: Alt + Pfeil blättert sonst im Verlauf
    step(from, e.key === 'ArrowLeft' ? -1 : 1, focus);
  };

  // Zugänglicher Name: Nummer, verknüpfte Slides mit Layout-Namen («Slide 3, Panorama mit Slide 4»), «bitte prüfen».
  const label = (i: number) => {
    const [f, l] = group(i);
    const others = Array.from({ length: l - f + 1 }, (_, k) => f + k + 1).filter((k) => k !== i + 1);
    const name = presets.find((p) => p.id === slides[i]!.layout)?.label ?? 'Verknüpft';
    return [`Slide ${i + 1}`, videoKey[i] === 'v' ? 'Video' : '', others.length ? `${name} mit Slide ${others.join(', ')}` : '', slides[i]!.review ? 'bitte prüfen' : '']
      .filter(Boolean)
      .join(', ');
  };
  const linkPos = (i: number) => {
    const [f, l] = group(i);
    return f === l ? undefined : i === f ? 'start' : i === l ? 'end' : 'mid';
  };

  const moveTip = (i: number) =>
    linkPos(i) ? 'Ziehen oder Alt + Pfeiltaste verschiebt die verknüpften Slides zusammen.' : 'Ziehen oder Alt + Pfeiltaste verschiebt die Slide.';

  return (
    <div className="slidebar">
      <ol ref={listRef} className="slide-list" aria-label="Slides">
        {slides.map((s, i) => (
          <li key={s.id} data-drop={drop?.at === i ? drop.side : undefined} data-link={linkPos(i)}>
            <button
              type="button"
              className="slide-tile"
              aria-label={label(i)}
              data-slide={i}
              data-review={s.review || undefined}
              aria-current={i === current ? 'true' : undefined}
              aria-description={moveTip(i)}
              data-tip={moveTip(i)}
              style={{ aspectRatio: `${width} / ${height}` }}
              draggable
              onClick={() => go(i)}
              onDragStart={(e) => {
                dragFrom.current = i;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `Slide ${i + 1}`);
              }}
              onDragOver={(e) => {
                if (dragFrom.current === null) return;
                e.preventDefault();
                // Einfügelinie nur an Gruppengrenzen: hinter der Zielgruppe (nach rechts) oder davor (nach links)
                const [f, l] = group(dragFrom.current);
                const [tf, tl] = group(i);
                const next = tf > l ? { at: tl, side: 'after' as const } : tl < f ? { at: tf, side: 'before' as const } : null;
                setDrop((d) => (d?.at === next?.at && d?.side === next?.side ? d : next));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFrom.current;
                if (from !== null) {
                  const [f, l] = group(from);
                  const [tf, tl] = group(i);
                  if (tf > l) moveSlideTo(from, tl - (l - f)); // erste Slide der Gruppe so, dass die letzte hinter der Zielgruppe liegt
                  else if (tl < f) moveSlideTo(from, tf);
                }
                dragFrom.current = null;
                setDrop(null);
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDrop(null);
              }}
              onKeyDown={(e) => altArrow(e, i, true)}
            >
              {i + 1}
              {videoKey[i] === 'v' && <IconVideo className="tile-video" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
      <ViewTools />
      <div className="slidebar-actions" onKeyDown={(e) => altArrow(e, current)}>
        {/* Mit Layouts: Auswahl als Popover (Esc und Klick daneben schliessen), sonst direkt eine leere Slide. */}
        <button
          ref={addButton}
          type="button"
          className="add labeled"
          aria-label="Slide hinzufügen"
          disabled={full}
          data-tip={full ? LIMIT_TEXT : 'Slide hinzufügen'}
          popoverTarget={presets.length ? 'slide-layouts' : undefined}
          onClick={
            presets.length
              ? undefined
              : () => {
                  const at = newSlideAt(useDoc.getState().project!);
                  run((d) => void addSlide(d, at), at);
                }
          }
        >
          <IconPlus aria-hidden="true" />
          <span className="wide">Slide hinzufügen</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${many} duplizieren`}
          data-tip={slides.length + n > MAX_SLIDES ? LIMIT_TEXT : `${many} duplizieren`}
          disabled={slides.length + n > MAX_SLIDES}
          onClick={() => duplicateSlideAt(current)}
        >
          <IconCopy aria-hidden="true" />
        </button>
        <button
          type="button"
          className="labeled"
          aria-label={`${many} löschen`}
          data-tip={`${many} löschen`}
          disabled={slides.length <= n}
          onClick={() => removeSlideAt(current)}
        >
          <IconTrash aria-hidden="true" />
          <span className="wide">{many} löschen</span>
        </button>
      </div>
      {presets.length > 0 && (
        <div
          ref={picker}
          id="slide-layouts"
          className="layout-popover"
          popover="auto"
          role="dialog"
          aria-labelledby="slide-layouts-titel"
          onToggle={(e) => (e.nativeEvent as ToggleEvent).newState === 'closed' && setStart(false)}
        >
          <h2 id="slide-layouts-titel">{start ? 'Layout wählen' : 'Slide hinzufügen'}</h2>
          <p className="muted hint">{start ? 'Wähl ein Layout für die erste Slide. Esc lässt sie leer.' : 'Wähl ein Layout für die neue Slide.'}</p>
          <LayoutPicker
            presets={presets}
            format={format}
            label={start ? 'Layout der ersten Slide' : 'Layout der neuen Slide'}
            onPick={(l) => {
              picker.current?.hidePopover();
              addButton.current?.focus(); // Fokus bleibt in der Slide-Leiste, nicht auf dem Seitenanfang
              void (start ? applyToCurrentSlide(l) : addSlidesWithLayout(l));
            }}
          />
        </div>
      )}
    </div>
  );
}
