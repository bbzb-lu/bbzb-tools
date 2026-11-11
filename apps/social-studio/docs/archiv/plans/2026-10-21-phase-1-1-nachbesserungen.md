# Phase 1.1 «Nachbesserungen» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei Rückmeldungen aus dem ersten Test der Phase 1 umsetzen: Fotos an den Ecken proportional mit Inhalt skalieren, die Ansicht mit Ctrl/Alt + Mausrad zoomen, Projekte auf der Startseite duplizieren.

**Architecture:** Bleibt wie in Phase 1. Neue Logik als reine Funktionen im Modell (`resizeCrop`, `duplicateProject`), Zoom als UI-Zustand ausserhalb der Undo-History. Die Stage bleibt containergross, gescrollt wird nativ (jetzt waagrecht und senkrecht), Export bleibt unberührt (klont die Inhaltsebene ohne Stage-Massstab).

**Tech Stack:** wie Phase 1 (React 19, Konva 10 mit `Transformer.keepRatio`/`shiftBehavior`, zustand, Vitest, Playwright Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (Abschnitt 8 «Elemente», «Projekt und Slides») und die Rückmeldung vom 21.10.2026 (siehe unten). Phase-1-Plan: `docs/superpowers/plans/2026-10-21-phase-1-grundgeruest.md`.

**Rückmeldung (verbindlich, Wortlaut sinngemäss):**
1. Ecken-Handles skalieren ein Foto proportional; der Bildinhalt wird dabei mit grösser/kleiner, nichts verschiebt sich. Mit Shift an den Ecken und immer an den Seiten-Handles skaliert der Rahmen frei, der Inhalt passt sich live an, sodass der Rahmen immer gefüllt ist. Den genauen Ausschnitt setzt man danach per Doppelklick.
2. Ctrl + Mausrad oder Alt + Mausrad zoomt die Ansicht (viele versuchen das instinktiv).
3. Auf der Startseite «Projekt duplizieren» neben «Löschen».

## Global Constraints

Alle Global Constraints aus dem Phase-1-Plan gelten weiter (Tokens nur in `src/tokens.ts`, kein Plugin-Import im Kern, Dateien < 400 Zeilen, UI-Texte Deutsch/Schweiz/Du-Form ohne «ß» und «–», ein Undo-Schritt pro Geste, keine externen Requests, Gate vor jedem Commit: typecheck, lint, `npm test`, `npm run test:e2e`, selbst in Edge angeschaut). Zusätzlich:
- Zoom ist Ansicht, nicht Dokument: nicht in der Undo-History, nicht im Projekt gespeichert, beim Öffnen eines Projekts zurück auf «Einpassen».
- Zoombereich: 0.25 bis 8 × Einpass-Massstab. «Einpassen» = heutige Höhe-füllende Darstellung.
- Exporte sind unabhängig vom Zoom exakt `format.width × format.height`.
- `e2e/editor.spec.ts` hat 397 Zeilen: neue Tests in neue Spec-Dateien.

## Review Focus

1. **Proportionales Skalieren eines bereits manuell zugeschnittenen Fotos** (Ausschnitt verschoben und hineingezoomt): Der sichtbare Inhalt bleibt exakt derselbe, nur grösser oder kleiner. Test in Task 1.
2. **Touchpad-Pinch** (Edge meldet ihn als `wheel` mit `ctrlKey` und kleinen, krummen `deltaY`): sanfter Zoom, die Seite selbst zoomt nie mit. Test in Task 2.
3. **Zoom während offener Textbearbeitung oder im Ausschnittmodus:** Textfeld bleibt deckungsgleich, im Ausschnittmodus zoomt Ctrl/Alt+Rad die Ansicht, das normale Rad weiterhin das Bild. Test in Task 2.
4. **Export bei Zoom ≠ 1:** gleiche Dateien wie bei «Einpassen» (Grösse, Naht spaltengenau). Test in Task 2.
5. **Duplikat, dann Original löschen:** Die Kopie behält ihre Fotos (gemeinsame Assets, Aufräumen darf sie nicht löschen). Test in Task 3.

---

### Task 1: Foto-Skalierung an Ecken proportional mit Inhalt

**Files:**
- Modify: `src/model/crop.ts`, `src/model/crop.test.ts`, `src/plugins/elements/photo/index.tsx` (`afterTransform`), `src/plugins/elements/photo/PhotoNode.tsx` (`onTransform`), `src/canvas/SelectionLayer.tsx` (Transformer-Props)
- Create: `e2e/transform.spec.ts`

**Interfaces:**
- Produces: `resizeCrop(prev: Size, next: Size, img: Size, crop: Crop): Crop` in `src/model/crop.ts`.
  - Proportional, wenn `|next.width / prev.width − next.height / prev.height| ≤ 1e-3`: `s = next.width / prev.width`, Ergebnis `clampCrop(next, img, { x: crop.x · s, y: crop.y · s, scale: crop.scale · s })`.
  - Sonst: `clampCrop(next, img, crop)` (heutiges Verhalten: Rahmen bleibt gefüllt, Inhalt rückt nur so weit wie nötig).
- `afterTransform` (Foto) und `onTransform` (Live-Vorschau) rufen beide `resizeCrop` mit denselben Werten auf (`prev` = Elementgrösse vor der Geste, `next` = `width·sx`, `height·sy`), damit beim Loslassen nichts springt.
- Transformer: `keepRatio={true}` und `shiftBehavior="default"` ausdrücklich setzen (Ecken proportional, Shift macht frei; Seiten sind in Konva ohnehin frei). Gilt für alle Element-Typen; Text hat nur Seiten-Anker und ist nicht betroffen.

- [ ] **Step 1: Unit-Tests** (`src/model/crop.test.ts`):

```ts
const img = { width: 4000, height: 3000 };
it('proportional: Inhalt skaliert mit, Ausschnitt bleibt gleich', () => {
  const crop = { x: -300, y: -200, scale: 0.6 };          // manuell verschoben und gezoomt
  const r = resizeCrop({ width: 1000, height: 800 }, { width: 1500, height: 1200 }, img, crop);
  expect(r).toEqual({ x: -450, y: -300, scale: 0.9 });
});
it('proportional verkleinern unter Deckend-Grenze: wird gedeckt gehalten', () => {
  const r = resizeCrop({ width: 1000, height: 750 }, { width: 500, height: 375 }, img, coverCrop({ width: 1000, height: 750 }, img));
  expect(r.scale).toBeCloseTo(0.125); expect(r.x).toBeCloseTo(0); expect(r.y).toBeCloseTo(0);
});
it('frei (nur Breite): Skalierung bleibt, Rahmen bleibt gefüllt', () => {
  const crop = { x: -300, y: -200, scale: 0.6 };
  expect(resizeCrop({ width: 1000, height: 800 }, { width: 1600, height: 800 }, img, crop))
    .toEqual(clampCrop({ width: 1600, height: 800 }, img, crop));
});
it('Toleranz: Rundung bis 1e-3 zählt als proportional', ...);
```

- [ ] **Step 2: E2E-Tests** (`e2e/transform.spec.ts`), Foto `gradientPng(3000, 2000)`, vorher per Ausschnittmodus etwas verschoben:
  - Ecke unten rechts um +100 px ziehen → Seitenverhältnis gleich, `crop.scale` × Faktor, `crop.x/y` × Faktor; ein Undo-Schritt.
  - Mit gedrückter Shift-Taste Ecke ziehen → Seitenverhältnis geändert, Rahmen gedeckt (`crop.x ≤ 0`, `crop.x + imgW·scale ≥ width`, analog y).
  - Seiten-Handle rechts ziehen → nur Breite ändert sich, Rahmen gedeckt.
  - Während des Ziehens (Maus noch unten) Screenshot der Fotofläche ≈ Screenshot nach dem Loslassen (kein Sprung; Vergleich mit `toHaveScreenshot`-freiem Pixelvergleich über `page.screenshot({ clip })`, mittlere Abweichung pro Kanal ≤ 2 %).
- [ ] **Step 3:** Tests laufen lassen → FAIL (Funktion fehlt, Ecke verhält sich wie heute).
- [ ] **Step 4:** Implementieren.
- [ ] **Step 5:** Gate grün, in Edge selbst ausprobieren (Ecke, Shift+Ecke, Seite), Screenshots ansehen.
- [ ] **Step 6: Commit** `Scale photo content with proportional corner resize`.

---

### Task 2: Ansicht zoomen mit Ctrl/Alt + Mausrad

**Files:**
- Modify: `src/store/ui.ts` (Zoom-Zustand), `src/canvas/CanvasView.tsx`, `src/canvas/TextEditOverlay.tsx` (falls es Massstab/Versatz anders bekommt), `src/plugins/elements/photo/PhotoNode.tsx` (Rad im Ausschnittmodus ignoriert Ctrl/Alt), `src/ui/shortcuts.ts`, `src/store/document.ts` oder die Stelle, die beim Projektwechsel UI zurücksetzt, `src/ui/app.css`
- Create: `src/canvas/zoom.ts` + `src/canvas/zoom.test.ts`, `e2e/zoom.spec.ts`

**Interfaces:**
- Produces:
  - `useUi`: `zoom: number` (Standard 1, nicht persistiert), `setZoom(z: number)`; beim Laden eines anderen Projekts auf 1.
  - `src/canvas/zoom.ts`: `export const MIN_ZOOM = 0.25, MAX_ZOOM = 8`; `clampZoom(z): number`; `zoomStep(z: number, deltaY: number): number` → `clampZoom(z · Math.exp(−deltaY · 0.0015))` (stufenloses Rad und Touchpad-Pinch, gleiche Formel); `zoomAround(scroll: {left, top}, pointer: {x, y}, oldScale: number, newScale: number): {left, top}` → neue Scroll-Position, sodass der Weltpunkt unter dem Zeiger stehen bleibt (`pointer` relativ zum Scroll-Container, Inhaltsrand `PAD` berücksichtigen).
- `CanvasView`:
  - `scale = fitScale × zoom`, `fitScale` = heutige Formel.
  - Inhalt `canvas-content` bekommt Breite `max(total, view.width)` **und** Höhe `max(format.height·scale + 2·PAD, view.height)`; die Stage bleibt containergross und folgt dem Scrollen in beide Richtungen (`stage.x = PAD − scrollLeft`, `stage.y = PAD − scrollTop`), weiterhin ohne React-Render beim Scrollen.
  - Natives `wheel`-Event am Scroll-Container mit `{ passive: false }` (React-`onWheel` ist passiv): bei `ctrlKey || altKey || metaKey` → `preventDefault()`, Zoom um den Zeiger. Ohne Modifikator: wenn senkrecht nichts zu scrollen ist, wie heute waagrecht scrollen; sonst natives Scrollen (senkrecht, Shift = waagrecht). Im Ausschnittmodus ohne Modifikator: unverändert das Bild zoomen (PhotoNode), mit Modifikator die Ansicht.
  - Kleine Zoom-Leiste in `canvas-tools` (rechtsbündig): Buttons «Verkleinern» (−), Anzeige «100 %» (= zoom × 100, gerundet), «Vergrössern» (+), «Einpassen»; Buttons zoomen um Faktor 1.25 um die Mitte der sichtbaren Fläche.
- Tastenkürzel (`shortcuts.ts`, gleiche Filter wie bisher): `Ctrl+0` Einpassen, `Ctrl++`/`Ctrl+=` vergrössern, `Ctrl+-` verkleinern, jeweils `preventDefault` (Edge-Seitenzoom).

- [ ] **Step 1: Unit-Tests** (`src/canvas/zoom.test.ts`): `clampZoom` an beiden Grenzen; `zoomStep` mit `deltaY = −100` > z, mit `+100` < z, Pinch-Werte (`deltaY = −3.5`) ergeben kleinen Schritt; `zoomAround`: Weltpunkt unter dem Zeiger bleibt gleich (Weltpunkt vorher = `(scroll + pointer − PAD) / oldScale`, nachher dasselbe mit `newScale`).
- [ ] **Step 2: E2E-Tests** (`e2e/zoom.spec.ts`):
  - Ctrl + Rad hoch über der Leinwand → Anzeige > 100 %, Stage-Massstab grösser; `await page.evaluate(() => visualViewport!.scale)` bleibt 1 (Seite zoomt nicht mit).
  - Alt + Rad und Pinch-ähnliche Events (`ctrlKey`, `deltaY: −3.5`, mehrfach) zoomen sanft.
  - Punkt unter dem Zeiger bleibt: Element unter dem Zeiger ist nach dem Zoom noch unter dem Zeiger (Hit-Test über `__bbzbTest`).
  - Senkrecht scrollen ist bei Zoom > 1 möglich, die Auswahl per Klick trifft danach das richtige Element.
  - «Einpassen» und `Ctrl+0` → 100 %; anderes Projekt öffnen → 100 %.
  - Zoom ist kein Undo-Schritt (`Ctrl+Z` nach Zoom ändert das Projekt nicht).
  - Ausschnittmodus: Rad ohne Modifikator ändert `crop.scale`, nicht den Zoom; Ctrl+Rad ändert den Zoom, nicht `crop.scale`.
  - Textbearbeitung offen, dann zoomen → `overlayVsElement`-Prüfung aus `e2e/editor.spec.ts` (in `e2e/fixtures.ts` verschieben) hält 1.5 px.
  - Export bei Zoom 300 %: Spaltentest aus `e2e/export.spec.ts` (Fixture `columnPng`) besteht, Dateien 1080 × 1350.
- [ ] **Step 3:** FAIL. **Step 4:** Implementieren.
- [ ] **Step 5:** Gate grün. In Edge ausprobieren: Mausrad mit Ctrl und Alt, Touchpad-Pinch auf dem Mac, Zoom-Buttons, Tastenkürzel. Ziehen bei Zoom 300 % mit 4× CPU-Drosselung messen und im Bericht notieren.
- [ ] **Step 6: Commit** `Add canvas zoom with Ctrl/Alt + wheel, pinch and zoom buttons`.

---

### Task 3: Projekt duplizieren auf der Startseite

**Files:**
- Modify: `src/model/slides.ts` (oder `src/model/project.ts`, falls `slides.ts` zu gross wird), `src/ui/StartPage.tsx`, `e2e/project.spec.ts`
- Test: `src/model/duplicateProject.test.ts` (oder bestehende Model-Testdatei)

**Interfaces:**
- Produces: `duplicateProject(p: Project, now = Date.now()): Project` → tiefe Kopie mit neuer `id` (`crypto.randomUUID()`), `name = «<Name> (Kopie)»` auf 200 Zeichen gekürzt, `createdAt = updatedAt = now`. Element- und Slide-IDs bleiben (gehören zum Projekt), `assets` bleiben gleich (dieselben Blobs in OPFS, keine Kopie der Dateien).
- Startseite: pro Projekt neben «Öffnen»/«Löschen» ein Button «Duplizieren» (`aria-label` «‹Name› duplizieren» im gleichen Stil wie die bestehenden Labels). Klick → `loadProject` → `duplicateProject` → `saveProject` → Liste neu laden; das Duplikat erscheint oben (neuestes `updatedAt`). Fehler → Meldung «Das Projekt konnte nicht dupliziert werden.» (`role="alert"`), Liste unverändert.

- [ ] **Step 1: Unit-Test:** neue ID, Name mit « (Kopie)», gleiche Slides/Elemente/Assets, tiefe Kopie (Änderung an der Kopie ändert das Original nicht), langer Name wird auf 200 Zeichen gekürzt und bleibt gültig für `parseProject`.
- [ ] **Step 2: E2E** (`e2e/project.spec.ts`): Projekt mit Foto anlegen → «Duplizieren» → zwei Einträge, oben «… (Kopie)» → Original löschen → Kopie öffnen → Foto wird angezeigt (kein Platzhalter «Bild fehlt»), Export funktioniert. (Review Focus 5)
- [ ] **Step 3:** FAIL. **Step 4:** Implementieren. **Step 5:** Gate grün, Startseite in Edge ansehen (drei Buttons pro Zeile, nichts bricht um bei 1280 px).
- [ ] **Step 6: Commit** `Add duplicate project on start page`.

---

### Task 4: Abschluss

- [ ] **Step 1:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt 8 «Elemente» bzw. «Gemeinsam für alle»: je eine Zeile zu Ecken/Shift/Seiten-Verhalten und zum Ansichts-Zoom ergänzen; «Projekt und Slides»: «Projekt duplizieren» auf der Startseite. Keine anderen Änderungen.
- [ ] **Step 2:** Gate grün, Deploy mit `npm run deploy` erst nach Freigabe durch Alexej (nach dem Merge in `main`).
- [ ] **Step 3: Commit** `Spec: phase 1.1 behaviour (resize, zoom, duplicate)`.

## Bewusst nicht in Phase 1.1
Mehr Texteinstellungen, Snapping, Safe Zones und «Als anderes Format kopieren» kommen mit Phase 2 (Planung folgt nach Phase 1.1).
