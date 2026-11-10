# Phase 2.9 Doodles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 427 CC0-Doodles als eigener Bibliotheks-Tab, wie Tabler lazy geladen, einfärbbar, mit Suche und Kategorie.

**Architecture:** Spiegelt Phase 2.7 (`src/brand/tabler.ts`, `scripts/build-tabler.mjs`, `IconSearch`): ein Build-Skript erzeugt `brand/doodles/doodles.json`, ein Lader baut daraus `BrandAsset`s (Data-URL-SVG), ein Paket «doodles» in `assetPacks`, Vorladen beim Öffnen und Export. Gemeinsame Teile (Lader mit Ladezustand und Fehlerzustand) dürfen aus `tabler.ts` herausgezogen werden, wenn das weniger Code ist als eine Kopie.

**Tech Stack:** React 19, Vite (dynamic import JSON), zod, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 2.9»

## Global Constraints
- Quelle der Doodles: `brand/icons/doodle icons.zip` (untracked, NICHT committen; entpackt `doodle icons/SVG/<kategorie>/<name>.svg`). Kategorie `files` auslassen, alle anderen drin (auch `logos`).
- Kein Hex ausser `src/tokens.ts`; SVG-Quelle ist schwarz (Alpha zählt, Einfärbung wie Scribbles). Kein Laufzeit-Request ausser dem eigenen Chunk. Texte Deutsch (Schweizer Schreibweise, Du-Form, «…»), keine Halbgeviertstriche. Dateien unter 400 Zeilen, Kern importiert keine Plugins.
- Test zuerst, Gate vor Commit, Ergebnis in Edge ansehen. Altprojekte laden unverändert.

## Review Focus
- Projekt mit Doodle öffnen, Chunk noch nicht geladen: «lädt», dann richtig; Ladefehler: Platzhalter plus Meldung, Export bricht ab (wie Tabler).
- Doodles mit weissen Flächen oder Clip-Pfaden im Quell-SVG zeichnen im Editor und im Export gleich (Pixeltest), keine Quell-Hintergrundfläche.
- Namen mit Leerzeichen und Sonderzeichen («product hunt», «tik tok», «hand gestures») ergeben gültige Ids; keine Id-Kollision zwischen Kategorien.
- Der Tab «Doodles» bleibt per Tastatur bedienbar (Tab-Reihe, Pfeiltasten wie die anderen), Suche und Kategorie haben Beschriftungen.
- Hauptpaket wächst nicht (Chunk getrennt), Chunkgrösse im Bericht nennen.

### Task 1: Daten und Lader
**Files:** Create `scripts/build-doodles.mjs`, `brand/doodles/doodles.json`, `brand/doodles/README.md` (Herkunft khushmeen.com/icons, CC0, ausgelassen: files), `src/brand/doodles.ts`, Tests `src/brand/doodlesData.test.ts`, `src/brand/doodles.test.ts`; Modify `src/ui/StartPage.tsx`, `src/export/exportZip.ts`, `src/plugins/elements/brand/BrandNode.tsx` (Vorladen, «lädt», Fehlerzustand wie Tabler), `src/architecture.test.ts` falls nötig.
**Interfaces:** Produces: `DoodlePack = Record<string, { c: string; w: number; h: number; p: string[]; t: string }>` (Schlüssel = Name `<kategorie>-<name>` als Slug a-z0-9-); `loadDoodles(): Promise<DoodlePack>`, `doodleAsset(name, pack): BrandAsset | undefined` (Id `doodle-<name>`, `category: 'icon'`, `defaultColor: 'akzent'`, viewBox aus w/h, `fill="black"`), `searchDoodles(pack, query, category?, limit = 120): { names: string[]; total: number }`, `doodleCategories(pack): string[]`, `ensureDoodlesFor(p: Project): Promise<void>`, `doodlesFailed(): boolean`, `isDoodleId(id)`.
- [ ] Test (Daten): JSON hat 427 Einträge, keine Kategorie `files`, 14 Kategorien, jeder Name passt `^[a-z0-9-]+$`, jeder Pfad besteht `^[0-9MmLlHhVvCcSsQqTtAaZz .,+eE-]+$`, keine Quell-Hintergrundfläche (kein Pfad deckt die ganze viewBox ab: Prüfregel im Test festlegen und begründen). Rot sehen.
- [ ] Skript schreiben: liest die Quell-SVG (Pfad als Argument, Vorgabe `/tmp`-Entpackung), nimmt Pfade (`d`) mit `fill="black"`, verwirft Clip-Rechtecke und weisse Flächen, rundet Zahlen auf 1 Nachkommastelle (Gewicht der Datei, im Bericht nennen), schreibt `doodles.json`. Falls ein Quell-SVG andere Elemente als `path` enthält (circle, rect, ellipse), in Pfade umrechnen oder melden.
- [ ] Test (Lader) wie `tabler.test.ts`/`tabler.fail.test.ts`: Asset-Bau, Suchrangfolge (exakter Name, Anfang, enthält, Stichwort), Kategorie-Filter, Limit mit `total`, unbekannte oder ungültige Namen → `undefined`, `ensureDoodlesFor` trägt nur benötigte Ids ins Paket «doodles» ein, Ladefehler → `doodlesFailed()`, nächster Versuch lädt neu. Rot sehen, dann umsetzen. Projekt öffnen und Export laden das Paket vor (StartPage, exportZip), BrandNode zeigt «lädt» bzw. Platzhalter wie bei Tabler. Gate, Commit.

### Task 2: Tab «Doodles»
**Files:** Create `src/ui/DoodleSearch.tsx` (oder `IconSearch` verallgemeinern, falls kürzer); Modify `src/ui/BrandLibrary.tsx` (4. Tab), `src/ui/app.css`, `DESIGN.md` (ein Satz), `CLAUDE.md` Brand-Tabelle (Zeile `brand/doodles/`), `docs/roadmap.md`; Test `e2e/doodles.spec.ts`.
- [ ] Test (e2e): Tab «Doodles» sichtbar (Tabliste hat 4 Tabs, Pfeiltasten wandern durch alle); Suche «bell» zeigt Treffer, Klick fügt ein `brand`-Element mit Id `doodle-…` mittig ein, Farbe Akzent, Export enthält deckende orange Pixel und keine weisse Fläche; Kategorie-Auswahl «Food» zeigt nur Food und mehr als 0 Treffer; ohne Suche und Kategorie «Alle» höchstens 120 Kacheln plus Hinweis «Zeigt 120 von 427. Grenze die Suche ein.»; Projekt mit Doodle speichern, neu laden, öffnen: Doodle sichtbar; Netzwerktest bleibt grün (kein externer Request). Rot sehen.
- [ ] Credit: unter der Liste eine muted Zeile mit Link «Doodles von Khushmeen» (href https://khushmeen.com/, target _blank, rel noopener noreferrer, sr-only «(öffnet in neuem Tab)»), gleiches Muster wie der Tabler-Hinweis in `IconSearch`; kein Logo. Test: Link vorhanden mit href und rel; Netzwerktest bleibt grün.
- [ ] Umsetzen: Suchfeld (`type=search`, Beschriftung «Doodles suchen»), `select` «Kategorie» (Alle, dann die 14 Namen auf Deutsch lesbar, Anzeige wie die Quellordner mit grossem Anfangsbuchstaben genügt), Kacheln wie `LibraryTile` (Vektor-Vorschau, kein PNG-Queue), Meldungen wie bei `IconSearch` (Laden, Fehler, keine Treffer, «Suche auf Englisch»). Tab-Icon: ein vorhandenes Tabler-Icon (z. B. IconMoodSmile). Gate, in Edge ansehen, Commit.
- [ ] Abschluss: Roadmap «2.9 Doodles erledigt», Plan nach `docs/archiv/plans/`, `naechste-session.md` neu, Chunkgrösse und Dateigewicht notieren.
