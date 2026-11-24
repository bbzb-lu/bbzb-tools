# Mensa Bahnhof: Labels und Auffrischung, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ernährungs-Labels von SV übernehmen und die Seite mit Farben und Icons so gestalten, dass Preis und Vegi auf einen Blick klar sind.

**Architecture:** `Linie` bekommt `labels: string[]`. Das Skript liest pro Gericht die Alt-Texte aus `.customtag-list img` und hängt sie über eine reine Funktion an die geparsten Linien. Die Seite zeichnet Icons aus einer kleinen, kopierten Tabler-Auswahl.

**Tech Stack:** wie bisher (React, `@bbzb/ui`, Vitest, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-24-mensa-bahnhof-design.md`, Abschnitt «Nachtrag 24.11.2026».

## Global Constraints
- Alle Regeln aus `docs/superpowers/plans/2026-11-24-mensa-bahnhof.md` gelten weiter (Tool-ID, CSP, Theme-Tokens, Schweizer Rechtschreibung, keine Halbgeviertstriche, keine fremden Requests).
- Keine Bilder oder Requests zu qnips im Browser; nur Alt-Texte landen in `menu.json`.
- Neue Farben nur als Tokens in `packages/ui/src/theme.ts`.
- Tabler-Pfade kopiert, nicht als neue Abhängigkeit; Lizenz `tabler-MIT.txt` im App-`public/licenses/` mitliefern.

## Review Focus
1. Anzahl Label-Listen ≠ Anzahl geparster Linien muss den Lauf scheitern lassen (nie Labels am falschen Gericht).
2. Alte `menu.json` ohne `labels` darf die Seite nicht brechen (fehlendes Feld = keine Labels).
3. Kontrast: Text auf `accent`- und `vegi`-Flächen mindestens WCAG AA.
4. 360 px: erstes Gericht samt Preis weiter ohne Scrollen sichtbar.
5. Icons haben Textalternative (Label-Text sichtbar oder `aria-label`), dekorative SVG `aria-hidden`.

---

### Task 1: Labels holen

**Files:** Modify `apps/mensa-bahnhof/src/menu.ts`, `src/menu.test.ts`, `scripts/hole-menu.mjs`, `public/menu.json`

**Interfaces:**
- Produces: `Linie` erweitert um `labels: string[]`; `export function mitLabels(linien: Linie[], labels: string[][]): Linie[]` (wirft, wenn die Längen nicht gleich sind). `parseLinien` liefert `labels: []`.

- [ ] Test: `mitLabels([a, b], [['Vegan'], []])` hängt in Reihenfolge an; ungleiche Längen werfen; Alt-Texte getrimmt, leere entfernt.
- [ ] Bestehende Tests an das neue Feld anpassen (im Bericht nennen).
- [ ] Skript: pro Tag zusätzlich je `.product-wrapper` (bzw. das Element, das eine Linie umschliesst, am DOM prüfen) die `alt`-Texte aus `.customtag-list img` lesen, dann `mitLabels`. Leerer Tag: `[]`.
- [ ] Live-Lauf: Zielwoche aus einer Kopie von `menu.json` entfernen oder Datei löschen, `node apps/mensa-bahnhof/scripts/hole-menu.mjs` → `geschrieben`, Labels mit der SV-Seite abgleichen (mindestens ein «Vegan» am richtigen Gericht).
- [ ] Gate, Commit `feat(mensa-bahnhof): take diet labels from SV`.

### Task 2: Seite auffrischen

**Files:** Modify `apps/mensa-bahnhof/src/App.tsx`, `src/app.css`, `e2e/start.spec.ts`, `e2e/fixture-menu.json`, `packages/ui/src/theme.ts` (Token `vegi`); Create `apps/mensa-bahnhof/src/icons.ts`, `apps/mensa-bahnhof/public/licenses/tabler-MIT.txt`; Update `apps/startseite/public/vorschau/mensa-bahnhof.png`.

**Interfaces:**
- Consumes: `Linie.labels` (fehlend wie `[]` behandeln).
- Produces: `src/icons.ts` mit den Pfaden von `leaf`, `milk-off`, `wheat-off` aus `apps/news-banner/src/icons/tabler-outline.json` und `iconFuer(label: string): string[] | undefined`.

Mit `impeccable:impeccable`. Vorgaben aus dem Spec-Nachtrag: eigener Preis als `accent`-Fläche mit `on-accent`-Text und Gruppenname; Vegan/Vegetarisch als grünes Badge oben rechts in der Karte mit Icon und Text; weitere Labels klein mit Icon unter dem Preis; Linien über `illu`-Stufen unterscheidbar (z. B. Balken links oder Linien-Chip); bestehender Kachel-Stil (Rahmen in `ink`, harter Schatten wie `.datei span` / Startseite) wo passend.

- [ ] e2e ergänzen: Fixture mit Labels; Badge «Vegan» an der richtigen Karte sichtbar; Label «Laktosefrei» sichtbar; alte Fixture-Linie ohne `labels` rendert ohne Fehler.
- [ ] Umsetzen, Screenshots 360 × 740 und 1280 × 800 ansehen und beschreiben, Vorschaubild 960 × 540 neu.
- [ ] Gate inkl. `npx playwright test --project mensa-bahnhof --project suite`, Commit `feat(mensa-bahnhof): colour and icon hierarchy`.
