# Glücksrad: Design

Neue App `apps/gluecksrad/` unter `/gluecksrad/`. Zufällige Entscheidung per Rad, Optionen aus Textdatei, zweiter Modus zieht mehrere Optionen auf einmal.

## Absicht
Für den Unterricht am Beamer, auch auf dem Handy gut bedienbar. Später kommt ein Embed im Pixel-Stil für SharePoint, darum liegt die Ziehlogik als reine Funktionen getrennt von der Darstellung.

## Ziele
- Optionen tippen oder aus `.txt` laden (eine pro Zeile), lokal gemerkt.
- Modus «Rad»: Drehung rund 4 s, Ergebnis gross. Schalter «Gewinner entfernen» (Standard aus).
- Modus «Mehrere»: Anzahl wählen, ein Klick, gewählte Optionen leuchten gleichzeitig auf einer Kachelwand auf, ohne Wiederholung.

## Nicht-Ziele
Gruppen einteilen, Gewichtungen, Teilen per Link, Sound, Embed (später).

## Entscheide
- Ansatz: eigene App (Embed ist mit 480 × 350 px zu eng für Liste und Datei). SVG mit CSS-Drehung, kein Canvas.
- Zufall: `crypto.getRandomValues`, Ergebnis steht vor der Animation fest. Bei `prefers-reduced-motion` ohne Drehung.
- Datei: getrimmt, leere und doppelte Zeilen entfernt, höchstens 100 Optionen, nur lokal gelesen.
- Speicher: `localStorage`-Schlüssel `gluecksrad-liste`.
- Bauteile `Segmented`, `Switch`, `Button`, `Header` aus `@bbzb/ui`, Farben nur aus dem Theme.
- Reine Funktionen in `src/ziehen.ts`: `parseOptionen(text)`, `ziehe(n, anzahl)` (Indizes, ohne Wiederholung), mit Vitest-Tests.

## Überlassen dem Umsetzer
Genaues Layout, Farbverteilung der Rad-Segmente aus dem Theme, Texte, Kachel und Vorschaubild auf der Startseite.
