# Glücksrad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue App `apps/gluecksrad/`: Rad mit zufälliger Auswahl, Optionen aus Textdatei, Modus «Mehrere» zieht mehrere Optionen ohne Wiederholung.

**Architecture:** Reine Funktionen in `src/ziehen.ts` (Parsen, Ziehen), getrennt von React-Darstellung. Rad ist ein SVG, gedreht per CSS-Transition. Ergebnis steht vor der Animation fest.

**Tech Stack:** React, Vite, Vitest, Playwright (Edge), `@bbzb/ui` (`Header`, `Button`, `Segmented`, `Switch`, `reducedMotion`).

**Spec:** `docs/superpowers/specs/2026-11-20-gluecksrad-design.md`

## Global Constraints

- Nichts verlässt den Browser: kein Backend, kein Upload, keine Analytics, keine fremden Requests.
- Farben und Masse nur aus `packages/ui/src/theme.ts` (fehlende Tokens dort ergänzen), nirgends hart codiert.
- Texte Deutsch, Schweizer Rechtschreibung («ss»), Du-Form, kurz, keine Halbgeviertstriche (–), auch in `.md`.
- Keine absoluten Pfade wie `'/x/…'`, die App läuft unter `/gluecksrad/`.
- `localStorage`-Schlüssel beginnen mit `gluecksrad` (hier: `gluecksrad-liste`).
- Dateien unter 400 Zeilen. `apps/gluecksrad/AGENTS.md` unter 60 Zeilen.
- Commits klein, Englisch. Arbeit auf Branch `gluecksrad`, nicht auf `ui-feinschliff` (dort liegen fremde, uncommittete Änderungen).
- Vor jedem Commit grün: `npm run typecheck`, `npm run lint`, `npm test`; bei UI zusätzlich `npx playwright test --project gluecksrad`.

## Review Focus

- Leere Liste oder nur Leerzeilen: Knopf deaktiviert, kein Absturz, Hinweis «Trag mindestens zwei Optionen ein».
- Genau eine Option: Rad zeigt sie, Ziehen liefert sie ohne Drehung zu verbiegen.
- Anzahl im Modus «Mehrere» grösser als Optionenzahl: wird auf die Optionenzahl begrenzt.
- Datei mit Windows-Zeilenenden (`\r\n`), BOM oder Leerzeilen: sauber geparst.
- Textdatei mit über 100 Zeilen oder Binärdatei: nur die ersten 100 übernommen, Hinweis wird angezeigt.
- «Gewinner entfernen» bis die Liste leer ist: kein Absturz, Knopf wird deaktiviert.

---

### Task 1: Gerüst und Ziehlogik

**Files:**
- Create: `apps/gluecksrad/` via `npm run neues-tool -- gluecksrad "Glücksrad"`
- Create: `apps/gluecksrad/src/ziehen.ts`
- Test: `apps/gluecksrad/src/ziehen.test.ts`

**Interfaces:**
- Produces: `MAX_OPTIONEN = 100`; `parseOptionen(text: string): { optionen: string[]; gekuerzt: boolean }`; `ziehe(anzahlOptionen: number, anzahl: number, zufall?: (max: number) => number): number[]` (verschiedene Indizes, `anzahl` wird auf `anzahlOptionen` begrenzt, Standard-`zufall` nutzt `crypto.getRandomValues` ohne Modulo-Verzerrung).

- [ ] **Step 0: Worktree anlegen**

Run: `git worktree add ../bbzb-tools-gluecksrad -b gluecksrad main && cd ../bbzb-tools-gluecksrad && npm install`
Dann alle weiteren Schritte dort ausführen. Expected: sauberer Stand auf `main`.

- [ ] **Step 1: Failing tests schreiben** in `ziehen.test.ts`
  - `parseOptionen('A\r\n\r\n B \nA\n')` → `{ optionen: ['A', 'B'], gekuerzt: false }` (trimmt, entfernt leere und doppelte Zeilen, `\r\n` ok).
  - Text mit BOM (`'﻿A\nB'`) → `['A', 'B']`.
  - 150 verschiedene Zeilen → 100 Optionen, `gekuerzt: true`.
  - `ziehe(5, 3)` → 3 verschiedene Indizes, alle in `0..4`.
  - `ziehe(2, 9)` → 2 Indizes (begrenzt), `ziehe(0, 3)` → `[]`.
  - `ziehe(4, 2, max => 0)` mit deterministischem `zufall` → `[0, 1]` (Fisher-Yates von vorn, Reihenfolge der Ziehung).
  - Gleichverteilung grob: 6000 Züge von `ziehe(3, 1)` mit Standard-`zufall`, jeder Index zwischen 1700 und 2300 Mal.

- [ ] **Step 2: Test laufen lassen, muss scheitern**

Run: `npx vitest --project gluecksrad run`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `ziehen.ts` implementieren** (Signaturen oben). Partielles Fisher-Yates über ein Indexarray; Standard-`zufall` per Rejection Sampling auf `Uint32Array`.

- [ ] **Step 4: Tests grün**

Run: `npx vitest --project gluecksrad run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/gluecksrad package.json package-lock.json apps/startseite
git commit -m "Add gluecksrad scaffold and draw logic"
```
(Staging an den vom Skript geänderten Dateien prüfen, nur Zugehöriges aufnehmen.)

---

### Task 2: Oberfläche (Rad, Mehrere, Datei, Speicher)

**Files:**
- Create: `apps/gluecksrad/src/Rad.tsx`, `apps/gluecksrad/src/Kacheln.tsx`, `apps/gluecksrad/src/liste.ts`
- Modify: `apps/gluecksrad/src/App.tsx`, `apps/gluecksrad/src/app.css`, `packages/ui/src/theme.ts` (nur falls Segmentfarben fehlen)

**Interfaces:**
- Consumes: `parseOptionen`, `ziehe`, `MAX_OPTIONEN` aus `./ziehen`; `Header`, `Button`, `Segmented`, `Switch`, `reducedMotion` aus `@bbzb/ui`.
- Produces: `Rad({ optionen, drehung, onEnde })` (rendert SVG, dreht auf `drehung` Grad, ruft `onEnde` nach Transition oder sofort bei `reducedMotion()`); `Kacheln({ optionen, gewaehlt: Set<number> })`; `ladeListe(): string` und `speichereListe(text: string): void` in `liste.ts` (Schlüssel `gluecksrad-liste`, `try/catch` um `localStorage`).

- [ ] **Step 1: `liste.ts` mit Test** (`liste.test.ts`): speichern, laden, und `ladeListe()` liefert `''`, wenn `localStorage` wirft.

- [ ] **Step 2: `App.tsx`.** Zustand: `text` (Textfeld, eine Option pro Zeile, initial `ladeListe()`), `modus: 'rad' | 'mehrere'` (`Segmented`, Beschriftungen «Rad» und «Mehrere»), `entfernen: boolean` (`Switch`, nur im Modus «Rad», Beschriftung «Gewinner entfernen»), `anzahl: number` (Modus «Mehrere», Zahlenfeld, Minimum 1, Maximum Optionenzahl). Optionen = `parseOptionen(text).optionen`. Datei laden: `<input type="file" accept=".txt,text/plain">`, `file.text()`, ersetzt den Textinhalt, zeigt Hinweis bei `gekuerzt`. Jede Änderung von `text` speichert über `speichereListe`.

- [ ] **Step 3: Rad.** Modus «Rad»: Klick auf das Rad oder den Knopf «Drehen». Index = `ziehe(n, 1)[0]`. Zieldrehung = aktuelle Drehung + 4 volle Umdrehungen + Winkel, sodass die Mitte des Segments unter dem Zeiger oben liegt. `transition: transform 4s cubic-bezier(.1,.7,.1,1)`. Während der Drehung Knöpfe deaktiviert. Nach `onEnde` steht das Ergebnis gross unter dem Rad (`aria-live="polite"`); bei «Gewinner entfernen» wird die Option danach aus `text` gelöscht. Segmente als SVG-Pfade, Beschriftung radial, Schrift per Anzahl skaliert, lange Namen mit `…` gekürzt. Bei einer Option ein ganzer Kreis.

- [ ] **Step 4: Modus «Mehrere».** Knopf «Ziehen»: `ziehe(n, anzahl)`, alle Optionen als `Kacheln`, die gewählten leuchten gleichzeitig auf (Akzentfarbe, kurze Einblendung, keine Animation bei `reducedMotion()`), die übrigen werden gedämpft. Ergebnisliste zusätzlich als Text darunter.

- [ ] **Step 5: Layout.** Breit: zweispaltig (Liste links, Rad rechts, Rad füllt die Höhe, Schrift auf dem Beamer gross über `clamp()`). Schmal (unter etwa 48rem): Rad oben, Liste darunter, Knöpfe mindestens 44 px hoch. Texte: Platzhalter im Textfeld «Eine Option pro Zeile», Leerzustand «Trag mindestens zwei Optionen ein». Farben nur über Theme-Variablen.

- [ ] **Step 6: Prüfen**

Run: `npm run typecheck && npm run lint && npx vitest --project gluecksrad run`
Expected: alles grün. Zusätzlich `npm run dev -w apps/gluecksrad` und im Browser prüfen: Drehung landet auf dem angezeigten Ergebnis, Mehrfachmodus, Datei laden, Handybreite.

- [ ] **Step 7: Commit**

```bash
git add apps/gluecksrad packages/ui/src/theme.ts
git commit -m "Add wheel, multi-draw mode and file import"
```

---

### Task 3: e2e, Startseite, Doku

**Files:**
- Modify: `apps/gluecksrad/e2e/*.spec.ts`, `apps/startseite/src/tools.ts`, `apps/gluecksrad/AGENTS.md`
- Create: `apps/startseite/public/vorschau/gluecksrad.png` (960 × 540, Screenshot der App mit Beispielnamen, keine echten Personen)

**Interfaces:**
- Consumes: App aus Task 2. Test-Hooks nur über sichtbare Rollen und Beschriftungen (`getByRole('button', { name: 'Drehen' })`).

- [ ] **Step 1: e2e-Tests** (Playwright, `channel: 'msedge'` wie im Projekt):
  - Vorlagentest bleibt: Seite lädt, Kopf zeigt «Glücksrad», keine fremden Requests.
  - Optionen tippen, «Drehen», nach Ende steht genau eine der Optionen als Ergebnis da.
  - Datei laden (`setInputFiles` mit Buffer `'Anna\r\nBen\r\n\r\nAnna\r\nCleo'`): Textfeld zeigt drei Zeilen.
  - Modus «Mehrere», Anzahl 2 bei 5 Optionen: genau 2 leuchtende Kacheln, verschieden.
  - Neu laden: Liste bleibt erhalten.
  - Mobile Viewport (390 × 844): Rad und Knopf sichtbar, kein horizontales Scrollen.

- [ ] **Step 2: Startseite.** In `tools.ts` Platzhalter-Satz durch einen Satz bis 90 Zeichen ersetzen, z. B. «Zufällige Entscheidung per Glücksrad, auch mehrere Optionen auf einmal.», `beta: true`. Vorschaubild ersetzen.

- [ ] **Step 3: `AGENTS.md`** der App füllen: wofür, Dateiformat der Liste, Grenze 100, Schlüssel `gluecksrad-liste`, Hinweis auf geplantes Pixel-Embed, das `ziehen.ts` wiederverwenden kann.

- [ ] **Step 4: Gate**

Run: `npm run typecheck && npm run lint && npm test && npx playwright test --project gluecksrad && npx playwright test --project startseite`
Expected: Exit-Code 0 bei jedem Befehl (Exit-Codes prüfen, nicht nur die Ausgabe).

- [ ] **Step 5: Commit und PR**

```bash
git add apps/gluecksrad apps/startseite
git commit -m "Add gluecksrad e2e tests, tile and docs"
```
PR erstellen, Vorschau prüfen. Merge erst nach grüner CI und Rückfrage.
