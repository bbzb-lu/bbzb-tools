# Mensa Infoscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seite `/mensa-bahnhof/infoscreen/` für enlogic-Bildschirme (1920 × 1080), einbettbar, frischt sich selbst auf.

**Architecture:** Dritter Vite-Einstieg wie das Embed (`infoscreen/index.html`, `src/infoscreen.tsx`, `src/Infoscreen.tsx`, `src/infoscreen.css`). Daten über `useDatei` aus `src/App.tsx`, das ein optionales Neuladen-Intervall bekommt.

**Tech Stack:** React, Vite, Playwright (msedge).

**Spec:** `docs/superpowers/specs/2026-11-27-mensa-infoscreen-design.md`

## Global Constraints
- Farben nur über Variablen aus `packages/ui/src/theme.ts`.
- Texte Schweizer Rechtschreibung, keine Halbgeviertstriche.
- Keine absoluten Pfade, `import.meta.env.BASE_URL` nutzen.
- Preise: `SCHU` gross («Lernende»), `MA` mittel («Mitarbeitende»), `EXT` klein («Externe»).

## Review Focus
- Fünf oder mehr Linien an einem Tag: alles bleibt im Bild (Spalten = Anzahl Linien).
- Langer Gerichtname oder lange Beilagen: kein Überlauf aus der Karte (Beilagen kürzen per line-clamp).
- `menu.json` fällt beim Neuladen aus: letztes Menü bleibt stehen.
- Tageswechsel ohne Reload: nach dem nächsten Neuladen steht der neue Tag.
- Linie ohne einzelnen Preis: Zeile fehlt, kein «CHF undefined».

---

### Task 1: Neuladen in `useDatei`

**Files:** Modify `apps/mensa-bahnhof/src/App.tsx` (`useDatei`)

**Interfaces:** Produces `useDatei(neuLadenMs?: number): MenuDatei | 'fehlt' | undefined`. Ohne Argument wie bisher. Mit Argument: `setInterval` lädt neu; Fehler behalten gültige alte Daten (`'fehlt'` nur, wenn noch nichts da war). Jedes erfolgreiche Laden setzt ein neues Objekt, also rendert die Seite neu und `ansicht(…, new Date())` sieht den neuen Tag.

Getestet über Task 2 (e2e mit `page.clock`).

### Task 2: Infoscreen-Seite

**Files:**
- Create: `apps/mensa-bahnhof/infoscreen/index.html` (wie `embed/index.html`, `body class="infoscreen"`, Titel «Mensa Bahnhof Infoscreen»)
- Create: `apps/mensa-bahnhof/src/infoscreen.tsx`, `src/Infoscreen.tsx`, `src/infoscreen.css`
- Modify: `apps/mensa-bahnhof/vite.config.ts` (Input `infoscreen`), `_headers` (Regel `/mensa-bahnhof/infoscreen/*` mit `frame-ancestors *`), `apps/mensa-bahnhof/AGENTS.md`
- Test: `apps/mensa-bahnhof/e2e/infoscreen.spec.ts`

**Interfaces:** Consumes `useDatei(30 * 60_000)`, `ansicht`, `tagTitel`, `Icon`, `VEGI`.

- [ ] **Step 1: e2e schreiben** (Fixture, Uhr `2026-11-24T10:00:00`, 1920 × 1080, `infoscreen/`)
  - h1 enthält «Heute, Dienstag 24. November»; 4 `article`, alle `toBeInViewport({ ratio: 1 })`; Scrollmasse `[1080, 1920]`.
  - Erste Karte: `.preis-schu` «CHF» + Lernende-Preis der Fixture, danach `.preis-ma`, dann `.preis-ext` (Reihenfolge im DOM).
  - Neuladen: `page.clock.install` statt `setFixedTime`, auf `2026-11-25T10:00` vorspulen (`runFor` 30 min nach `setSystemTime`), h1 zeigt Mittwoch.
  - Ausfall: Route danach auf Status 500, vorspulen, h1 bleibt.
  - Keine fremden Anfragen, keine Seitenfehler.
- [ ] **Step 2: Test laufen lassen, schlägt fehl** `npx playwright test --project mensa-bahnhof infoscreen`
- [ ] **Step 3: Seite bauen.** Kopf «Mensa Bahnhof» + Datum, Karten in einer Reihe (`grid-template-columns: repeat(n, 1fr)`), Schrift in `vh`. Leerzustände wie Embed, gross und mittig.
- [ ] **Step 4: Test grün**, dazu `npm run check`.
- [ ] **Step 5: Commit** `feat(mensa-bahnhof): infoscreen page for entrance screens`
