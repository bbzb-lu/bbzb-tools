# Phase 2.1 «Nachbesserungen nach dem Live-Test von 2b» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ablauf und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Das Werkzeug passt ganz auf einen Laptop-Bildschirm, Hintergründe und Verläufe stehen nicht mehr im Weg, Fotos haben einen Rahmen-Schalter, und ein neues Projekt beginnt mit einer Slide und der Layout-Wahl.

**Architecture:** Hintergrundfarbe, Korn und Verläufe werden optionale Felder von `Slide` (Lesezeit-Standard wie Ruling R8 aus 2a). Die Szene zeichnet sie pro Slide; der Export übernimmt sie, weil er die Inhaltsebene klont. Das Element «Fläche» (`src/plugins/elements/flaeche/`) entfällt ganz. Der Fotorahmen ist ein optionales Foto-Prop, gezeichnet im Foto-Knoten. Layout-Presets setzen die neuen Slide-Felder und das Rahmen-Prop statt Flächen-Elemente.

**Tech Stack:** wie Phase 2b.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt 8 «Entscheide Phase 2.1» (verbindlich), dazu Abschnitte 6 (Filmkorn), 7 (keine Startvorlage), 8 (Elemente, Brand Library). Werte: `docs/reference/psd-geometry.json` → `components.filmkorn`, `verlaufOben`, `verlaufUnten`, `fotoRahmen`, `layouts.collage`.

**Spielraum:** wie in 2a/2b. Ziele, Grenzen und Abnahmetests sind fest; wo kein Interface vorgegeben ist, wählt der Implementer die kleinste Lösung, die zu den bestehenden Registries passt, und begründet sie im Bericht.

## Global Constraints
- Alle Constraints aus Phase 1 bis 2b gelten (`docs/superpowers/workflow.md`, «Was immer geprüft wird»): kein Request nach aussen, Tokens nur in `src/tokens.ts`, kein Plugin-Import in Kern/Store/UI, Dateien < 400 Zeilen, Schweizer Deutsch ohne Halbgeviertstrich, ein Undo-Schritt pro Geste, kein Store-Schreiben pro Mausbewegung, Barrierefreiheit.
- Neue Slide-Felder und Foto-Props sind optional, der Standard gilt beim Lesen (2a Ruling R8). `e2e/fixtures/phase-1-2.bbzbsocial` und `e2e/compat.spec.ts` bleiben grün; das Phase-1.2-Golden bleibt byte-identisch.
- Projekte mit Flächen-Elementen gibt es nicht (Entscheid Alexej 22.10.2026): keine Migration, das Element «Fläche» wird gelöscht, nicht versteckt.
- Verläufe liegen über den Fotos ihrer Slide und unter allen anderen Elementen (Texte, Tags, Scribbles werden nie abgedunkelt). Werte aus `components.verlaufOben/Unten`, Farbe Blauschwarz (2a Ruling R3).
- Korn auf dem Slide-Hintergrund: 40 % Overlay, dieselbe Textur und Kalibrierung wie bisher (`filmkorn.opacityFlaeche`, `filmkorn.contrast`).
- Fotorahmen: Ränder aus der Collage der PSD (Rahmen 99/172, 882 × 1034; Foto 154/213, 772 × 924 → links 55, oben 41, rechts 55, unten 69), Farbe Warmweiss, Schatten aus `components.fotoRahmen.dropShadow` mit Blauschwarz statt `#002846` (Vier-Farben-Regel). Werte in `src/tokens.ts`.
- Bildschirm: Ziel 1536 × 864 CSS-px (Full HD, 125 %), Minimum 1280 × 720. Kein horizontales Scrollen der Seite und keines Panels.
- Jeder Weg, der ein Foto anlegt, setzt `grain`/`look` ausdrücklich (2a Ruling R10); neu auch `frame`, wo das Layout es verlangt.

## Review Focus
1. **Auswahl auf jedem Layout:** Auf jeder der 16 Vorlagen (Post und Story) lässt sich jeder Fotoplatzhalter, jedes Scribble, jeder Text und jeder Tag mit einem Klick auf seine sichtbare Mitte auswählen.
2. **Verlauf über Foto, unter Text:** Ein Titel auf einem Foto mit «Verlauf oben» bleibt im Export reines Warmweiss; das Foto darunter ist abgedunkelt.
3. **Rahmen und Ausschnitt:** Ein Foto mit Rahmen füllt seinen sichtbaren Bildbereich («cover»), Doppelklick-Ausschnitt und Spiegeln funktionieren mit Rahmen, der Rahmen dreht mit.
4. **Kleiner Bildschirm:** Bei 1280 × 720 und 1536 × 864 sind Kopfzeile, Bibliothek, Leinwand, Slide-Leiste und Inspector ganz sichtbar, ohne horizontales Scrollen, in beiden Modi und mit einem gewählten Foto (längster Inspector).
5. **Layout-Wechsel mit Slide-Eigenschaften:** Ein Layout setzt Hintergrund, Korn und Verläufe der Slide; ein Undo stellt Elemente und Slide-Eigenschaften zusammen wieder her (2b Review Focus 1).

---

### Task 0: Spezifikation nachführen und Fragen klären
- [x] Fragen mit Alexej geklärt (22.10.2026), Spezifikation Abschnitt 8 «Entscheide Phase 2.1» und Abschnitte 6, 7, 8 nachgeführt. Commit `7af466f`.

### Task 1: Slide-Hintergrund mit Korn und Verläufen

**Files:**
- Modify: `src/model/types.ts` (`Slide`), `src/model/parse.ts`, `src/canvas/Scene.tsx`, `src/ui/Inspector.tsx` (`SlidePanel`), `src/tokens.ts`
- Test: `src/model/parse.test.ts`, neues `e2e/slide-background.spec.ts`

**Interfaces:**
- Produces: `Slide.grain?: boolean`, `Slide.verlaufOben?: boolean`, `Slide.verlaufUnten?: boolean` (fehlt = aus). Task 3 setzt sie aus den Presets, Task 3 und `applyLayout` behandeln sie als Teil eines Undo-Schritts.

- [ ] Test: `parseProject` akzeptiert und behält die drei Felder, lehnt Nicht-Boolean ab; ein Projekt ohne die Felder öffnet unverändert.
- [ ] e2e (Test zuerst): im Slide-Panel (beide Modi) Schalter «Korn», «Verlauf oben», «Verlauf unten» (`aria-pressed`, ein Undo-Schritt je Klick). Export-Pixel: blauer Hintergrund mit Korn streut wie bisher die Fläche mit 40 %; «Verlauf oben» dunkelt den oberen Rand eines Fotos ab, ein Titel darüber bleibt reines Warmweiss (Review Focus 2); Verläufe enden bei den PSD-Stopps.
- [ ] Umsetzung: Hintergrund-Korn über die bestehende Effekt-Pipeline (gecachte Canvas pro Slide, nie pro Frame neu), Verläufe als nicht anklickbare Knoten (`listening: false`) in der Szene an der Stelle «über dem obersten Foto der Slide, unter allem anderen». Kein Knoten der Slide fängt Klicks.
- [ ] Gate, Screenshot des Slide-Panels in beiden Modi, Commit.

### Task 2: Fotorahmen als Eigenschaft

**Files:**
- Modify: `src/plugins/elements/photo/schema.ts`, `PhotoNode.tsx`, `PhotoInspector.tsx`, `fromFile.ts` (bzw. Füll-Pfad), `src/tokens.ts`
- Test: `src/plugins/elements/photo/photo.test.ts`, `src/tokens.test.ts`, neues `e2e/photo-frame.spec.ts`

**Interfaces:**
- Produces: Foto-Prop `frame?: boolean` (fehlt = aus), Tokens `photoFrame` (Ränder 55/41/55/69, Farbe, Schatten). Task 3 setzt `frame: true` in den Presets.

- [ ] Test: Tokens gleich PSD (Ränder aus den Collage-Bounds, Schatten-Werte aus `fotoRahmen`, Farbe Blauschwarz mit Begründung wie 2a R3).
- [ ] e2e (Test zuerst): Schalter «Rahmen» im Foto-Inspector (beide Modi), ein Undo-Schritt. Export-Pixel: Rahmen warmweiss in der Randbreite, Schatten ausserhalb, Foto füllt den Bildbereich ohne Lücke; gedreht dreht der Rahmen mit; Doppelklick-Ausschnitt und Spiegeln funktionieren mit Rahmen (Review Focus 3).
- [ ] Umsetzung: Der Implementer wählt, ob die Elementbox den Aussenrand (Foto eingerückt) oder den Bildbereich (Rahmen aussen) meint, und begründet es. Bedingung: Auswahlrahmen, Einrasten und «cover» beim Füllen eines Platzhalters passen zum sichtbaren Ergebnis; der Schatten liegt in der gecachten Effekt-Canvas oder ist nachweislich billig (Messung mit 4× CPU-Drosselung).
- [ ] Gate, Screenshot, Commit.

### Task 3: Element «Fläche» entfernen, Presets umstellen, Auswahl auf allen Layouts

**Files:**
- Delete: `src/plugins/elements/flaeche/`, `e2e/flaeche.spec.ts`
- Modify: `src/plugins/index.ts`, `src/plugins/layouts/presets/*.json` (16 Dateien), `src/plugins/layouts/index.ts` (Preset-Schema), `src/model/layout.ts` (`applyLayout`, `untouched`), `src/model/formatCopy.ts` (Flächen-Bleed entfällt), `src/ui/BrandLibrary.tsx`, `src/ui/libraryItem.ts`, `src/canvas/CanvasView.tsx` («Fläche hinzufügen»), `src/ui/LayoutPicker.tsx` (Vorschau), `src/testHook.ts`, betroffene Tests (`layout.test.ts`, `formatCopy.test.ts`, `layouts.test.ts`, `library.spec.ts`, `grain.spec.ts`, `grain-perf.spec.ts`, `snap.spec.ts`, `safezones.spec.ts`, `network.spec.ts`, `layout-choice.spec.ts`, `tokens.test.ts`)
- Test: neues `e2e/selection.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`Slide.grain/verlaufOben/verlaufUnten`), Task 2 (`frame`).
- Produces: Preset-Felder `grain?`, `verlaufOben?`, `verlaufUnten?` neben dem bestehenden `background`; `applyLayout` setzt sie im selben Rezept.

- [ ] Presets: Flächen-Elemente mit Rolle `hintergrund` werden `background` + `grain`, `verlauf` wird `verlaufOben`/`verlaufUnten`, `fotoRahmen` wird `frame: true` am Foto (Collage: Foto nimmt die Rahmenbox, Bildbereich wie bisher). Die Layout-Goldens werden neu erzeugt und mit den bisherigen Exporten verglichen: Abweichung nur dort, wo sie erklärt ist (2b Ruling R1).
- [ ] `applyLayout`: setzt die Slide-Felder aus dem Preset; ein Undo stellt Elemente und Slide-Felder zusammen her (Review Focus 5). R8 aus 2b (nur unveränderte Elemente ersetzen) bleibt.
- [ ] Entfernen: Elementtyp, «Fläche hinzufügen», Bibliotheks-Tabs «Hintergründe» und «Farben» (Bibliothek: Scribbles, Icons, Tags), Flächen-Zweig in `formatCopy`, Test-Hook-Einträge. Tests, die Flächen nur als Hilfsmittel nutzten, auf Slide-Hintergrund oder Foto umstellen und im Bericht nennen; kein Test wird abgeschwächt.
- [ ] e2e (Review Focus 1): für jede der 16 Vorlagen jedes Element mit Rolle (Platzhalter, Scribble, Text, Tag) per Klick auf seine sichtbare Mitte auswählen; Erwartung: genau dieses Element ist gewählt.
- [ ] Gate, Screenshots (Collage, Titel mit Verlauf), Commit.

### Task 4: Neues Projekt ohne Startvorlage

**Files:**
- Modify: `src/ui/StartPage.tsx`, `src/ui/layoutActions.ts` (`fillCarousel` entfällt), `src/ui/EditorPage.tsx` oder `SlideBar.tsx` (Layout-Wahl beim Start offen), Tests: `e2e/layout-choice.spec.ts`, `e2e/beginner-trial.spec.ts`, `e2e/fixtures.ts`, alle Specs, die die Startvorlage nutzen.

**Interfaces:**
- Consumes: bestehender Layout-Popover von «Slide hinzufügen» bzw. die Layout-Wahl im Slide-Panel.

- [ ] e2e (Test zuerst): «Neues Projekt» → Format wählen → Editor mit 1 Slide, die Layout-Wahl ist offen und hat den Fokus; eine Wahl wendet das Layout auf Slide 1 an (ein Undo-Schritt); Esc schliesst sie und lässt eine leere Slide.
- [ ] Startvorlagen-Auswahl auf der Startseite und `fillCarousel` entfernen. Tests, die das Carousel nutzten (Panorama-Teilung, Probelauf), bauen ihre Slides über die Layout-Wahl auf; im Bericht nennen.
- [ ] Gate, Screenshot Startseite und Editorstart, Commit.

### Task 5: Platz auf dem Laptop

**Files:**
- Modify: `src/ui/app.css`, ggf. `Header.tsx`, `Inspector.tsx`, `PhotoInspector.tsx`, `BrandLibrary.tsx`, `SlideBar.tsx`
- Test: neues `e2e/viewport.spec.ts`

- [ ] e2e (Test zuerst) bei 1536 × 864 und 1280 × 720, in beiden Modi, mit gewähltem Foto (längster Inspector) und ohne Auswahl: `document.documentElement.scrollWidth <= innerWidth`; für Kopfzeile, Bibliothek, Inspector, Ebenen-Panel und Slide-Leiste `scrollWidth <= clientWidth`; Kopfzeilen-Buttons, «Exportieren», Zoom-Leiste und «Slide hinzufügen» liegen ganz im Viewport. Der Test muss mit dem heutigen CSS scheitern (Befund Alexej: Inspector scrollt horizontal).
- [ ] Umsetzung mit `/impeccable` (adapt/layout): kleinste CSS-Änderung, die beide Grössen erfüllt (z. B. Spaltenbreiten mit `clamp()`, Felder und Regler mit `min-width: 0`, Inspector-Inhalte umbrechen statt überlaufen). Die Leinwand behält bei 1280 × 720 mindestens die heutige Höhe. Screenshots beider Grössen, beide Modi, ansehen und beschreiben.
- [ ] Gate, Commit.

### Task 6: Abschluss
- Netzwerk-Test um Slide-Hintergrund, Verläufe und Rahmen erweitern; `/impeccable critique` über Slide-Panel, Foto-Inspector und Editorstart.
- Spezifikation (Abschnitt «Umgesetzt in Phase 2.1») und `docs/roadmap.md` nachführen: 2.1 erledigt (Live-Test ausstehend), Live-Test-Liste 2.1, erledigte Backlog-Punkte entfernen (u. a. «Header unter 1280 px», «Verlauf fängt Klicks», Flächen-Punkte), neue Restpunkte eintragen.
