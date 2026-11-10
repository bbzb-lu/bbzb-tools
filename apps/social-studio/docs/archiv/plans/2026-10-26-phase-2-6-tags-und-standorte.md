# Phase 2.6 «Tags und Standorte» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standorte «BBZB» und «BM» ergänzen, Heimbach umfärben, den Standort-Tag um eine Fachbereich-Zeile erweitern und zwei neue Tag-Varianten einführen (Fachbereich-Tag, freier Tag).

**Architecture:** Alle Werte (Standorte, Farben, Fachbereiche, Masse) kommen in `src/tokens.ts`. Der Tag-Typ (`src/plugins/elements/tag/`) bekommt die Varianten `fach` und `frei` und die optionalen Felder `dept` und `color`. Höhe und Füllung des Tags werden aus den Props abgeleitet (`tagHeightOf`, `tagFillOf`), nicht mehr nur aus `tagBox[variant]`. `schul` bleibt der Code-Name des Standort-Tags, damit Altprojekte und Layouts gültig bleiben.

**Tech Stack:** React 19, TypeScript strict, react-konva, zod, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 2.6». Dazu `CLAUDE.md`, `DESIGN.md`, `docs/superpowers/workflow.md`.

## Global Constraints
- Kein Request nach aussen; keine Laufzeit-CDNs.
- Werte (Farben, Masse, Fachbereiche) nur in `src/tokens.ts`; Dateien unter 400 Zeilen; Kern importiert keine Plugins direkt.
- UI-Texte Deutsch, Schweizer Rechtschreibung («ss», «…», Du-Form, kurz), keine Halbgeviertstriche (–).
- Neue Projektfelder optional, kein `schemaVersion`-Wechsel; fehlt das Feld, sieht ein Altprojekt aus wie vorher (Ausnahme: Heimbach hat neu `#4C5EBD`).
- Tags eckig, Schrift «BBZB Tag» (Segoe UI Bold), Versalien, Laufweite 0.11 em; Schriftfarbe immer `onAccent(Füllung)`.
- Ein Undo-Schritt pro Geste; Schriften vor dem Messen laden (`tagWidthReady`).
- Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test`, bei UI/Export `npm run test:e2e`. Tests nie abschwächen; angepasste Erwartungen im Bericht nennen.
- Branch `phase-2-6` von `main`. Commit-Nachrichten Englisch, enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- Altes Projekt mit Schul-Tag «Heimbach»: lädt, zeigt neue Farbe, Schrift Warmweiss, keine Fehlermeldung.
- Standort-Tag mit Fachbereich, dann Standort wechseln: ein nicht passender Fachbereich verschwindet, die Höhe folgt, die Breite wird neu gemessen.
- Standort «BBZB»: Beschriftung genau «BBZB» (nicht «BBZB BBZB»), kein Fachbereich-Schalter.
- Lange Fachbereiche («Fahrzeugbau und Strassentransport», «Elektrotechnik EP/GIN/NE»): Kasten wächst, Text läuft nie aus dem Kasten, Export gleich Leinwand.
- Layout wechseln (`takeContent`): Fachbereich und Farbe wandern mit dem Tag, ein Tag einer anderen Variante bleibt unberührt.
- Format kopieren und Kanalwechsel: `onChannel` und Formatkopie ändern Fachbereich-Tags und freie Tags nicht und messen die Breite nach.
- Akzent nach Standort: Fachbereich-Tag und freier Tag ändern den Akzent der Slide nie; «BBZB» gibt Blau, «BM» Magenta.

---

### Task 1: Tokens

**Files:**
- Modify: `src/tokens.ts`, `src/tokens.test.ts`

**Interfaces:**
- Produces:
  - `locations` (Reihenfolge): `['BBZB', 'Bahnhof', 'Heimbach', 'Weggismatt', 'Dagmersellen', 'BM']`
  - `locationColors: Record<Location, { fill: string; text: 'warmweiss' | 'blauschwarz' }>` mit `BBZB` `#009FE2` (text `blauschwarz`, Kontrast Warmweiss 2.81 < 3), `Heimbach` `#4C5EBD` (`warmweiss`, 5.44), `BM` `#D84FC3` (`warmweiss`, 3.40), übrige unverändert.
  - `departments: Record<Exclude<Location, 'BBZB'>, readonly string[]>` mit den 17 Fachbereichen aus der Spezifikation, Schreibweise wörtlich.
  - `tagFills`: Schlüssel der Farben des freien Tags: `['blau', 'orange', 'warmweiss', 'blauschwarz', 'akzent', 'Bahnhof', 'Heimbach', 'Weggismatt', 'Dagmersellen', 'BM']`, Typ `TagFill`.
  - `tagBox` neu: `fach` (`height: 62`, `fill: 'akzent'` Platzhalter, Polster wie `schul`), `frei` (wie `schul`), `schulDept: { height: 96, size: 22 }` (eigener Wert, optisch zu prüfen, Ruling im Ledger nennen).

- [ ] **Step 1: Failing tests** in `src/tokens.test.ts`: Standortfarben (alle sechs Hexwerte), Schrift je Standort gleich `onAccent(fill)`, 17 Fachbereiche und `departments.Weggismatt` enthält «Maler», «Bautechnik» steht bei Heimbach und Dagmersellen. Bestehender Hex-Test auf `#8ED8F8` wird angepasst.
- [ ] **Step 2:** `npx vitest run src/tokens.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Werte in `src/tokens.ts` eintragen, Kommentar zu Heimbach (Kontrast) nachführen.
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/tokens.test.ts` → Expected: PASS (Typfehler in Tag-Dateien durch die erweiterte Liste sind hier zu beheben, soweit sie nur den Typ betreffen).
- [ ] **Step 5:** Commit.

### Task 2: Tag-Modell (Schema, Beschriftung, Masse)

**Files:**
- Modify: `src/plugins/elements/tag/schema.ts`, `layout.ts`, `measure.ts`, `index.tsx`, `insert.ts` (nur Typen und Höhe), `tag.test.ts`

**Interfaces:**
- Consumes: Task 1 Tokens.
- Produces (alle in `layout.ts`, ausser wo genannt):
  - `tagVariants = ['schul', 'fach', 'frei', 'ort', 'cta'] as const`
  - `TagProps = { variant; text: string; dept?: string; color?: TagFill }` (`dept` nur bei `schul`; `color` bei `frei` die Farbe, bei `fach` der Standort des Fachbereichs, weil «Bautechnik» bei Heimbach und Dagmersellen vorkommt)
  - `tagLabel(p): string`: `schul` mit Text `BBZB` gibt «BBZB», sonst «BBZB <TEXT>»; `fach` und `frei` den Text; Versalien wie bisher.
  - `tagDeptLabel(p): string | undefined`: Fachbereich in Versalien, nur bei `schul`, `dept` gesetzt und im Standort gültig.
  - `tagHeightOf(p): number`: `schul` mit Fachbereich `tagBox.schulDept.height`, sonst `tagBox[variant].height`.
  - `tagFillOf(p, accent): string` (Hex): `schul` und `cta`/`ort` wie bisher; `fach` Farbe des Standorts in `color` (`locationColors[color].fill`), fehlt oder ungültig → Orange; `frei` nach `color` (`akzent` → `accent`, Standortname → `locationColors[...].fill`, sonst `colors[...]`), fehlt `color` → Blau.
  - `tagBoxWidth(p, textWidth)`: nimmt die Breite der längeren Zeile (`measureLabel` misst beide Zeilen und gibt das Maximum zurück).
  - zod: `dept` optional string max 60, `color` optional `z.enum(tagFills)`.

- [ ] **Step 1: Failing tests** in `tag.test.ts`: Beschriftung («BBZB» allein, «BBZB BM», `fach` zeigt nur den Namen), `tagHeightOf` 62 und 96, `tagFillOf` für `fach` (`{ text: 'Maler', color: 'Weggismatt' }` → `#FF4E00`; «Bautechnik» mit Dagmersellen und mit Heimbach gibt zwei Farben), für `frei` mit `color: 'BM'` → `#D84FC3`, ohne `color` → Blau, Altprops `{ variant: 'schul', text: 'Heimbach' }` parsen ohne Fehler, `dept` bei einem Standort, der den Fachbereich nicht führt, ergibt keine zweite Zeile, Breite = längere Zeile («Fahrzeugbau und Strassentransport» breiter als «BBZB BAHNHOF»).
- [ ] **Step 2:** `npx vitest run src/plugins/elements/tag` → Expected: FAIL.
- [ ] **Step 3:** Implementieren; `fromLayout`, `onChannel`, `takeContent` in `index.tsx` auf `tagHeightOf` umstellen, `takeContent` übernimmt `text`, `dept`, `color` bei gleicher Variante. `onChannel` ändert nur `cta`.
- [ ] **Step 4:** `npx vitest run src/plugins/elements/tag src/model src/plugins/layouts` → Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 3: Darstellung (Leinwand und Export)

**Files:**
- Modify: `src/plugins/elements/tag/TagNode.tsx`, `src/canvas/` falls dort die Tag-Höhe fest gelesen wird (`grep tagBox`), Test: `e2e/tag.spec.ts`

**Interfaces:**
- Consumes: `tagFillOf`, `tagLabel`, `tagDeptLabel`, `tagHeightOf`, `tagBox.schulDept`.
- Produces: gleicher Konva-Knoten wie bisher; mit Fachbereich zwei Textzeilen (Standort 28 px wie bisher, Fachbereich `tagBox.schulDept.size`, beide linksbündig, vertikal zusammen mittig), Füllung aus `tagFillOf`, Schrift `onAccent(fill)`.

- [ ] **Step 1: Failing e2e** in `e2e/tag.spec.ts`: Projekt per Fixture mit je einem Standort-Tag «Heimbach» (Export: Füllfläche `#4C5EBD`, Schrift Warmweiss), Standort-Tag mit Fachbereich (Höhe 96, zwei Zeilen, Text innerhalb der Box), Fachbereich-Tag «Maler» (Standort Weggismatt, Füllung `#FF4E00`), freier Tag mit Farbe «BM» (`#D84FC3`). Pixelprüfung wie in den bestehenden Tag-Tests.
- [ ] **Step 2:** `npx playwright test e2e/tag.spec.ts` → Expected: FAIL.
- [ ] **Step 3:** `TagNode` anpassen. Kein Knoten rundet Ecken (`cornerRadius={0}`).
- [ ] **Step 4:** Test läuft grün; Export-PNG ansehen (zwei Zeilen lesbar, nichts abgeschnitten).
- [ ] **Step 5:** Commit.

### Task 4: Einfügen und Inspector

**Files:**
- Modify: `src/plugins/elements/tag/insert.ts`, `TagInspector.tsx`, `index.tsx` (Varianten-Liste), `src/ui/BrandLibrary.tsx` falls Beschriftungen dort stehen; Test: `e2e/tag.spec.ts`, `tag.test.ts`

**Interfaces:**
- Produces:
  - `variantNames = { schul: 'Standort-Tag', fach: 'Fachbereich-Tag', frei: 'Freier Tag', ort: 'Ort-Tag', cta: 'CTA' }`; Bibliothek zeigt sie in dieser Reihenfolge.
  - `insertTag('schul')` setzt Text «BBZB» (nicht `lastTagLocation`); `fach` startet mit dem ersten Fachbereich von Bahnhof (`color: 'Bahnhof'`); `frei` mit Text «Text» und `color: 'blau'`; Standort-Tag-Auswahl im Inspector aktualisiert weiter `lastTagLocation`.
  - Inspector `schul`: Auswahl «Standort»; Schalter «Fachbereich zeigen» (nicht bei «BBZB») und Auswahl «Fachbereich» (Fachbereiche des Standorts). Wechsel des Standorts entfernt einen unpassenden `dept`.
  - Inspector `fach`: Auswahl «Fachbereich» mit `optgroup` je Standort; die Wahl setzt `text` und `color` (Standort der Gruppe).
  - Inspector `frei`: Feld «Text» (wie `Label`) und Farbwahl (bestehendes `Swatches` bzw. Auswahlfeld mit den `tagFills`; leere Eingabe nicht zulassen).
  - Alle Änderungen messen die Breite neu und setzen die Höhe (`tagHeightOf`) in einem `apply`.

- [ ] **Step 1: Failing tests:** `tag.test.ts` (`insertTag('schul')` ergibt «BBZB» auch bei gesetztem `lastTagLocation`; `insertTag('fach')`, `insertTag('frei')` legen Tags mit gültigen Props an), `e2e/tag.spec.ts` (Standort wechseln mit Fachbereich: Fachbereich verschwindet bei Nichtpassung, Höhe 62; Fachbereich-Schalter an/aus ein Undo-Schritt; Fachbereich-Tag und freien Tag aus der Bibliothek einfügen, Farbe ändern).
- [ ] **Step 2:** Tests laufen und scheitern.
- [ ] **Step 3:** Implementieren. Beschriftungen mit Schweizer Rechtschreibung; Fokus und Labels wie in den bestehenden Inspector-Feldern (`aria-label`).
- [ ] **Step 4:** Tests grün; `/impeccable` kurz für den Inspector (`DESIGN.md` einhalten).
- [ ] **Step 5:** Commit.

### Task 5: Akzent, Altprojekte, Doku, Abnahme

**Files:**
- Modify: `src/model/accent.test.ts`, `e2e/location-accent.spec.ts`, ggf. `src/model/formatCopy.test.ts`; Doku: `docs/roadmap.md`, `docs/superpowers/naechste-session.md`, `CLAUDE.md` nur falls Aussagen veraltet sind

- [ ] **Step 1: Failing tests:** `accentFor` mit Standort-Tag «BBZB» → `#009FE2`, «BM» → `#D84FC3`; ein sichtbarer Fachbereich-Tag und ein freier Tag vor dem Standort-Tag ändern den Akzent nicht; Altprojekt-Datei mit `variant: 'schul'`, `text: 'Heimbach'` lädt (Projektdatei-Test), Format kopieren und Kanalwechsel lassen `fach`/`frei` unverändert.
- [ ] **Step 2:** Tests scheitern, dann Code anpassen (soweit nötig; `accentFor` zählt weiter nur `variant === 'schul'`).
- [ ] **Step 3: Selbst anschauen** in Edge: alle fünf Tag-Arten einfügen, Standorte durchschalten, lange Fachbereiche, Export (PNG) öffnen und mit der Leinwand vergleichen, Layout «Titel» wechseln. Screenshots ablegen und ansehen.
- [ ] **Step 4:** Gate komplett: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.
- [ ] **Step 5:** Doku nachführen (Roadmap-Zeile 2.6 auf «erledigt», `naechste-session.md` neu, Plan nach `docs/archiv/plans/`, den Backlog-Punkt «Heimbach-Scribble auf Warmweiss» streichen, wenn die neue Farbe ihn löst). Commit, Gesamt-Review mit dem stärksten Modell, Merge in `main`, vor dem Deploy bei Alexej nachfragen.

## Self-Review
- Spec: jeder Punkt aus «Entscheide Phase 2.6» hat eine Aufgabe (Standorte, Standort-Tag, Fachbereich-Zeile, Fachbereich-Tag, freier Tag, Akzent, Altprojekte).
- Typen: `TagProps`, `tagHeightOf`, `tagFillOf`, `tagFills` heissen in allen Aufgaben gleich.
- Eigene Rulings zur Prüfung durch Alexej: Höhe 96 und Fachbereich-Schrift 22 px; «BM» als «BBZB BM»; Layout-Platzhalter nehmen weiter `lastTagLocation`, nur neu eingefügte Tags starten mit «BBZB»; «Bautechnik» steht bei Heimbach und Dagmersellen, darum speichert der Fachbereich-Tag seinen Standort in `color`.
