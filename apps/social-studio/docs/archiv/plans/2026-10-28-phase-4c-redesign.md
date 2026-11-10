# Phase 4c Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Ablauf, Gate und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Die Editor-Oberfläche nach dem Pen-Entwurf `docs/design/editor.pen` umbauen: neuer Look, Ebenen links, einklappbare Abschnitte, ohne Erweiterten Modus.

**Architecture:** Reine UI-Phase, Dokumentmodell und Export bleiben (Ausnahme: vertikales Spiegeln). Die Variablen des Entwurfs werden Oberflächen-Tokens in der Token-Datei, die CSS-Dateien lesen nur `var(--…)`. Die Bauteile des Entwurfs (Taste, Symbol-Taste, Umschalter, Schalter, Fader, Fader Mitte, Drehregler, Bereichsregler, Abschnitt) werden einmal gebaut und dann in Rahmen und Inspector eingesetzt.

**Tech Stack:** React 19, CSS (nur Transform und Opazität animiert), zustand, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (Abschnitt 8 «Bedienung der Oberfläche», 12). Zielbild: `docs/design/README.md`, `docs/design/editor.pen` (nur über Pencil lesen), `docs/design/export/*.png` (Ansicht, bei Widerspruch gilt der Entwurf). Kritik: `.impeccable/critique/2026-10-28T11-44-32Z__docs-design-editor-pen.md`.

## Global Constraints
- Werte (Farben, Schriften, Abstände) nur als Oberflächen-Tokens, gelesen aus den Variablen des Entwurfs via `GetVariables()`. Nie in `.md` abschreiben, nie in CSS hart codieren. Das Stilprofil-PNG ist veraltet (Entwurf 1); massgebend sind die Variablen.
- Exporte bleiben unverändert (Golden-Tests grün). Die Oberflächen-Tokens sind nie Slide-Farben.
- Keine abgerundeten Flächen. Schatten nur als harter Versatz an Ruhe-Tasten und Overlays (Kritik P2). Animiert wird nur `transform` und `opacity`, mit `prefers-reduced-motion` aus.
- UI-Texte Deutsch, Schweizer Rechtschreibung, Du-Form, Guillemets, keine Halbgeviertstriche.
- Kein Request nach aussen: neue Schriften lokal gebündelt (kein Google-Fonts-Link), CSP unverändert `connect-src 'self'`.
- Barrierefreiheit bleibt: `aria-disabled` mit Tooltip-Grund, Fokus sichtbar, jeder Icon-Knopf mit Namen, einklappbarer Inhalt nicht tabbar. Kontrast Text 4.5:1, Bedienelemente 3:1, per Vitest über alle Token-Paare.
- Platz: ohne Seitenscroll bedienbar von 1536 × 864 bis 1280 × 720, Inspector scrollt in sich.
- Dateien unter 400 Zeilen. Pro Task: Gate (typecheck, lint, test, test:e2e), eigenen Diff lesen, Screenshot in Edge gegen den Entwurf, dann committen.

## Entscheide vorab (Alexej, bevor 4c.3 beginnt)
Was bisher nur im Erweiterten Modus stand. Vorschlag in Klammern, nach Entwurf:
1. Deckkraft, Text-Feineinstellung (Zeilenabstand, Laufweite): immer sichtbar (Entwurf «Text»).
2. Sperren und Ausblenden: im Ebenen-Reiter (Entwurf), nicht mehr im Inspector.
3. Verlauf-Reichweite: als Regler unter «Stärke» im aufgeklappten Verlauf-Eintrag.
4. Bildregler: unter «Erweitert» im Abschnitt «Bild» (Entwurf).
5. Hilfslinien bearbeiten und freie Elemente: Code prüfen, was heute dahintersteht. Freie Elemente immer in der Bibliothek, Hilfslinien streichen, falls niemand sie braucht.
6. Position und Grösse: entfallen (Entwurf). Pfeiltasten und Ziehen bleiben.
7. Gespeicherter Modus im Browser (`profi`) wird beim Start verworfen, kein Datenverlust, weil Modus nie im Projekt steht.

## Review Focus
- Altes Projekt mit gesperrtem, ausgeblendetem, halbtransparentem Element und Bildreglern: lädt ohne Profi-Modus, Werte bleiben, Ebenen-Reiter und Inspector zeigen sie (Task 8, 11).
- Alle Abschnitte zu und per Tastatur bedient: Fokus landet nie in verborgenem Inhalt, Zustand bleibt beim Wechsel der Auswahl (Task 3).
- Schrift der Oberfläche lädt nicht: App bleibt bedienbar mit Ersatzschrift, blockiert den Export nicht (Task 2).
- 1280 × 720 und 125 % Skalierung: Fach links mit Tabs, Slide-Leiste mit Zoomgruppe, aufgeklappter Inspector ohne horizontalen Scroll, Leinwand nie verdeckt (Task 9, 10).
- Unterlage hat dieselbe Farbe wie die Slide: Slide bleibt erkennbar, Export unverändert (Task 9).

---

## Teil 4c.0: Entwurf schliessen (vor dem Bauen, mit Pencil)
Alexej arbeitet im Entwurf, der Agent ergänzt Fehlendes im selben Stil (Variablen und Bauteile des Entwurfs, keine neuen Werte). Zeigt jeden Stand vor dem Bauen, exportiert danach PNGs nach `docs/design/export/` und führt `README.md` nach.

### Task 1: Lücken im Entwurf
**Files:** `docs/design/editor.pen` (nur Pencil), `docs/design/export/*`, `docs/design/README.md`
- [ ] Kritik-P1 im Entwurf klären: Lesbarkeit der Beschriftungen (Serif klein, grau, Deckkraft), eine Regel je Farbe (Gewählt, Aktiv, Aktion, Auswahl), Kontrast Unterlage und Export-Taste. Entscheid mit Alexej, Variablen nachführen.
- [ ] Ort der Unterlage klären (README sagt Kopf, Entwurf zeigt sie in der Slide-Leiste) und im Entwurf festziehen.
- [ ] Neu entwerfen, wo die Struktur neu ist: Zustand «KI läuft» im Abschnitt Maske (Statuszeile, «Abbrechen» statt «Hintergrund entfernen», gesperrte Knöpfe mit Grund), «Als Sticker kopieren», «Motiv vor Titel», Startseite, Export-Dialog, Popover «Slide hinzufügen», Ausschnitt-Modus, leerer Inspector, Mehrfachauswahl, «Bitte prüfen».
- [ ] Ohne eigenen Entwurf, direkt nach den Bauteilen gebaut: Einstellungen, Lizenzen, Meldungen, Bibliothek-Tabs ausser Tags, Rahmen-Einstellungen, Text-Bearbeiten. Fokusring und Gesperrt-Zustand als Regeln in den Bauteilen festhalten.
- Prüfung: Alexej bestätigt die Artboards, PNGs sind neu exportiert.

## Teil 4c.1: Fundament
### Task 2: Tokens und Schriften
**Files:** Create `src/ui/theme.ts` (liest nichts zur Laufzeit aus dem Pen, enthält die übernommenen Werte), `public/fonts/` (Webfonts der Entwurfsschriften), `public/licenses/<schrift>-OFL.txt`; Modify `src/tokens.ts` (nur falls Tokens dort bleiben sollen, sonst Verweis), `src/fonts.ts`, `src/ui/LicensesDialog.tsx`, `src/ui/app.css`, `src/main.tsx`, `DESIGN.md` bleibt bis Task 14
- **Interfaces:** Produces `applyTheme(root: HTMLElement): void` setzt alle `--…`-Variablen aus `theme`; `uiFonts` (Liste mit Familie, URL, Label) wird mit `document.fonts.load` vor dem ersten Render geladen. Alte `uiAccent` fällt weg oder wird `theme.accent`.
- [ ] Test (Vitest): jedes Text-auf-Fläche-Paar der Tokens erreicht den Mindestkontrast; `uiAccent` bleibt nie in `colors`; jede `--var` im CSS existiert in `theme`.
- [ ] Test (Vitest `fonts`): fehlt eine UI-Schrift, steht sie nicht in `fontsMissingText` (Export wird nicht blockiert); Export-Schriften (Segoe, Braveold) bleiben blockierend.
- [ ] Lizenz und Webfont-Dateien der Entwurfsschriften prüfen (Quelle, OFL), Dateien lokal ablegen, im Lizenzen-Dialog und unter `public/licenses/` aufnehmen. Ist die Lizenz unklar: stoppen und Alexej fragen.
- [ ] Alte Farbwerte in `app.css`, `inspector.css`, `slider.css` auf `var(--…)` umstellen (Suche nach `#`-Werten, Ziel: keine ausser in `theme.ts`). Alle Seiten bleiben lauffähig im neuen Look.
- Prüfung: `e2e/network.spec.ts` grün, Screenshot Startseite und Editor in Edge.

### Task 3: Grundbauteile
**Files:** Create `src/ui/kit/Button.tsx`, `kit/Switch.tsx`, `kit/Segmented.tsx` (ersetzt `Choice.tsx`), `kit/Collapsible.tsx`, `kit/kit.css`; Modify `src/ui/Section.tsx` (einklappbar), `src/ui/Swatches.tsx` (Akzent, Abstand, Markenfarben), `src/store/ui.ts` (`openSections: Record<string, boolean>`, nur Sitzung)
- **Interfaces:** `Section({ heading, id, nested?, actions?, children })` mit `aria-expanded`, Zustand in `openSections[id]` (Standard zu, bleibt beim Wechsel der Auswahl), zugeklappter Inhalt `hidden`. `Segmented`, `Switch` (`role="switch"`), `Button` (Varianten Ruhe, Primär, Symbol). Hover hebt ab, Gedrückt sitzt auf, nur über `transform`; der Schattenversatz ist ein Pseudo-Element.
- [ ] Tests (Vitest/RTL): Abschnitt startet zu, öffnet unabhängig, bleibt nach Remount offen; zugeklappter Inhalt nicht fokussierbar; Pfeil und Enter im Umschalter; `prefers-reduced-motion` entfernt Übergänge.
- [ ] e2e-Helfer `openSection(page, name)` in `e2e/fixtures.ts`, damit spätere Tasks Abschnitte öffnen, statt Tests zu schwächen.
- Prüfung: Screenshot jeder Variante gegen Artboard «Bauteile».

### Task 4: Regler
**Files:** Modify `src/ui/Slider.tsx`, `slider.css`, `sliderGesture.ts`, `NumberField.tsx`; Create `kit/Knob.tsx` (Drehregler nur für Korn), `kit/RangeSlider.tsx` (Start- und End-Klammer)
- **Interfaces:** `Slider` bekommt `variant: 'long' | 'short'` und `center?: { low: string; high: string }` (Nullstelle Mitte, Beschriftungen an beiden Enden); Zahlenfeld mit Einheit daneben. `Knob({ label, value, min, max, onChange })`, `RangeSlider({ start, end, min, max, onChange })` je `role="slider"`.
- [ ] Tests: Doppelklick auf Griff setzt Standard; Pfeile, Pos1, Ende; Knob per Tastatur und senkrechtem Ziehen; Bereich lässt Start nie über Ende; eine Geste = ein Undo-Schritt (Bestand `slider.test.ts` und `e2e/slider.spec.ts` anpassen, nicht abschwächen).

## Teil 4c.2: Rahmen
### Task 5: Modus streichen
**Files:** Modify `src/store/ui.ts` (`mode`, `setMode` entfernen, gespeicherten Wert verwerfen), `src/ui/Header.tsx`, `contextMenuItems.ts`, `Inspector.tsx`, `EditorPage.tsx`, `ScrimPicker.tsx` (`advanced` entfällt), Elementinspectors; Delete `src/ui/PositionSection.tsx` samt Test, `e2e/inspector-position.spec.ts`; Modify Spezifikation Abschnitt 8, `PRODUCT.md`
- [ ] Zuerst Entscheide 1 bis 7 umsetzen: jede `pro`-Stelle wird «immer», «Ebenen-Reiter» oder gestrichen (siehe Entscheide). Roter Test zuerst: Profi-Elemente (Deckkraft, Sperren) sind ohne Moduswechsel erreichbar.
- [ ] Die rund 39 Dateien mit `profi` und «Erweiterte» anpassen (grep). Test-Anpassungen im Bericht nennen, Verhalten der Tests nicht abschwächen.
- Prüfung: grep nach `profi` und «Erweiterte Optionen» leer, ausser Archiv. Gate grün.

### Task 6: Kopfzeile
**Files:** Modify `src/ui/Header.tsx`, `app.css`, `brand/ui/` (Logo «Social Studio», Untertitel «BBZB»; neue Datei liegt schon unversioniert in `brand/ui/`)
- Kopf nach Entwurf: Logo, Übersicht, Projektname; rechts Rückgängig, Wiederholen, Sichern, Einstellungen, Exportieren. Zoom, Sicherheitsrand, Einpassen wandern in Task 9.
- [ ] Tests: `e2e/header-icons.spec.ts` und `icons-a11y.spec.ts` weiter grün (Namen, Tooltips); Logo trägt `alt`.

### Task 7: Fach links mit Reitern
**Files:** Create `src/ui/LeftPanel.tsx`; Modify `EditorPage.tsx`, `AddBar.tsx`, `BrandLibrary.tsx`, `LayersPanel.tsx`
- **Interfaces:** Reiter «Bibliothek» und «Ebenen» (`role="tablist"`, Pfeiltasten), Wechsel gleitend per `transform`/`opacity`. `AddBar` («Foto oder Video», «Text») bleibt über den Reitern.
- [ ] Test (e2e): Reiterwechsel, Auswahl in Ebenen wählt auf der Leinwand, ausgeblendet und gesperrt sichtbar mit Zustandsicon (Bestand `layers.spec.ts`). Ebenen sind nicht mehr nur im Profi-Modus da.

### Task 8: Ebenen-Reiter
**Files:** Modify `LayersPanel.tsx`, `layerOrder.ts` (nur falls nötig)
- Zeilen nach Entwurf (Auge, Schloss, aktive Zeile invertiert). Altes Projekt mit gesperrtem und ausgeblendetem Element: Test mit Fixture.

### Task 9: Slide-Leiste und Unterlage
**Files:** Modify `SlideBar.tsx`, `store/ui.ts` (`stageBackdrop`, nur Ansicht, in `localStorage` gemerkt, try/catch), `src/canvas/*` (Unterlage hinter der Slide); Create `src/ui/ViewTools.tsx`
- Zoom, Sicherheitsrand, Einpassen, Unterlage, dann «Slide hinzufügen», Duplizieren, Löschen. Die Wortknöpfe («Slide hinzufügen», «Löschen») zeigen das Wort weiterhin erst ab 1536 px.
- [ ] Tests: Leiste verdeckt die Leinwand nie bei 1280 × 720 (`viewport.spec.ts`); Unterlagefarbe erscheint nie im Export (Golden unverändert); Slide-Farbe gleich Unterlage bleibt erkennbar (Rand).

## Teil 4c.3: Inspector
### Task 10: Gerüst und Slide-Panel
**Files:** Modify `Inspector.tsx`, `inspector.css`, `LayoutSection.tsx`, `ScrimPicker.tsx`, `Swatches.tsx`
- Titel, «Ebene» immer zuoberst (Duplizieren, Nach vorne, Nach hinten, Löschen mit Wort), danach elementspezifisch. Slide-Panel: «Layout ändern», «Hintergrund» (Farben), «Effekte» mit «+», Korn mit Drehregler. Leerer Inspector und Mehrfachauswahl nach Entwurf aus Task 1. Effekt-Popover aus der `effects`-Registry (Name und Kurzhinweis je Effekt; fehlt ein Hinweis, im `Effect`-Typ ergänzen).
- [ ] Tests: Slide-Hintergrund und Effekte per e2e (Bestand `slide-background.spec.ts`, `slide-scrim.spec.ts`); jeder Effekt nur einmal ausser Verlauf (Limit wie bisher).

### Task 11: Foto und Video
**Files:** Modify `plugins/elements/photo/PhotoInspector.tsx` (unter 400 Zeilen, sonst aufteilen), `MaskSection.tsx`, `VideoSection.tsx`, `CutoutControls.tsx`; Modify Modell und Renderer für vertikales Spiegeln (`flipY` wie das vorhandene horizontale Spiegeln, Zod-Default false, Export und Canvas)
- [ ] Test zuerst (Vitest): vertikal gespiegeltes Foto exportiert gespiegelt (Pixelvergleich); altes Projekt ohne `flipY` lädt unverändert; Spiegeln ist ein Undo-Schritt.
- [ ] Abschnitte «Bild» (Ersetzen, Ausschnitt, BBZB-Look, Spiegeln H/V, «Erweitert» mit Bildreglern und Zurücksetzen, Nullstelle Mitte), «Maske» (zuerst «Hintergrund entfernen», dann «Maske bearbeiten», Pinselsteuerung erst nach dem Klick, Zustand «KI läuft», Sticker, Motiv vor Titel), «Effekte» (Verlauf mit Farbe und Stärke, Korn mit Drehregler, Rahmen), «Video» (Bereichsregler, Vorschau, Ton).
- [ ] Bestand bleibt grün: `mask-*.spec.ts`, `cutout.spec.ts`, `photo-*.spec.ts`, `video-editor.spec.ts`, `look.spec.ts`, `grain.spec.ts`.

### Task 12: Text, Tag, Brand
**Files:** Modify `TextInspector.tsx`, `TagInspector.tsx`, `BrandInspector.tsx`
- Text: Hinweis «Doppelklick…», Deckkraft, Farbe, Stil, Grösse, Zeilenabstand, Laufweite, Ausrichtung. Tag: Standort, Fachbereich zeigen als Schalter, Fachbereich; CTA mit Kanal. Brand: Farbe, Deckkraft.
- [ ] Tests: `text-pro.spec.ts` (Name ändern, Verhalten bleibt), `channel.spec.ts`, `location-accent.spec.ts`.

## Teil 4c.4: Menüs, Dialoge, Zustände
### Task 13: Menüs, Dialoge, Meldungen, Tooltips
**Files:** Modify `ContextMenu.tsx`, `Tooltip.tsx`, `Notice.tsx`, `ExportDialog.tsx`, `ExportQualityChoice.tsx`, `StartPage.tsx`, `SettingsDialog.tsx`, `LicensesDialog.tsx`, `LayoutPicker.tsx`, Ausschnitt-Modus
- Rechtsklickmenü mit Untermenü «Spiegeln» (jetzt H und V), Dialoge und Startseite nach den Artboards aus Task 1, Fokusring überall, Gesperrt über Farbwert statt Deckkraft.
- [ ] Tests: `contextmenu*.spec.ts`, `notice.spec.ts`, `export*.spec.ts`, `licenses.spec.ts` grün; neuer e2e: Tab-Durchlauf zeigt auf jedem Element einen sichtbaren Fokus (Computed Style).

### Task 14: Abschluss
**Files:** Modify `DESIGN.md` und `.impeccable/design.json` (neu mit `/impeccable document` aus dem gebauten Stand), Spezifikation Abschnitt 8 und 12, `docs/roadmap.md`, `docs/windows-checkliste.md` (Block «Phase 4c»: Schriften, 125 %, Edge-Fokus, Reduced Motion); Move Plan nach `docs/archiv/plans/`, Phasenlog nach `docs/archiv/`; Rewrite `docs/superpowers/naechste-session.md`
- [ ] `/impeccable critique` und `audit` gegen den Entwurf, Befunde Critical und Important beheben, Rest in die Roadmap.
- [ ] Gesamt-Review mit dem stärksten Modell, eine Fix-Runde, Re-Review. Gate. Screenshots aller Panels neben den Artboards.
- [ ] Merge nach `main`, vor Push und Deploy fragen.

## Ausführung
Branch `phase-4c`. Pro Teil ein Zwischenstand: nach 4c.1 und nach 4c.2 läuft die App vollständig im gemischten Look, damit `main` nach jedem Merge lauffähig bleibt. Implementer mittleres Modell für Task 2 bis 8 und 10 bis 13, stärkstes Modell für Task 9 (Leinwand) und 11 (Export). Jede Abweichung als `Ruling:` im Ledger.
