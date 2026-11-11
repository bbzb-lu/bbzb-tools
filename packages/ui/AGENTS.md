# packages/ui (`@bbzb/ui`)

Gemeinsame Oberfläche aller BBZB-Tools: Kopf (`Header`), Bauteile (`Button`, `Switch`, `Segmented`, `SlideHighlight`), Tokens (`theme.ts`), Schriften und CSS (`fonts.css`, `base.css`, `kit.css`, `header.css`).

## Regeln
- Jede Änderung trifft alle Tools. Darum ist `npm run test:e2e` für alle Tools Pflicht, nicht nur für das gerade bearbeitete.
- Werte (Farben, Masse) stehen nur in `src/theme.ts`, nirgends sonst hart codiert.
- Keine absoluten Pfade wie `url('/fonts/…')`: Assets relativ einbinden, damit jedes Tool unter einem Unterpfad läuft.
- UI-Texte Deutsch, Schweizer Rechtschreibung, Du-Form, keine Halbgeviertstriche (–).
- Die Schriften Host Grotesk und Newsreader sind OFL, Lizenztexte in `src/licenses/`.

## Für alle Tools
- `Header({ tool, feedback })`: `feedback` ist die Option «Tool» im Microsoft-Forms-Formular (`src/feedback.ts`). Neues Tool: Option dort gleich benennen, sonst ist nichts vorausgewählt.
- `merkeZuletzt()` beim Speichern, `vergissZuletzt()` beim Löschen: speist «Zuletzt bearbeitet» auf der Startseite. Das Tool öffnet `/<id>/?projekt=<id>` direkt (Vorbild: Studio `StartPage.tsx`).

## Herkunft
Der Look stammt aus dem Social Studio. `DESIGN.md` und der Pen-Entwurf bleiben im Studio-Ordner (ab Plan 2 hier im Repo). UI-Änderungen mit dem Impeccable-Skill gestalten und prüfen.
