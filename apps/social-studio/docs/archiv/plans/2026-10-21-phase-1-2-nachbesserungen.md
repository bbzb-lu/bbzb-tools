# Phase 1.2 «Nachbesserungen II» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vier Rückmeldungen aus dem Live-Test von Phase 1.1: Bild bei freiem Skalieren zentrieren, neue Fotos im Originalformat einfügen, Slides in der Ansicht zentrieren, Umsortieren der Slides sichtbar machen.

**Architecture:** Wie Phase 1.1. Neue Rechenlogik als reine Funktionen (`resizeCrop`, `insertFrame`, `canvasLayout`, `zoomAround` mit Ursprung), UI-Code nutzt nur diese. Die bisherige Konstante `PAD` als horizontaler/vertikaler Ursprung wird durch einen berechneten Ursprung ersetzt.

**Tech Stack:** wie Phase 1/1.1.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (Abschnitt 8, Ergänzungen aus Phase 1.1), Plan 1.1: `docs/superpowers/plans/2026-10-21-phase-1-1-nachbesserungen.md`.

**Rückmeldung 21.10.2026 (verbindlich, mit Entscheiden von Alexej):**
1. Freies Skalieren (Shift + Ecke, Seiten-Handles): das Bild wird **zentriert** im neuen Rahmen; ein selbst gewählter Zoom bleibt, es wird nur so weit vergrössert, wie nötig ist, damit der Rahmen gefüllt bleibt.
2. Neue Fotos behalten ihr **Originalformat** und füllen die Slide-Breite. Wäre das Foto dann höher als die Slide, wird es **ganz sichtbar eingepasst** (so gross wie möglich, ohne über die Slide hinauszuragen). Immer zentriert auf der aktuellen Slide.
3. Slides stehen in der Ansicht **zentriert** (neues Dokument: Slide in der Mitte, nicht links). Zoomen soll sich dadurch natürlicher anfühlen.
4. Slides umsortieren ist schon möglich (Kacheln ziehen, Alt + Pfeiltaste), aber nicht auffindbar: sichtbare Buttons.

## Global Constraints

Alle Global Constraints aus Phase 1 und 1.1 gelten (Tokens nur in `src/tokens.ts`, kein Plugin-Import im Kern, Dateien < 400 Zeilen, Deutsch/Schweiz/Du-Form ohne «ß» und «–», ein Undo-Schritt pro Geste, Zoom nicht in History/Projekt/Export, keine externen Requests, Gate vor jedem Commit inkl. `npm run test:e2e`, selbst in Edge angeschaut). Bestehende Tests, die das alte Verhalten festschreiben (Foto füllt die Slide, Inhaltsrand `PAD` links), werden an das neue Verhalten angepasst, nicht gelöscht.

## Review Focus

1. **Querformat-Foto in einer 9:16-Story und Hochformat-Foto in einem 4:5-Post:** Rahmen im Originalformat, ganz auf der Slide, zentriert, Ausschnitt zeigt das ganze Bild. Test in Task 1.
2. **Zoom um den Zeiger bleibt exakt** (1 Slide und 3 Slides, Zoom über und unter 100 %), obwohl sich der Ursprung jetzt mit dem Zoom ändert. Test in Task 2.
3. **Text bearbeiten, Drop auf eine Slide, Klick auf leere Fläche** treffen nach dem Zentrieren die richtige Slide bzw. liegen deckungsgleich. Test in Task 2.
4. **Viele Slides** (breiter als die Ansicht, Zoom 100 %): Verhalten wie bisher (links Rand `PAD`, waagrecht scrollen, aktuelle Slide sichtbar halten). Test in Task 2.
5. **Export unverändert** (Grösse, Naht spaltengenau) bei zentrierter Ansicht und Zoom ≠ 1. Test in Task 2.

---

### Task 1: Bild zentrieren beim freien Skalieren, Fotos im Originalformat einfügen

**Files:**
- Modify: `src/model/crop.ts`, `src/model/crop.test.ts`, `src/model/geometry.ts` (oder `crop.ts`) + Test, `src/plugins/elements/photo/index.tsx` (`photoFromFile`)
- Modify (Erwartungen anpassen): e2e-Tests, die beim Einfügen einen slidefüllenden Rahmen erwarten (u. a. `e2e/editor.spec.ts` «Foto … füllt die aktuelle Slide», ggf. `e2e/transform.spec.ts`, `e2e/network.spec.ts`)

**Interfaces:**
- `resizeCrop(prev, next, img, crop)`: proportionaler Zweig unverändert. Freier Zweig neu: `scale = max(crop.scale, coverCrop(next, img).scale)`, `x = (next.width − img.width·scale) / 2`, `y = (next.height − img.height·scale) / 2`.
- Neu: `insertFrame(slide: Rect, img: Size): Rect` → `w = slide.width`, `h = slide.width · img.height / img.width`; falls `h > slide.height`: `h = slide.height`, `w = slide.height · img.width / img.height`. Rahmen zentriert auf der Slide (`x = slide.x + (slide.width − w)/2`, `y = slide.y + (slide.height − h)/2`).
- `photoFromFile`: Rahmen = `insertFrame(slideRect(d, currentSlide), img)`, `crop = coverCrop(frame, img)` (passt exakt, ganzes Bild sichtbar).

- [ ] **Step 1: Unit-Tests**

```ts
const img = { width: 4000, height: 3000 };
it('frei: zentriert, Zoom bleibt', () => {
  const r = resizeCrop({ width: 1000, height: 800 }, { width: 1600, height: 800 }, img, { x: -300, y: -200, scale: 0.6 });
  expect(r.scale).toBeCloseTo(0.6);
  expect(r.x).toBeCloseTo((1600 - 4000 * 0.6) / 2);   // −400
  expect(r.y).toBeCloseTo((800 - 3000 * 0.6) / 2);    // −500
});
it('frei: zu klein wird auf deckend vergrössert und zentriert', () => {
  const r = resizeCrop({ width: 1000, height: 800 }, { width: 3000, height: 800 }, img, { x: 0, y: 0, scale: 0.3 });
  expect(r.scale).toBeCloseTo(0.75); expect(r.x).toBeCloseTo(0); expect(r.y).toBeCloseTo((800 - 2250) / 2);
});
it('insertFrame: Querformat in Story füllt die Breite, vertikal zentriert', () => {
  expect(insertFrame({ x: 1080, y: 0, width: 1080, height: 1920 }, { width: 3000, height: 2000 }))
    .toEqual({ x: 1080, y: 600, width: 1080, height: 720 });
});
it('insertFrame: Hochformat 3:4 im Post wird ganz sichtbar eingepasst', () => {
  expect(insertFrame({ x: 0, y: 0, width: 1080, height: 1350 }, { width: 3000, height: 4000 }))
    .toEqual({ x: 33.75, y: 0, width: 1012.5, height: 1350 });
});
it('insertFrame: genau 4:5 füllt die Post-Slide', ...);
```

- [ ] **Step 2: E2E** (neue Datei `e2e/insert.spec.ts`): Querformat 3000 × 2000 in einen Post → Rahmen 1080 × 720 bei y 315; Hochformat 3000 × 4000 → 1012.5 × 1350; Story: Querformat → y 600; Shift + Ecke ziehen → `crop` zentriert (x = (w − imgW·scale)/2 ± 0.5), Zoom gleich, ein Undo-Schritt; Seiten-Handle ebenso. Bestehende e2e-Erwartungen an den neuen Einfüge-Rahmen anpassen.
- [ ] **Step 3:** FAIL. **Step 4:** Implementieren. **Step 5:** Gate grün, in Edge ansehen (Quer- und Hochformat einfügen, frei skalieren).
- [ ] **Step 6: Commit** `Center photo on free resize, insert photos in original aspect`.

---

### Task 2: Slides in der Ansicht zentrieren

**Files:**
- Modify: `src/canvas/zoom.ts` + `zoom.test.ts`, `src/canvas/CanvasView.tsx`, `src/canvas/TextEditOverlay.tsx` (Ursprung statt `pad`), betroffene e2e-Helfer in `e2e/fixtures.ts`
- Test: `e2e/zoom.spec.ts` (ergänzen), ggf. neue `e2e/layout.spec.ts`

**Interfaces:**
- Neu in `zoom.ts`: `canvasLayout(view: Size, slides: Size, zoom: number): { originX: number; originY: number; width: number; height: number | '100%' }`, wobei `slides` = Gesamtgrösse aller Slides in Bildschirm-px (`slideCount·W·scale`, `H·scale`):
  - **zoom > 1** (Arbeitsfläche): `originX = view.width / 2`, `width = slides.width + view.width`; `originY = view.height / 2`, `height = slides.height + view.height`. Damit hat der Zoom-Anker in alle Richtungen Platz.
  - **zoom ≤ 1 und `slides.width + 2·PAD ≤ view.width`**: `originX = (view.width − slides.width) / 2`, `width = view.width` (kein waagrechtes Scrollen, Slides mittig).
  - **zoom ≤ 1, breiter als die Ansicht**: `originX = PAD`, `width = slides.width + 2·PAD` (heutiges Verhalten).
  - **zoom ≤ 1, vertikal**: `originY = max(PAD, (view.height − slides.height) / 2)`, `height = '100%'`.
- `zoomAround(scroll, pointer, oldScale, newScale, oldOrigin: {x, y}, newOrigin: {x, y})`: Weltpunkt `= (scroll + pointer − oldOrigin) / oldScale`, neues Scroll-Ziel `= welt · newScale + newOrigin − pointer` (je Achse).
- `CanvasView`: Stage-Position `= origin − scroll`; `slideAt`, Drop, Scroll-in-Sicht, Button-Zoom-Mitte und TextEditOverlay nutzen den Ursprung statt `PAD`. Die Sonderfälle aus 1.1 (`total + view.width` nur rechts, `scrollLeft = 0` beim Button-Zoom) entfallen, weil `canvasLayout` sie abdeckt.
- Beim Wechsel zu zoom > 1 ohne Zeiger (Buttons, Tasten, «Einpassen» zurück auf 1) wird um die Mitte des sichtbaren Slide-Bereichs gezoomt, wie bisher.

- [ ] **Step 1: Unit-Tests** (`zoom.test.ts`): alle drei Fälle von `canvasLayout` (eine Story-Slide bei 990 × 600 Ansicht → zentriert; 10 Slides → `PAD`; Zoom 2 → halbe Ansicht als Rand); `zoomAround` mit unterschiedlichem alten/neuen Ursprung hält den Weltpunkt fest (Rückrechnung).
- [ ] **Step 2: E2E:** neues Projekt → Slide horizontal mittig (Abstand links ≈ rechts ± 1 px); 3 Slides breiter als Ansicht → links `PAD` wie bisher; Anker-Tests aus `zoom.spec.ts` (1 Slide Story, 3 Slides) laufen weiter, plus Zoom 100 % → 300 % → 60 % mit festem Punkt; Klick auf leere Fläche und Datei-Drop wählen die richtige Slide (zentriert und gezoomt); Textfeld-Überlagerung deckungsgleich (`overlayVsElement`) bei 100 % zentriert und bei 250 %; Export-Spaltentest bei zentrierter Ansicht.
- [ ] **Step 3:** FAIL. **Step 4:** Implementieren (Stage bleibt containergross, Scrollen ohne React-Render wie bisher).
- [ ] **Step 5:** Gate grün. In Edge: neues Projekt, Zoom mit Rad und Buttons, Scrollen, viele Slides. Ziehen bei 4× CPU-Drosselung kurz messen.
- [ ] **Step 6: Commit** `Center slides in the canvas view`.

---

### Task 3: Slides sichtbar umsortieren

**Files:**
- Modify: `src/ui/SlideBar.tsx`, `src/ui/app.css`, `e2e/editor-actions.spec.ts` (oder neue `e2e/slides.spec.ts`, falls > 400 Zeilen)

**Interfaces:**
- In der Aktionsgruppe der Slide-Leiste zwei Buttons vor «Slide hinzufügen»: «Slide nach links» und «Slide nach rechts» (sichtbarer Text kurz «← Nach links» / «Nach rechts →» oder Pfeil-Icons mit diesen `aria-label`s, `title` mit Kürzel «Alt + ←» / «Alt + →»). Sie verschieben die aktuelle Slide über die bestehende `move`-Funktion (`moveSlide`, ein Undo-Schritt, Fotos über der Naht wandern mit). Am Rand `aria-disabled="true"` (kein `disabled`, Fokus bleibt), Klick dann ohne Wirkung.
- Tooltip der Kachel bleibt («Ziehen oder Alt + Pfeiltaste verschiebt die Slide.»).

- [ ] **Step 1: E2E:** 3 Slides, Slide 1 wählen, «Slide nach rechts» → Reihenfolge B, A, C, aktuelle Slide = 2, ein Undo-Schritt; bei der letzten Slide ist «Slide nach rechts» `aria-disabled` und ändert nichts; Fokus bleibt auf dem Button.
- [ ] **Step 2:** FAIL. **Step 3:** Implementieren. **Step 4:** Gate grün, Slide-Leiste bei 1280 px ansehen (nichts bricht um).
- [ ] **Step 5: Commit** `Add visible move buttons to the slide bar`.

---

### Task 4: Spezifikation nachführen

- [ ] **Step 1:** In `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` die Zeilen aus Phase 1.1 ergänzen: freies Skalieren zentriert das Bild (Zoom bleibt); Fotos werden im Originalformat eingefügt (Slide-Breite, sonst ganz sichtbar eingepasst, zentriert); Slides stehen in der Ansicht zentriert, beim Zoomen gibt es Arbeitsfläche rundherum; Slides lassen sich über Buttons, Ziehen oder Alt + Pfeiltaste umsortieren. Keine anderen Änderungen.
- [ ] **Step 2: Commit** `Spec: phase 1.2 behaviour`.

## Bewusst nicht in Phase 1.2
Format ändern («Als Story/Post kopieren») kommt am Ende von Phase 2b (siehe `phase-2-stichworte.md`).
