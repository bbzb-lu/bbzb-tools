# Product

<!-- impeccable:product-schema 1 -->

> Entstanden ohne Gespräch mit Alexej: abgeleitet aus Spezifikation, CLAUDE.md und docs/research. Mit «(abgeleitet)» markierte Angaben sind Annahmen und gehören bei der Durchsicht bestätigt oder korrigiert.

## Platform

web

## Users
- Lernende (Content Creation) und Sekretariat des BBZB Luzern. Keine Bildbearbeitungskenntnisse. Sie bekommen Fotos und einen kurzen Text von einer Lehrperson und bereiten daraus Post oder Story auf. (Spezifikation Abschnitt 1)
- Power-User: Social-Media-Management (Kommunikation BBZB). Pflegt Layouts und Brand Library.
- Gerät: verwaltete Windows-11-Geräte, Microsoft Edge, oft schwache Laptops, Fenster ab 1280 px Breite. Keine mobile Bedienung.

## Product Purpose
Browser-Editor für Instagram- und LinkedIn-Carousels und Stories im BBZB-Designsystem. Ziel: ein Carousel in unter 15 Minuten, ohne Vorwissen, ohne das CI zu brechen.

## Positioning
Zugeschnitten auf die BBZB-Vorlagen (Photoshop-Vorlage als Quelle), nicht auf beliebige Gestaltung. Alles läuft im Browser, nichts verlässt den Rechner. Ähnlich der Mobile-App «scrl».

## Operating Context
Medien kommen von Lehrpersonen, exportiert wird als JPEG/ZIP (später MP4) und von Hand auf Instagram/LinkedIn gepostet. Hosting als statische Seite auf Cloudflare Pages, öffentlich. Arbeitsstand liegt im Browser (IndexedDB/OPFS), die Projektdatei dient als Sicherung.

## Capabilities and Constraints
- Kein Backend, kein Upload, keine Analytics, keine Laufzeit-CDNs; Fotos, Videos und Projektdateien verlassen den Browser nie.
- Exporte halten das Designsystem ein: vier Farben, feste Schriften, keine abgerundeten Flächen, kein Logo auf Slides.
- UI-Texte Deutsch mit Schweizer Rechtschreibung, Du-Form, kurz, Guillemets «…», keine Halbgeviertstriche.
- Ein Modus für alle (seit Phase 4c): Ebenen, Deckkraft, Bildregler und Feineinstellungen sind immer da, ohne Schalter.
- Nicht im Umfang: Cloud-Speicherung, Konten, Echtzeit-Zusammenarbeit, direktes Posten, KI-generierte Bilder, Mobile, Firefox/Safari, Video-Schnittprogramm.

## Brand Commitments
- BBZB-Designsystem für Exporte: Blau `#009FE2`, Orange `#FF4E00`, Warmweiss `#FBF8F3`, Blauschwarz `#0F1B26`. Werte nur in `src/tokens.ts`.
- Schriften Segoe UI und Braveold (lizenziert, Repo privat).
- App-Oberfläche: eigener Look aus dem Pen-Entwurf (Phase 4c), Akzent ist das Blau des Kantons Luzern (Token `accent` in `src/ui/theme.ts`), Logo «Social Studio» in `brand/ui/`.
- Die Oberfläche soll nicht mit den Slides konkurrieren (Entscheid Phase 2.4).

## Evidence on Hand
- Referenzbilder der Layouts: `docs/reference/layouts/`, Anleitung als PDF in `docs/reference/`.
- Masse und Farben aus der PSD: `docs/reference/psd-geometry.json`.
- Keine Nutzerstudien, keine Zahlen zur Nutzung. Ein Usability-Test mit dem Sekretariat steht in Phase 5 aus; bis dahin nichts über Verständnis oder Tempo behaupten.

## Product Principles
- Im Zweifel weniger Optionen: eine Oberfläche, die das Sekretariat nicht benutzt, ist ein Misserfolg.
- Das CI schützen, statt es zu erklären: falsche Ergebnisse sollen gar nicht erst möglich sein.
- Die Privatsphäre ist technisch belegt (CSP, Netzwerk-Test), nicht nur zugesagt.
- Jede Ansicht muss auf einem 1280-px-Laptop ohne Scrollen bedienbar sein. (abgeleitet aus Entscheid 2.4 «Dichte»)

## Accessibility & Inclusion
- Jeder Knopf hat einen zugänglichen Namen, Tastaturbedienung und sichtbarer Fokus sind Pflicht (in Phase 2.4 per e2e-Test abgesichert).
- Ein verbindlicher WCAG-Standard ist nicht festgelegt. (abgeleitet: Tests und Kommentare im Code orientieren sich an AA)
