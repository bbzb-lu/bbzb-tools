# Pen-Entwurf der Editor-Oberfläche

Stand 29.10.2026: Phase 4c hat die Oberfläche nach `editor.pen` gebaut. Die gebaute Oberfläche beschreibt `DESIGN.md` (aus dem Code erzeugt), die Bedienung die Spezifikation (Abschnitt 8 «Bedienung der Oberfläche»). Der Entwurf bleibt die Referenz für neue Teile und für Änderungen am Look.

## Spielregeln
- **Werte stehen im Entwurf und im Code.** Farben, Schriften und Abstände kommen aus den Variablen im Artboard «Stilprofil» und den Bauteilen; im Code liegen sie nur in `src/ui/theme.ts`. Nie in andere `.md` abschreiben.
- **Nur über Pencil lesen.** Die Datei ist verschlüsselt. Mit den Pencil-Werkzeugen lesen (Pencil muss laufen, die Datei offen sein), nie mit Read oder Grep. Bei «wrong .pen file» die Abfrage wiederholen, bevor man annimmt, dass etwas fehlt.
- **Ändert sich der Entwurf,** die betroffenen Variablen in `theme.ts` nachführen und danach `DESIGN.md` mit Impeccable (`document`) neu erzeugen.
- **Bilder ohne Pencil:** `export/` enthält jedes Artboard als PNG (Stand 28.10.2026, nummeriert: 00 Stilprofil, 01 Bauteile, 02 Editor, 10 bis 19 Panels, 20 Rechtsklickmenü, 21 bis 29 Zustände, Dialoge und Startseite; das Stilprofil ist veraltet, es gelten die Variablen). Nur Ansicht für Agents ohne Pencil: Widerspricht ein PNG der Quelle, gilt `editor.pen`. Nach Änderungen neu exportieren (Pencil-Funktion `Export`, PNG, Massstab 1) und hier den Stand nachführen.
- `embedded-image*.png` hat Pencil beim Import und beim Einfügen von Bildern neben `editor.pen` abgelegt (alte Oberfläche). Keine Quelle. `embedded-image-2.png`, `embedded-image-4.png` (Fotos mit Lernenden) und `logo-social-studio.png` sind beim Umzug in die Suite nicht mitgekommen: zeigt Pencil dort ein leeres Bild, ist das der Grund.

## Abweichungen vom Entwurf
- Der Schattenblock hinter den Slides ist nicht gebaut, Slide-Kacheln zeigen keine Hintergrundfarbe. Entscheide dazu kommen als GitHub-Issues mit Label `social-studio`.
- Kleine Restpunkte gegenüber dem Entwurf (Effektmenü ohne Symbole, Inspector ohne abgesetzte Karte, Pinsel-Auswahlreihe) kommen als GitHub-Issues mit Label `social-studio`.

## Ohne eigenen Entwurf
Direkt nach den Bauteilen gebaut: Projekteinstellungen, Lizenzen, Meldungen, Rahmen-Einstellungen, Bibliothek ausser Tags, Text-Bearbeiten, Unterlage-Popover.
