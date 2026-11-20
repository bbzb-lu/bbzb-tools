# apps/gluecksrad

Glücksrad unter `/gluecksrad/`. Optionen tippen oder aus einer `.txt` laden (eine pro Zeile), Rad dreht und wählt eine. Zweiter Modus «Mehrere» zieht mehrere Optionen auf einmal ohne Wiederholung. Gedacht für Beamer und Handy. Nichts wird hochgeladen, die Datei wird nur lokal gelesen.

## Aufbau
- `src/ziehen.ts`: reine Funktionen `parseOptionen` und `ziehe` (Zufall über `crypto.getRandomValues`). Ein späteres Pixel-Embed kann sie wiederverwenden.
- `src/Rad.tsx`: SVG-Rad mit Ring, Lampen und Verlauf-Segmenten, dreht per CSS-Transition (4 s). Das Ergebnis steht vor der Drehung fest. Ohne Optionen zeigt es ein leeres Rad mit «Optionen eintragen».
- `src/Gewinner.tsx`: Karte mit Konfetti über dem Rad, schliesst mit Klick oder Esc.
- `src/Kacheln.tsx`: Wand für den Modus «Mehrere».
- `src/liste.ts`: Liste in `localStorage`, Schlüssel `gluecksrad-liste`.

## Regeln
- Höchstens 100 Optionen (`MAX_OPTIONEN`), Leerzeilen und Doppelte fliegen raus.
- Bei `prefers-reduced-motion` gibt es keine Drehung, das Ergebnis erscheint sofort.
- «Als Textdatei speichern» schreibt die aktuelle Liste als `gluecksrad-optionen.txt`.
- Die Optionenzahl 0 sperrt den Knopf, eine einzige Option ist erlaubt.
- Segmentfarben nur aus dem Theme: zwei Töne im Wechsel, bei ungerader Zahl bekommt das letzte Segment den Akzent.

Starten: `npm run dev -w apps/gluecksrad`. Tests: `npx vitest --project gluecksrad run`, `npx playwright test --project gluecksrad`.
