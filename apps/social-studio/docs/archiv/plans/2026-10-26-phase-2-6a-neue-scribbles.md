# Phase 2.6a «Neue Scribbles» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sechs neue Scribbles aufbereiten und als `scribble-13` bis `scribble-18` in die Bibliothek aufnehmen.

**Architecture:** Reine Asset-Arbeit, kein Code im Editor. Die Bilder werden einmalig verkleinert, zugeschnitten und umbenannt, dann im Manifest eingetragen. Die Bibliothek liest das Manifest und die Einfärbung (`source-in`) braucht nur den Alphakanal, die Quellfarbe ist egal.

**Tech Stack:** `sharp` (liegt in `node_modules`, nur für den einmaligen Lauf, nicht in `package.json`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt Brand-Assets (Scribbles). Dazu `CLAUDE.md`, `docs/superpowers/workflow.md`.

## Entscheide (Alexej, 26.10.2026)
- Namen beschreibend, die alten bleiben «Scribble 1» bis «Scribble 12».
- Neue Scribbles hinten anhängen, Reihenfolge und IDs der alten bleiben (gespeicherte Projekte und Layouts bleiben gültig).
- Mein Vorschlag, nicht bestätigt: längste Seite höchstens 2048 px, leere Ränder wegschneiden, Dateien `Scribble_13.png` bis `Scribble_18.png`.

## Global Constraints
- Werte nur in der Token-Datei; Asset-Pfade nur im Manifest (Architekturtest in `src/brand/manifest.test.ts`).
- Alle Scribbles starten mit `defaultColor: "akzent"`.
- UI-Texte Deutsch mit Schweizer Rechtschreibung, keine Halbgeviertstriche (–).
- Dateien liegen nur in `brand/scribbles/`, nichts verlässt den Browser, keine neuen Requests.
- Gate vor dem Commit: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`. Tests nie abschwächen.
- Branch `phase-2-6a` von `main`. Commit-Nachrichten Englisch, enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- Halbtransparenter heller Saum um das Kreuz (Marker Scribble 14): nach dem Einfärben darf kein heller Rand sichtbar sein, weder auf der Leinwand noch im Export.
- Sehr schmale, hohe Scribbles (Fragezeichen 18: 4041 × 9283, Ausrufezeichen 23: 2053 × 8949): nach dem Verkleinern bleiben Kanten glatt, Klick auf die sichtbare Form wählt das Element.
- Dateigrösse: das Bundle wächst nur um die neuen PNGs, jedes unter 600 KB.
- Alte Projekte: `scribble-01` bis `scribble-12` und ihre Layouts sehen unverändert aus.

---

### Task 1: Bilder aufbereiten

**Files:**
- Modify (ersetzen): `brand/scribbles/18.png`, `23.png`, `lightbulb.png`, `Marker Scribble 14 Background Removed.png`, `Marker Scribble 207.png`, `Marker Scribble 208.png`
- Create: `brand/scribbles/Scribble_13.png` bis `Scribble_18.png`
- Test: `src/brand/manifest.test.ts`

**Interfaces:**
- Produces: sechs PNGs mit Alphakanal, längste Seite ≤ 2048 px, Dateinamen nach dieser Zuordnung (ID → Quelle → Name):
  - `scribble-13` ← `lightbulb.png` «Glühbirne»
  - `scribble-14` ← `18.png` «Fragezeichen»
  - `scribble-15` ← `23.png` «Ausrufezeichen»
  - `scribble-16` ← `Marker Scribble 14 Background Removed.png` «Kreuz»
  - `scribble-17` ← `Marker Scribble 207.png` «Fragezeichen Pinsel»
  - `scribble-18` ← `Marker Scribble 208.png` «Ausrufezeichen Pinsel»

- [ ] **Step 1: Failing test schreiben** in `src/brand/manifest.test.ts`, Block `brand/manifest.json`: jede Scribble-Datei hat längste Seite ≤ 2048 px und eine transparente Ecke (Breite und Höhe aus dem PNG-Kopf, Alpha der Ecke mit `pngjs`, das schon Dev-Abhängigkeit ist).
- [ ] **Step 2:** `npx vitest run src/brand/manifest.test.ts` → Erwartet: FAIL nur wegen der neuen Dateien (die 12 alten bestehen schon, sonst Test anpassen, nicht die Dateien).
- [ ] **Step 3: Einmaliges Skript im Scratchpad** (nicht committen, aus dem Repo-Ordner starten, damit `sharp` gefunden wird): pro Quelle `sharp(src).trim()` auf transparentem Hintergrund, dann `.resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })`, als PNG nach `Scribble_NN.png`, danach die Originale löschen. PNG-Grösse jeweils unter 600 KB (sonst `compressionLevel: 9`, `palette` nur falls das Bild es verträgt).
- [ ] **Step 4:** Jede Datei im Bild-Viewer ansehen (Ränder weg, nichts abgeschnitten, kein heller Saum beim Kreuz).
- [ ] **Step 5:** Test aus Step 1 läuft grün, `ls -la brand/scribbles` zeigt die Grössen.

### Task 2: Manifest, Doku, Abnahme

**Files:**
- Modify: `brand/manifest.json` (sechs Einträge hinter `scribble-12`, vor den Icons), `src/brand/manifest.test.ts` (`toHaveLength(12)` → `18`), `CLAUDE.md` (Tabelle Brand-Assets: «12 Scribbles» → «18 Scribbles», «dunkelblau» streichen, die Quellfarbe ist egal), `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (Zeile «Scribbles sind dunkelblaue PNGs …» auf «PNGs mit Alphakanal, Quellfarbe egal» und Eintrag im Phasenlog), `docs/roadmap.md` (Zeile 2.6a auf «erledigt» kürzen)

**Interfaces:**
- Consumes: Dateien und Zuordnung aus Task 1.
- Produces: Manifest-Einträge im bestehenden Format: `{ "id": "scribble-13", "file": "scribbles/Scribble_13.png", "name": "Glühbirne", "category": "scribble", "defaultColor": "akzent" }`.

- [ ] **Step 1:** Test anpassen: Scribbles im Manifest `toHaveLength(18)`. `npx vitest run src/brand/manifest.test.ts` → FAIL (12 statt 18).
- [ ] **Step 2:** Sechs Einträge nach der Zuordnung aus Task 1 in `brand/manifest.json` eintragen.
- [ ] **Step 3:** `npx vitest run src/brand/manifest.test.ts` → PASS (inklusive Architekturtest und «starten in akzent»).
- [ ] **Step 4: Selbst anschauen.** App in Edge starten, in der Bibliothek Tab «Scribbles»: alle 18 sichtbar, die neuen hinten, Namen im Tooltip. Jedes neue Scribble einfügen (Klick), einfärben in Orange, Warmweiss und Standortfarbe, als PNG exportieren und die Datei öffnen. Besonders das Kreuz: kein heller Saum. Screenshot des Tabs und ein Export ansehen. Alte Scribbles 1 bis 12 in einem Layout (z. B. Pfeil `scribble-05`) unverändert.
- [ ] **Step 5:** Gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.
- [ ] **Step 6: Doku nachführen** (CLAUDE.md, Spezifikation, Roadmap, `docs/superpowers/naechste-session.md` neu: Nächste Phase ist 2.6). Plan nach `docs/archiv/plans/` verschieben.
- [ ] **Step 7: Commit** auf `phase-2-6a`, dann Gesamt-Review (`superpowers:requesting-code-review`), Merge in `main`, vor dem Deploy kurz bei Alexej nachfragen.

## Self-Review
- Spec: Scribble-Zeile in Spezifikation und CLAUDE.md sagen «dunkelblau», das stimmt für die neuen nicht, darum in Task 2 angepasst.
- Namen: Manifest-Namen und Zuordnung stimmen mit Task 1 überein.
- Nicht geprüft vor der Umsetzung: ob `sharp.trim()` den halbtransparenten Saum beim Kreuz sauber behandelt. Wenn nicht, Alphakanal vor dem Trimmen mit einem Schwellwert bereinigen.
