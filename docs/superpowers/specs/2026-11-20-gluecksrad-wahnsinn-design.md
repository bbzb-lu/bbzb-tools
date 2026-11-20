# Glücksrad: Vorlagen und Wahnsinn-Modus

Erweiterung von `apps/gluecksrad/` (siehe `2026-11-20-gluecksrad-design.md`).

## Absicht
Das Glücksrad ist ein Spasstool. Zwei Zusätze: Textdateien im Repo werden zu anklickbaren Vorlagen, und ein Schalter «Wahnsinn» dreht beim Drehen und Gewinnen alles auf. Die normale Seite ändert sich nicht.

## Ziele
- Vorlagen: `apps/gluecksrad/presets/*.txt`, beim Build eingelesen (`import.meta.glob`, kein Request zur Laufzeit). Dateiname ergibt die Beschriftung, Klick ersetzt die Liste.
- Wahnsinn-Modus nur im Rad-Modus, nur während Drehung und Gewinnerkarte, danach ist alles weg. Standard aus, nicht gespeichert.
- Effekte beim Drehen: Wackeln, RGB-Split am Rad, Regenbogen-Farbwechsel, Vignette, Scanlines, Lens-Flare, Hitmarker (X am Zeiger, höchstens 3 pro Sekunde), Comic-Schriftzüge («WOW», «EPIC»), längere Drehung mit mehr Umdrehungen.
- Beim Gewinn: Explosion mit Druckwelle, Konfetti-Kanonen links und rechts, Feuerwerk, ein einziger Blitz, Boom-Wackeln, Sonnenbrille fällt auf die Karte, «DEAL WITH IT», Regenbogen-Karte.
- Ton aus Web-Audio-Synthese: Tick pro Segment, Start-Sweep, Airhorn, Explosion, Fanfare. Eigener Schalter «Ton», gedeckelte Lautstärke, Ton startet erst nach dem Klick auf «Drehen».

## Nicht-Ziele
Echte MLG-Clips, Doge, Hitmarker-Samples oder andere fremde Bilder und Töne (Repo ist öffentlich). Neue Abhängigkeiten. Effekte im Modus «Mehrere». Speichern des Modus.

## Grenzen (hart)
- Höchstens 3 Blitze pro Sekunde, keine rote Vollfläche blitzt (WCAG 2.3.1). Der Vollbild-Blitz kommt höchstens einmal pro Gewinn.
- `prefers-reduced-motion`: Schalter gesperrt, Hinweis.
- Schalter und Modus während der Drehung gesperrt (wie bisher).
- Partikel höchstens 360, Canvas höchstens 1,5-fache Pixeldichte, Schleife stoppt ohne Partikel. Windows-Edge auf schwachen Geräten.
- Farben der Effekte als Tokens `fx-*` in `packages/ui/src/theme.ts`, sonst nirgends.
- Nichts verlässt den Browser. Keine Requests, keine Audiodateien.

## Entscheide
- Ein kleines eigenes Canvas-Partikelsystem (`src/fx/partikel.ts`, rein und getestet), `src/fx/ton.ts` für Ton, `src/fx/Fx.tsx` für die Ebene (alles `position: fixed`, ausserhalb von `main`, weil `main` wackelt).
- Wackeln, Regenbogen und RGB-Split per CSS-Klassen `wm-dreht` und `wm-sieg` auf `main`, nur solange gedreht wird oder die Karte offen ist.
- Hitmarker folgt dem echten Winkel des Rads (`indexUnterZeiger`), Ton und Marker kommen vom Segment am Zeiger.
- Dateien der Vorlagen: erfundene Namen und Alltagsentscheide, keine echten Personen.

## Offen für den Umsetzer
Genaue Klangparameter, Wortliste und Platzierung der Schriftzüge, Texte der Hinweise.
