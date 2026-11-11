import { useEffect, useRef, useState } from 'react';
import { endGesture, gestureOpen, startGesture } from '../store/document';
import { blurIntoMenu } from './ContextMenu';
import { useRoll } from './kit/useRoll';

/** Tasten, die den Wert schrittweise ändern: gedrückt gehalten ergeben sie einen Undo-Schritt, nicht einen je Wiederholung. */
const STEP_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);

/** Auf den Schritt runden: über den Kehrwert (0.1 → 10), sonst bleiben Reste wie 0.30000000000000004. */
const roundTo = (v: number, step: number) => Math.round(v * (1 / step)) / (1 / step);

/** Wert aus Eingabetext: auf `step` gerundet und begrenzt, null bei leer oder ungültig. Komma gilt als Dezimalzeichen. */
export function parseField(text: string, min: number, max: number, step = 1): number | null {
  const v = text.trim() === '' ? NaN : Number(text.replace(',', '.'));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, roundTo(v, step))) : null;
}

/**
 * Zahlenfeld: Tippen ist ein Entwurf, übernommen bei Enter, Blur oder Abbau (ein Aufruf), gerundet und begrenzt.
 * Alles andere (Pfeiltasten im Feld) gilt sofort; die Anzeige zeigt immer den echten Wert,
 * ein Entwurf endet, sobald sich der Wert von aussen ändert (Regler).
 */
export function NumberField({ label, value, min, max, step = 1, onCommit, readOnly, disabled, roll }: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Rundung und Schritt der Pfeile, z. B. 0.1 für Sekunden. */
  step?: number;
  onCommit(v: number): void;
  readOnly?: boolean;
  disabled?: boolean;
  /** Die Zahl gleitet bei Wertänderung kurz herein (Zahlenfeld am Regler). */
  roll?: boolean;
}) {
  const field = useRef<HTMLInputElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  useRoll(ghost, value, (g, fresh) => {
    g.textContent = field.current!.value; // Text nur während des Rollens im DOM
    if (!fresh) return; // Schrift und Polster nur am Anfang einer Serie messen
    const c = getComputedStyle(field.current!);
    Object.assign(g.style, {
      padding: c.padding, borderWidth: c.borderTopWidth, font: c.font, letterSpacing: c.letterSpacing,
      justifyContent: c.textAlign === 'right' ? 'flex-end' : c.textAlign === 'center' ? 'center' : 'flex-start',
    });
  });
  const [draft, setDraft] = useState<string | null>(null);
  const shown = roundTo(value, step);
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setDraft(null); // Wert kam von aussen (Regler, Undo): Anzeige = echter Wert
  }
  const commit = () => {
    const n = draft === null ? null : parseField(draft, min, max, step);
    setDraft(null); // ungültig: zurück zum gespeicherten Wert
    if (n !== null && n !== shown) onCommit(n);
  };
  // Klick auf die Leinwand baut das Panel ab, bevor das Feld den Fokus verliert: offenen Entwurf dann trotzdem übernehmen.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  // Nur eine Geste beenden, die dieses Feld selbst begonnen hat (Regler, Ziehen und Ausschnitt haben eigene)
  const started = useRef(false);
  const fresh = useRef(false);
  const finish = () => {
    if (started.current) endGesture();
    started.current = false;
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => () => {
    commitRef.current();
    finishRef.current();
  }, []);
  const text = draft ?? (step < 1 ? shown.toFixed(String(step).split('.')[1]?.length ?? 1) : String(shown));
  const input = (
    <input
      ref={field}
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      readOnly={readOnly}
      disabled={disabled}
      // Bruchteil-Schritt (Sekunden): immer gleich viele Nachkommastellen, «10.0» wie «2.5»
      value={text}
      onChange={(e) => {
        // Tippen (inputType gesetzt) bleibt Entwurf; Pfeiltaste und Browser-Pfeile haben keinen und gelten sofort
        const n = (e.nativeEvent as InputEvent).inputType ? null : parseField(e.target.value, min, max, step);
        if (n === null) return setDraft(e.target.value);
        setDraft(null);
        if (n !== shown) onCommit(n);
      }}
      // Klick ins Feld wählt den ganzen Wert: sofort überschreiben oder kopieren. Nicht beim Zurückkehren aus dem Menü (Auswahl bleibt)
      onFocus={(e) => !blurIntoMenu(e) && e.currentTarget.select()}
      onMouseDown={(e) => void (fresh.current = document.activeElement !== e.currentTarget)}
      // Chromium setzt beim Loslassen den Cursor und hebt die Auswahl auf, nur beim Klick, der den Fokus gebracht hat
      onMouseUp={(e) => {
        if (fresh.current) e.preventDefault();
        fresh.current = false;
      }}
      onBlur={(e) => {
        if (blurIntoMenu(e)) return;
        finish();
        commit();
      }}
      onKeyDown={(e) => {
        // Wiederholung bei gehaltener Taste = ein Schritt, Ende bei keyup oder Blur
        if (STEP_KEYS.has(e.key)) {
          if (!gestureOpen()) {
            startGesture();
            started.current = true;
          }
        } else if (e.key === 'Enter') commit();
      }}
      onKeyUp={(e) => STEP_KEYS.has(e.key) && finish()}
    />
  );
  // Zahl rollt als Kopie der Ziffern über dem Feld (Rahmen bleibt stehen); ohne `roll` kein Mehraufwand
  return roll ? (
    <span className="roll-wrap">
      {input}
      <span className="roll-ghost" ref={ghost} aria-hidden="true" />
    </span>
  ) : input;
}
