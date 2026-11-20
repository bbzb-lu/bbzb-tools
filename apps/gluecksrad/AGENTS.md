# apps/gluecksrad

Glücksrad unter `/gluecksrad/`. Optionen tippen oder aus einer `.txt` laden (eine pro Zeile), Rad dreht und wählt eine. Zweiter Modus «Mehrere» zieht mehrere Optionen auf einmal ohne Wiederholung. Gedacht für Beamer und Handy. Nichts wird hochgeladen, die Datei wird nur lokal gelesen.

## Aufbau
- `src/ziehen.ts`: reine Funktionen `parseOptionen` und `ziehe` (Zufall über `crypto.getRandomValues`). Ein späteres Pixel-Embed kann sie wiederverwenden.
- `src/Rad.tsx`: SVG-Rad mit Ring, Lampen und Verlauf-Segmenten, dreht per CSS-Transition (4 s). Das Ergebnis steht vor der Drehung fest. Ohne Optionen zeigt es ein leeres Rad mit «Optionen eintragen».
- `src/Gewinner.tsx`: Karte mit Konfetti über dem Rad, schliesst mit Klick oder Esc.
- `src/Kacheln.tsx`: Wand für den Modus «Mehrere».
- `src/liste.ts`: Liste in `localStorage`, Schlüssel `gluecksrad-liste`.

## Vorlagen
Textdateien in `presets/*.txt` werden beim Build eingelesen und erscheinen als Knöpfe (Beschriftung aus dem Dateinamen, `-` und `_` werden Leerzeichen). Eine Option pro Zeile, 2 bis 100 Optionen (Test prüft das), erfundene Namen, keine echten Personen. Umlaute im Dateinamen sind erlaubt.

## Wahnsinn-Modus (`src/fx/`)
Schalter nur im Rad-Modus, Standard aus, nicht gespeichert. Wirkt nur beim Drehen und solange die Gewinnerkarte offen ist: `main` bekommt `wm-dreht` oder `wm-sieg`, `Fx.tsx` zeichnet eine feste Ebene ausserhalb von `main` (Canvas, Hitmarker, Schriftzüge). Töne kommen live aus Web Audio (`ton.ts`), keine Dateien.
- Harte Grenzen: höchstens 3 Blitze pro Sekunde, Vollbild-Blitz nur einmal pro Gewinn, keine rote Vollfläche (WCAG 2.3.1). Bei `prefers-reduced-motion` ist der Schalter gesperrt.
- Partikel höchstens `MAX` (360), Pixeldichte höchstens 1,5, Schleife stoppt ohne Partikel.
- Farben der Effekte nur als `fx-*`-Tokens in `packages/ui/src/theme.ts`. Keine fremden Bilder oder Töne (Repo ist öffentlich), alles gezeichnet oder synthetisiert.

## Regeln
- Höchstens 100 Optionen (`MAX_OPTIONEN`), Leerzeilen und Doppelte fliegen raus.
- Bei `prefers-reduced-motion` gibt es keine Drehung, das Ergebnis erscheint sofort.
- «Als Textdatei speichern» schreibt die aktuelle Liste als `gluecksrad-optionen.txt`.
- Die Optionenzahl 0 sperrt den Knopf, eine einzige Option ist erlaubt.
- Segmentfarben nur aus dem Theme: zwei Töne im Wechsel, bei ungerader Zahl bekommt das letzte Segment den Akzent.

Starten: `npm run dev -w apps/gluecksrad`. Tests: `npx vitest --project gluecksrad run`, `npx playwright test --project gluecksrad`.
