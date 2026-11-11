# Phase 2.5 «Feinschliff nach dem Windows-Test» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Rückmeldungen aus dem Windows-Test umsetzen: standortabhängige Akzentfarbe, Rahmen als Kontur, mehrere Verläufe, ein ruhigerer Regler und Eigenschaftenbereich, schwebende Meldungen, passendere Icons und Namen.

**Architecture:** Kleine UI-Korrekturen zuerst (Tasks 1 bis 6), dann die Bausteine mit Datenmodell: Regler (7), Verlauf (8, 9), Rahmen (10), Akzent (11, 12), Hinzufügen-Leiste (13), Eigenschaftenbereich (14). Neue Felder sind immer optional, damit ältere Projekte unverändert laden (Ruling R8). Farben und Masse stehen nur in `src/tokens.ts`.

**Tech Stack:** React 19, TypeScript strict, Konva/react-konva, zustand + immer, zod, `lucide-react` 1.61.0, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 2.5». Dazu `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md`, `docs/superpowers/workflow.md`.

## Global Constraints

- Kein Foto, Video oder Projektdatei verlässt den Browser; keine neuen Requests (Netzwerk-Test bleibt grün), keine Laufzeit-CDNs.
- Werte (Farben, Masse, Grenzen) nur in `src/tokens.ts`; Dateien unter 400 Zeilen; Kern importiert keine Plugins direkt (Architekturtest).
- UI-Texte Deutsch, Schweizer Rechtschreibung («ss», «…», Du-Form, kurz), keine Halbgeviertstriche (–).
- Icons: Lucide, Einzelimport, 18 px, `aria-hidden`; jeder Icon-Knopf `.icon-btn` mit `aria-label` und `data-tip`; Kürzel nur über `src/ui/keys.ts`.
- Neue Projektfelder optional und ohne `schemaVersion`-Wechsel; fehlt das Feld, sieht das Projekt aus wie vorher.
- Ein Undo-Schritt pro Geste; Ansicht (Zoom, Auswahl) nie in der History; kein Store-Schreiben oder React-Render pro Mausbewegung.
- Exporte: Farben nur aus der Palette (plus aufgelöster Akzent aus den vier Standortfarben), keine abgerundeten Flächen.
- Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test`, bei UI/Export zusätzlich `npm run test:e2e`. Tests nie abschwächen; angepasste Erwartungen im Bericht nennen.
- Branch `phase-2-5` von `main`. Commit-Nachrichten Englisch, enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- «Profi» bleibt im Code `mode === 'profi'`; nur Beschriftungen ändern sich.

## Review Focus

- Ein Projekt aus 2.4 (ohne `accentMode`, `scrims`, `frameOutside`) lädt, rendert und exportiert pixelgleich wie vorher (Fixture aus `e2e/fixtures`).
- Standortabhängiges Projekt ohne Schul-Tag, mit gelöschtem Schul-Tag oder mit zwei Schul-Tags mit verschiedenen Standorten: Akzent fällt auf `lastTagLocation`, sonst Orange; Undo/Redo stellt die Farbe mit zurück.
- Rahmen um ein Foto mit komplett transparenten Rändern, ein 1 × 1 px grosses Foto und ein 4096 px breites Foto: kein Absturz, Rechnung nur einmal je Bild und Grösse, Export wartet darauf.
- Heimbach (`#8ED8F8`): Schrift auf Tag und CTA bleibt lesbar (Kontrast mindestens 4.5:1), Scribbles in Akzent auf hellem Hintergrund bleiben sichtbar.
- Mehrere Verläufe zusammen mit Spiegeln, Ausschnitt-Bearbeiten und Layoutwechsel; fünfter Verlauf wird verweigert mit Hinweis, kein stiller Verlust.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `src/ui/Slider.tsx`, `src/ui/slider.css` (neu) | Ein Regler mit Zahlenfeld, Füllung, Rücksetzen |
| `src/ui/Section.tsx` (neu) | Abschnitt mit Überschrift und Linie im Eigenschaftenbereich |
| `src/ui/Notice.tsx`, `src/store/ui.ts` | Schwebende Meldung mit Zeitablauf |
| `src/model/accent.ts` (neu) | `accentFor(project, el)` und `locationOfSlide` |
| `src/tokens.ts` | `locationColors`, `onAccent`, `akzent`-Token, `photoFrame`, `scrim.sides`, Reglermasse |
| `src/plugins/effects/outline.ts` (neu) | Rahmenkontur als Canvas |
| `src/plugins/effects/scrim.ts` | Mehrere Verläufe, acht Richtungen |
| `src/ui/ScrimPicker.tsx` (neu) | Knopf «Verlauf hinzufügen», 3 × 3 Raster, Liste |
| `src/ui/AddBar.tsx` (neu) | Leiste «Hinzufügen» aus der Registry |
| `src/ui/ProPanel.tsx` | Nur noch Deckkraft und Akzent-Schalter wandern in `ProjectPanel` |
| `src/ui/AccentMode.tsx` (neu) | Schalter fix/standortabhängig |

---

### Task 1: Icons und Umbenennung «Erweiterte Optionen»

**Files:**
- Modify: `src/ui/Header.tsx`, `src/canvas/CanvasView.tsx` (Sicherheitszonen), `src/ui/Inspector.tsx`, `src/plugins/elements/photo/PhotoInspector.tsx`, `src/plugins/elements/brand/BrandInspector.tsx`
- Test: `e2e/header-icons.spec.ts`, `e2e/inspector-icons.spec.ts`, `e2e/icons-a11y.spec.ts`, `src/test/architecture.test.ts`

**Interfaces:**
- Produces: Schalter heisst sichtbar «Erweiterte Optionen» (bei Platzmangel «Erweitert», Tooltip dann voller Name); `aria-label`/Name enthält «Erweiterte Optionen»; Übersicht-Knopf behält `aria-label="Übersicht"`.

- [ ] **Step 1: Vorher-Screenshot** der Kopfzeile bei 1100, 1280 und 1536 px Breite (Einfach und erweitert) und des Spiegeln-Knopfs.
- [ ] **Step 2: Tests anpassen/ergänzen** in `header-icons.spec.ts`: Schalter `getByRole('switch', { name: /Erweiterte Optionen/ })` existiert; Übersicht-Icon ist `House`; Sicherheitszonen-Knopf zeigt `ShieldAlert`. In `inspector-icons.spec.ts`: Korn-Knopf mit `LayoutGridCircles`. Alle Tests, die `name: 'Profi'` suchen, auf den neuen Namen umstellen (`grep -rn "Profi" e2e src --include=*.ts`).
- [ ] **Step 3: Icons tauschen:** `ArrowLeft` → `House`; `SlidersHorizontal` → `Pickaxe` mit Text «Erweiterte Optionen»; Sicherheitszonen (`ScanLine`) → `ShieldAlert`; Korn (`Droplets`) → `LayoutGridCircles` in Inspector und PhotoInspector; Spiegeln (`FlipHorizontal2`) durch dasjenige Lucide-Icon ersetzen, das eine **senkrechte** Spiegelachse mit Dreiecken links und rechts zeigt. Beide Kandidaten (`FlipHorizontal`, `FlipHorizontal2`, `FlipVertical2`) in einem Wegwerf-Screenshot vergleichen und das richtige wählen, Wahl im Bericht nennen. Gilt für Foto und Brand-Inspector.
- [ ] **Step 4: Breite messen:** Kopfzeile bei 1100 px; passt «Erweiterte Optionen» nicht ohne Überlauf, Text «Erweitert» sichtbar, `aria-label` und `data-tip` bleiben «Erweiterte Optionen».
- [ ] **Step 5: Gate** (`typecheck`, `lint`, `test`, `npx playwright test e2e/header-icons.spec.ts e2e/inspector-icons.spec.ts e2e/icons-a11y.spec.ts`) → grün.
- [ ] **Step 6: Commit** `feat: icons and «Erweiterte Optionen» naming after Windows test`.

---

### Task 2: Korn im Einfach-Modus, kein Korn auf neuen Fotos

**Files:**
- Modify: `src/plugins/elements/photo/fromFile.ts:54,68`, `src/plugins/elements/photo/PhotoInspector.tsx`
- Test: `src/plugins/elements/photo/photo.test.ts`, `e2e/grain.spec.ts`, `e2e/look.spec.ts`

**Interfaces:**
- Produces: neue Fotos haben `grain: false`; der Korn-Knopf steht im Foto-Inspector in **beiden** Modi, vor den Bildreglern.

- [ ] **Step 1: Failing Unit-Test** in `photo.test.ts`: `photoElementFromFile`/`fillPhoto` (die Funktionen aus `fromFile.ts`) liefern `props.grain === false` und `props.look === true`.
- [ ] **Step 2: Failing e2e** in `grain.spec.ts`: im Einfach-Modus erscheint bei ausgewähltem Foto ein Knopf «Korn» mit `aria-pressed="false"` nach dem Einfügen; Klick setzt ihn auf `true`.
- [ ] **Step 3:** In `fromFile.ts` beide `grain: true` → `grain: false`. In `PhotoInspector.tsx` den Korn-Knopf aus dem `pro`-Block heben (Kommentar dazu anpassen).
- [ ] **Step 4:** Tests laufen lassen; bestehende Goldens und Tests, die automatisch Korn auf neuen Fotos erwarten, werden auf den neuen Standard angepasst und im Bericht gelistet (`grep -rn "grain" e2e`).
- [ ] **Step 5: Gate**, dann Commit `feat: grain toggle in simple mode, off by default for new photos`.

---

### Task 3: «Position und Grösse» entfernen, Ebenenname folgt dem Textstil

**Files:**
- Modify: `src/ui/ProPanel.tsx`, `src/plugins/elements/text/TextInspector.tsx`, `src/model/elements.ts` (Namenslogik)
- Test: `src/model/elements.test.ts`, `src/plugins/elements/text/text.test.ts`, `e2e/text-pro.spec.ts`, `e2e/editor-actions.spec.ts`

**Interfaces:**
- Produces: `renameForStyle(name: string, from: 'titel' | 'kommentar', to: 'titel' | 'kommentar'): string` in `src/model/elements.ts`: ist `name` der automatische Name (`Titel`/`Kommentar`, optional ` <Zahl>`, Gross/Klein wie `textStyles`-Label), ersetzt es den Stilnamen und behält die Zahl; sonst gibt es `name` unverändert zurück.

- [ ] **Step 1: Failing Tests** in `elements.test.ts`: `renameForStyle('Kommentar','kommentar','titel') === 'Titel'`; `('Kommentar 2', …) === 'Titel 2'`; `('Mein Titelblatt','kommentar','titel') === 'Mein Titelblatt'`; `('Titel','titel','kommentar') === 'Kommentar'`. Zuerst prüfen, welche Namen Layout-Presets und `insert` (`nextName`) tatsächlich vergeben (`grep -rn "Kommentar" src/plugins`), und die Tests auf diese Formen erweitern.
- [ ] **Step 2:** Run `npx vitest run src/model/elements.test.ts` → FAIL.
- [ ] **Step 3: Implement** `renameForStyle`; in `TextInspector.tsx` beim Stilwechsel im selben `apply` wie die Props auch `e.name` setzen (ein Undo-Schritt).
- [ ] **Step 4: e2e** in `text-pro.spec.ts`: Text mit Rolle `kommentar` auf Titel stellen → Ebenenname im Ebenen-Panel «Titel…»; vorher von Hand umbenannter Name bleibt.
- [ ] **Step 5:** In `ProPanel.tsx` die Gruppe «Position und Grösse», `FIELDS`, `setBox`, `heightIsDerived` und ungenutzte Importe entfernen; Deckkraft bleibt. Ist `NumberField` danach nur noch in Task 7 gebraucht, bleibt es. Tests, die diese Felder bedienen (`grep -rn "Position und Grösse\|Breite\|Drehung" e2e`), entfernen und im Bericht nennen.
- [ ] **Step 6: Gate**, Commit `feat: layer name follows text style, drop position panel`.

---

### Task 4: Slide-Leiste ohne Verschieben-Knöpfe

**Files:**
- Modify: `src/ui/SlideBar.tsx:150-180`
- Test: `e2e/slidebar-icons.spec.ts`, `e2e/slide-link.spec.ts`, `e2e/layout.spec.ts`

- [ ] **Step 1: Test:** in `slidebar-icons.spec.ts` darf es keinen Knopf mit Namen `/nach links|nach rechts/` mehr geben; Ziehen einer Kachel und Alt + ← / → verschieben weiterhin (bestehende Tests in `slide-link.spec.ts` bleiben grün).
- [ ] **Step 2:** Beide Knöpfe, `ChevronLeft/Right`-Importe und tote Handler entfernen; die Tooltips `moveTip` der Kacheln bleiben.
- [ ] **Step 3:** Prüfen, ob die Aktionszeile unter den Kacheln jetzt wieder in eine Zeile mit den Kacheln passt (1280 × 720); Screenshot im Bericht. Tests, die die entfernten Knöpfe bedienten, über Alt + Pfeil oder Ziehen führen (im Bericht nennen).
- [ ] **Step 4: Gate**, Commit `feat: remove slide move buttons, drag and Alt+arrows remain`.

---

### Task 5: Meldungen schweben

**Files:**
- Modify: `src/ui/Notice.tsx`, `src/ui/app.css` (Abschnitt «Meldungen»), `src/store/ui.ts`, `src/ui/EditorPage.tsx` / `src/ui/App.tsx` (wo `Notice` eingehängt ist)
- Test: `e2e/editor.spec.ts`, `e2e/viewport.spec.ts`; neu `e2e/notice.spec.ts`

**Interfaces:**
- Produces: `tokens.notice = { infoMs: 8000 }`; Meldung `position: fixed`, oben mittig, `z-index` über Dialogen unter dem Tooltip; sie verändert nie die Höhe des Dokuments.

- [ ] **Step 1: Failing e2e** `notice.spec.ts`: (a) Projekt konvertieren/kopieren löst eine Info aus; `document.documentElement.scrollHeight <= window.innerHeight` und das `.editor` ist unverändert hoch; (b) Info verschwindet nach `infoMs` (Zeit per `page.clock` vorspulen), Fehler (`kind: 'error'`) bleibt; (c) Maus über der Meldung hält sie offen; (d) `role="alert"` und Schliessen-Knopf bleiben.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement:** CSS `position: fixed; top: 0.75rem; left: 50%; transform: translateX(-50%); max-width: min(40rem, calc(100vw - 2rem))`, Schatten dünn, eckig. Zeitablauf in `Notice.tsx` mit `useEffect` und Timer, pausiert bei `:hover`/`:focus-within`; neue Meldung setzt den Timer zurück. Grid-Zeile im `.editor` für die Meldung entfällt (`grid-template-rows` bereinigen).
- [ ] **Step 4:** Fokusrahmen auf der dunklen Meldung bleibt Warmweiss (vorhandene Regel). Impeccable `audit` der Meldung bei 1280 × 720.
- [ ] **Step 5: Gate**, Commit `feat: floating notices with auto-dismiss for info`.

---

### Task 6: Leichtere UI-Schrift

**Files:**
- Modify: `src/ui/app.css` (alle `font-weight: 700`), `brand/fonts/README.md` (nur lesen)
- Test: `e2e/ui-accent.spec.ts`, Screenshot-Vergleich

- [ ] **Step 1: Lizenz lesen:** `brand/fonts/README.md` sagt, ob eine Light/Semilight-Datei erlaubt und vorhanden ist. Ist sie es nicht: **keine** neue Schriftdatei, im Bericht an Alexej melden und mit Regular/Bold weitermachen.
- [ ] **Step 2: Vorher-Screenshots** Editor und Startseite bei 1536 × 864 (Einfach, erweitert).
- [ ] **Step 3:** Fett bleibt nur für `h1`, `h2`, Exportieren, aktive Tabs/Kacheln. `button`, `.choice legend`, `.project-name`, Layoutnamen, Meldungen: 400 bzw. 500 nicht verfügbar → 400, Legenden stattdessen kleiner (0.8125rem) und `--muted`. Kontrast (4.5:1) prüfen.
- [ ] **Step 4:** Impeccable `critique` auf Vorher/Nachher; Nachher-Screenshots in den Bericht.
- [ ] **Step 5: Gate**, Commit `style: lighter UI type, bold only for headings and primary action`.

---

### Task 7: Regler-Komponente

**Files:**
- Create: `src/ui/slider.css`
- Modify: `src/ui/Slider.tsx`, `src/ui/NumberField.tsx`, `src/plugins/elements/text/TextInspector.tsx` (Grösse), `src/ui/ProPanel.tsx` (Deckkraft), `src/plugins/elements/photo/PhotoInspector.tsx`, `src/ui/app.css`
- Test: neu `src/ui/slider.test.ts`; `e2e/text-pro.spec.ts`, `e2e/look.spec.ts`, `e2e/photo-scrim.spec.ts`, neu `e2e/slider.spec.ts`

**Interfaces:**
- Produces: `Slider({ label, tip?, value, min, max, step?, defaultValue?, format?, unit?, disabled?, onChange })` und `fillPercent(value: number, min: number, max: number): number` (0 bis 100, begrenzt) exportiert aus `src/ui/Slider.tsx`. Das `<input type="range">` behält `aria-label={label}`; das Zahlenfeld rechts hat denselben Namen. Alle bisherigen Regler (Grösse, Zeilenabstand, Laufweite, Deckkraft, Bildregler, Reichweite) nutzen sie.

- [ ] **Step 1: Recherche (kurz, im Bericht):** wie Figma, Affinity, Photoshop-Web und Canva Regler zeichnen (Bahn, Füllung, Griff, Zahlenfeld, Rücksetzen). Nur Schlüsse, keine Kopie. *shortcut-frei:* das Ergebnis begründet die Masse in `tokens.slider`.
- [ ] **Step 2: Fehler reproduzieren:** Regler auf 100 % stellen, Screenshot ranzoomen; Abstand zwischen Griff-Rand und Bahnende messen und im Bericht festhalten.
- [ ] **Step 3: Failing Unit-Test** `slider.test.ts`: `fillPercent(0,0,100)===0`, `fillPercent(100,0,100)===100`, `fillPercent(-50,-50,50)===0`, `fillPercent(150,0,100)===100`, `fillPercent(5,5,5)===0` (min=max).
- [ ] **Step 4: Failing e2e** `slider.spec.ts`: bei Maximalwert liegt der rechte Rand des Griffs bündig am rechten Rand der Bahn (Pixelvergleich im Screenshot, Toleranz 1 px); Zahlenfeld und Regler zeigen denselben Wert; Doppelklick auf den Regler setzt `defaultValue` zurück (ein Undo-Schritt); Pfeiltasten, Pos1/Ende funktionieren; eine Ziehgeste = ein Undo-Schritt (bestehende Prüfung).
- [ ] **Step 5: Implement** `slider.css` (importiert aus `main.tsx`): `appearance: none`, Bahn 4 px mit `linear-gradient` aus `--fill` (Variable per `style`), Griff nach Messung aus Step 1 und Step 2 so bemessen, dass er bei 0 und 100 % bündig abschliesst; `:focus-visible` sichtbar; eckig, passend zu `DESIGN.md`; Windows-Kontrastmodus (`forced-colors`) mit Systemfarben. `useSliderGesture` bleibt unverändert die Quelle der Undo-Geste.
- [ ] **Step 6:** Alle bisherigen Regler auf `Slider` umstellen; `.size`-Layout in `app.css` entfernen. Masse (`thumb`, `track`) in `tokens.slider`, in CSS per Variable aus `main.tsx`.
- [ ] **Step 7: Gate**, Impeccable `polish` auf den Reglern, Commit `feat: single slider component with number field, reset and flush thumb`.

---

### Task 8: Mehrere Verläufe (Modell und Rendering)

**Files:**
- Modify: `src/plugins/elements/photo/schema.ts`, `src/plugins/effects/scrim.ts`, `src/plugins/elements/photo/PhotoNode.tsx` (Effektschritte), `src/plugins/elements/photo/index.tsx` (`takeContent`, `sameScrim`), `src/plugins/layouts/` (Presets lesen `scrim`), `src/tokens.ts`
- Test: `src/plugins/effects/scrim.test.ts`, `src/plugins/elements/photo/photo.test.ts`, `src/plugins/layouts/layouts.test.ts`, `e2e/photo-scrim.spec.ts`, `e2e/export.spec.ts` (Golden)

**Interfaces:**
- Produces:
  - `type ScrimSide = 'oben'|'unten'|'links'|'rechts'|'obenLinks'|'obenRechts'|'untenLinks'|'untenRechts'`; `Scrim = { side: ScrimSide; strength: 'leicht'|'mittel'|'stark'; reach?: number; light?: boolean }`.
  - `PhotoProps.scrims?: Scrim[]` (höchstens `scrim.max`, `tokens.scrim.max = 4`); `scrimsOf(p: PhotoProps): Scrim[]` liest `p.scrims ?? (p.scrim ? [p.scrim] : [])`. Das alte Feld `scrim` bleibt im Schema lesbar, wird nie mehr geschrieben.
  - `scrimSteps(p: PhotoProps): ScrimParams[]` (ersetzt `scrimStep`), `scrimLine(side: ScrimSide, w, h, reach)` mit Diagonale für Ecken: von der Ecke nach `[w·k, h·k]` bzw. gespiegelt.

- [ ] **Step 1: Failing Unit-Tests** `scrim.test.ts`: `scrimLine('obenLinks',200,100,50)` → `[0,0,100,50]`; `scrimLine('untenRechts',200,100,50)` → `[200,100,100,50]`; `scrimsOf` mit altem `scrim` liefert ein Element; `scrimSteps` bei `flipX` spiegelt `links`↔`rechts`, `obenLinks`↔`obenRechts`, `untenLinks`↔`untenRechts`; leere Liste → `[]`.
- [ ] **Step 2:** Run `npx vitest run src/plugins/effects/scrim.test.ts` → FAIL.
- [ ] **Step 3: Implement** Schema (`scrims` mit `.max(scrim.max)`), `scrimSteps`, Effekt unverändert pro Schritt (mehrere `scrim`-Schritte nacheinander in `useEffectCanvas`); `PhotoNode` übergibt alle Schritte.
- [ ] **Step 4: Rückwärtsverträglichkeit:** Test in `photo.test.ts`: ein Foto mit altem `scrim` rendert dieselben Schritte wie vorher; `takeContent` vergleicht und übernimmt Listen (`sameScrims`); Layout-Presets mit `scrim` laufen unverändert (`layouts.test.ts`).
- [ ] **Step 5: Golden** in `export.spec.ts`: Foto mit zwei Verläufen (dunkel oben links, hell unten rechts), Golden einmal erzeugen, ansehen und ablegen; bestehende Verlauf-Goldens bleiben pixelgleich.
- [ ] **Step 6: Gate**, Commit `feat: multiple scrims per photo with corner directions`.

---

### Task 9: Verlauf-Bedienung («Verlauf hinzufügen»)

**Files:**
- Create: `src/ui/ScrimPicker.tsx`
- Modify: `src/plugins/elements/photo/PhotoInspector.tsx`, `src/ui/app.css`, `src/ui/keys.ts` (kein neues Kürzel)
- Test: `e2e/photo-scrim.spec.ts`, `e2e/inspector-icons.spec.ts`, `e2e/icons-a11y.spec.ts`

**Interfaces:**
- Consumes: `Scrim`, `ScrimSide`, `scrimsOf` aus Task 8.
- Produces: `ScrimPicker({ scrims, onChange, advanced })`; Knopf «Verlauf hinzufügen» (Icon `Blend` o. Ä. aus Lucide, Icon + Text), öffnet ein Raster mit 8 Zielfeldern (Mitte leer, Icons `ArrowUpLeft`, `ArrowUp`, … als Richtungspfeile, jedes mit `aria-label` «Oben links» usw. und `data-tip`). Auswahl legt einen Verlauf `{ side, strength: 'mittel' }` an und schliesst das Raster. Bereits vergebene Richtungen sind `aria-disabled` mit Tooltip «Schon vorhanden». Liste der Verläufe: je Zeile Richtungs-Icon, Stärke (Leicht/Mittel/Stark), Schalter Dunkel/Hell, Löschen (`Trash2`, `icon-btn`). Im erweiterten Modus je Zeile ein Reichweite-`Slider`. Beim fünften Verlauf: Knopf `aria-disabled`, Tooltip «Höchstens vier Verläufe».

- [ ] **Step 1: Failing e2e** in `photo-scrim.spec.ts`: Knopf «Verlauf hinzufügen» → Feld «Oben links» wählen → Zeile erscheint; zweiten Verlauf «Unten rechts» mit «Hell» anlegen → Canvas-Pixel an beiden Ecken verändert sich (dunkler bzw. heller als ohne); Löschen einer Zeile entfernt nur diese; Tastatur: Raster per Pfeiltasten und Enter bedienbar, Esc schliesst und gibt den Fokus an den Knopf zurück; fünfter Verlauf nicht möglich; jede Änderung ein Undo-Schritt.
- [ ] **Step 2:** Run → FAIL. Alte Tests, die die Reihe «Aus/Oben/Unten/Links/Rechts» bedienen, werden auf den neuen Ablauf umgeschrieben (im Bericht nennen).
- [ ] **Step 3: Implement** `ScrimPicker` als Popover im Stil des «Slide hinzufügen»-Popovers (dasselbe CSS-Anker-Muster); Reihenfolge in der Liste = Reihenfolge der Anlage. «Aufhellen» (erweitert) entfällt, Hell/Dunkel wohnt in der Zeile.
- [ ] **Step 4:** Schreibweise: jede Änderung schreibt `scrims` (nie `scrim`) und löscht ein vorhandenes altes `scrim` im selben `apply`.
- [ ] **Step 5: Gate**, Impeccable `critique` des Popovers, Commit `feat: scrim picker with 3x3 grid and per-scrim controls`.

---

### Task 10: Rahmen als Kontur ausserhalb

**Files:**
- Create: `src/plugins/effects/outline.ts`, `src/plugins/effects/outline.test.ts`
- Modify: `src/plugins/elements/photo/schema.ts` (`frameOutside`, `imageArea`), `src/plugins/elements/photo/PhotoNode.tsx`, `src/plugins/elements/photo/PhotoInspector.tsx` (`toggleFrame`), `src/plugins/elements/photo/index.tsx` (`takeContent`), `src/plugins/layouts/presets/collage.json`, `collage-story.json`, `src/tokens.ts`
- Test: `src/plugins/elements/photo/photo.test.ts`, `src/plugins/layouts/layouts.test.ts`, `e2e/photo-frame.spec.ts`, `e2e/layout-presets.spec.ts`, Golden in `e2e/golden`

**Interfaces:**
- Produces:
  - `PhotoProps.frameOutside?: boolean`; `frameOf` unverändert. `imageArea(p, box)` liefert bei `frameOutside` die **ganze Box** (nichts eingerückt), sonst wie bisher die eingerückte Fläche (Altprojekte).
  - `hasTransparentEdge(data: ImageData): boolean` (Mittel der Alpha-Werte der vier Randpixelreihen unter 250/255).
  - `outlineCanvas(source: HTMLCanvasElement, width: number): HTMLCanvasElement`: Canvas mit `width` px Rand ringsum; Inhalt = Warmweiss-Silhouette von `source`, um `width` px erweitert: Rechteck, wenn `!hasTransparentEdge`, sonst runde Erweiterung (Alpha-Maske in 24 Winkelschritten zweifach versetzt gezeichnet, dann auf einfarbig gesetzt). Rechnung nur einmal je `(assetId, crop, flipX, Box, width)` (Schlüssel wie bei `useEffectCanvas`), nie pro Frame.
  - `tokens.photoFrame.inset` bleibt die Breite (24 px), Name bleibt, Kommentar nennt «Rahmenbreite».

- [ ] **Step 1: Failing Unit-Tests** `outline.test.ts` (jsdom/Canvas-Polyfill wie in `grain.test.ts`): opakes 10 × 10 Bild → Ausgabe 10 + 2·w breit, alle Pixel opak (Rechteck mit scharfen Ecken); Bild mit transparentem Kreis in der Mitte → Pixel im Abstand < w ausserhalb der Form sind gefüllt, im Abstand > w + 1 leer; 1 × 1 Bild und komplett transparentes Bild brechen nicht ab (Ergebnis leer bzw. Rechteck, keine Exception).
- [ ] **Step 2:** `photo.test.ts`: `imageArea({frame:true, frameOutside:true}, box)` ist die ganze Box; `imageArea({frame:true}, box)` bleibt eingerückt (Altprojekt); `toggleFrame` an einem Altprojekt-Foto mit `frame:true` schaltet aus (löscht `frame` und `frameOutside`), beim erneuten Einschalten entsteht `frameOutside:true`. `takeContent` übernimmt `frame` **und** `frameOutside` vom Platzhalter.
- [ ] **Step 3:** Run `npx vitest run src/plugins/effects/outline.test.ts src/plugins/elements/photo` → FAIL.
- [ ] **Step 4: Implement** `outline.ts` und `imageArea`; `PhotoNode`: bei `frameOutside` zeichnet ein `KImage` mit `outlineCanvas(...)` an `(-width, -width)` hinter dem Bild; Schatten (`photoFrame.shadow`) hängt am Rahmenbild, folgt also der Kontur. Auswahlrahmen und Transformer bleiben an der Box. Die Berechnung läuft über `useEffectCanvas`-ähnlichen Weg, damit der Export auf sie wartet (`EFFECT_PENDING_NODE`).
- [ ] **Step 5: Layouts umrechnen:** In `collage.json`/`collage-story.json` die Rahmen-Platzhalter: `frame: true` plus `frameOutside: true`, Box um 24 px je Seite verkleinert (x/y +24, Breite/Höhe −48; bei gedrehten Elementen um den Mittelpunkt, Rechnung im Test belegen). `layouts.test.ts` prüft: äussere Fläche (Box + 24 ringsum) ist gleich der alten Box. **Die bestehenden Layout-Goldens (Collage, Post und Story) müssen pixelgleich bleiben**; wenn nicht, ist der Schatten oder die Rechnung falsch, nicht das Golden.
- [ ] **Step 6: Golden neu** für einen Freisteller: transparentes PNG (Fixture, z. B. Kreis mit Aussparung) mit Rahmen, Export ansehen, ablegen. e2e `photo-frame.spec.ts`: Rahmen an → Export-Pixel ausserhalb der Box sind warmweiss (Rechteckfoto) bzw. folgen der Form (Freisteller); Rahmen ändert die Boxgrösse nicht; Undo ein Schritt; Altprojekt mit Rahmen (Fixture aus 2.4) exportiert unverändert.
- [ ] **Step 7: Leistung:** 4096-px-Foto mit Rahmen: Zeit der ersten Rechnung messen (Ziel unter 300 ms ohne Unterbrechung der Eingabe, mit 4× CPU-Drosselung unter 1.5 s) und im Bericht nennen; bei Überschreiten die Maske in halber Auflösung rechnen.
- [ ] **Step 8: Gate**, Commit `feat: photo frame as outside contour following transparency`.

---

### Task 11: Akzent-Token, Auflösung und Modell

**Files:**
- Create: `src/model/accent.ts`, `src/model/accent.test.ts`
- Modify: `src/tokens.ts`, `src/model/types.ts` (`Project.accentMode?`), `src/model/parse.ts`, `src/plugins/elements/text/schema.ts` (`colorTokenSchema`), `src/plugins/elements/brand/schema.ts`, `src/plugins/elements/brand/BrandNode.tsx`, `src/plugins/elements/brand/tint.ts`, `src/plugins/elements/tag/TagNode.tsx`, `src/plugins/elements/tag/insert.ts`, `src/plugins/elements/text/TextNode.tsx`, `src/ui/libraryItem.ts`, `src/projectFile/projectFile.ts`, `brand/manifest.json` (`defaultColor`), alle Treffer von `colors[` ausserhalb von Tests
- Test: `src/model/accent.test.ts`, `src/tokens.test.ts`, `src/plugins/elements/tag/tag.test.ts`, `src/plugins/elements/brand/brand.test.ts`, `src/model/parse.test.ts`, `src/projectFile/projectFile.test.ts`

**Interfaces:**
- Produces:
  - `tokens`: `locationColors: Record<Location, { fill: string; text: 'warmweiss' | 'blauschwarz' }>` mit Bahnhof `#008C7E`/warmweiss, Heimbach `#8ED8F8`/blauschwarz, Weggismatt `#FF4E00`/warmweiss, Dagmersellen `#D81E3A`/warmweiss; `export const akzent = 'akzent' as const`; `type PaletteColor = ColorToken | typeof akzent`; `onAccent(hex: string): 'warmweiss' | 'blauschwarz'` (wählt nach Kontrast).
  - `Project.accentMode?: 'fix' | 'standort'` (fehlt = `fix`).
  - `accentFor(project: Project, el: Pick<Element,'x'|'width'>): string` (Hex): Modus `fix` → `colors.orange`; sonst Standort der Slide des Elements (Slide-Index aus `x`, bei Panorama die erste Slide der Gruppe, `groupOf`), bestimmt aus dem ersten `tag`-Element der Variante `schul` auf dieser Slide (Ebenenreihenfolge unten → oben, `project.order`), sonst `project.lastTagLocation`, sonst Orange. Unbekannter Standort-Text → Orange.
  - `resolveColor(token: PaletteColor, accent: string): string`.
  - Alle Stellen, die `colors[x]` für Element-Farben nutzen, rufen `resolveColor(x, accentFor(...))`; der Compiler findet sie, weil `colorTokenSchema` und die Prop-Typen auf `PaletteColor` wechseln.

- [ ] **Step 1: Failing Unit-Tests** `accent.test.ts` (reine Funktionen): Modus fehlt → Orange; `standort` mit Schul-Tag «Heimbach» auf Slide 1 → `#8ED8F8`, Element auf Slide 2 ohne Tag, `lastTagLocation: 'Bahnhof'` → `#008C7E`; ohne Tag und ohne `lastTagLocation` → Orange; zwei Schul-Tags (Bahnhof unten, Heimbach oben) auf einer Slide → der erste in `order` (Bahnhof); Panorama-Paar → Standort der ersten Slide; Tag mit unbekanntem Text → Orange; Schul-Tag gelöscht → fällt auf `lastTagLocation` zurück. `onAccent('#8ED8F8') === 'blauschwarz'`, `onAccent('#FF4E00') === 'warmweiss'`, `onAccent('#008C7E') === 'warmweiss'`, alle vier erreichen Kontrast ≥ 4.5:1 (Rechnung im Test).
- [ ] **Step 2:** `tokens.test.ts`: die vier Standortfarben stehen nur in `tokens.ts`; `akzent` ist nicht in `colors` (kein Hexwert in der Palette).
- [ ] **Step 3:** Run `npx vitest run src/model/accent.test.ts src/tokens.test.ts` → FAIL.
- [ ] **Step 4: Implement** `accent.ts`, Tokens, Schema (`accentMode` optional, `parse.ts` und `projectFile.ts` lesen/schreiben es unverändert durch). Typfehler abarbeiten: `BrandNode`/`tint.ts` färben mit aufgelöstem Hex; `thumbnail()` der Bibliothek bekommt `'akzent'` und zeigt Orange.
- [ ] **Step 5: Neue Elemente setzen «Akzent»:** `tagBox.schul.fill`, `tagBox.cta.fill`, `tagBox.ort.iconColor` → `akzent`; `BrandAsset.defaultColor` für Scribbles/Icons → `akzent` (`manifest.json` und `src/brand/manifest.ts`-Schema anpassen, Manifest-Test). Tag-Schrift: `onAccent(fill)` statt fest Warmweiss. Bestehende Elemente behalten `orange` (kein Migrationslauf).
- [ ] **Step 6: Rückwärtstest:** `parse.test.ts`/`projectFile.test.ts`: Projekt ohne `accentMode` mit Elementfarbe `orange` lädt unverändert; Export-Golden eines Altprojekts bleibt pixelgleich; Neues Projekt im Modus `fix` sieht mit `akzent` identisch aus wie mit `orange` (Golden-Vergleich Scribble und Tags).
- [ ] **Step 7: Gate** (alle Goldens grün), Commit `feat: akzent colour token with location-based resolution`.

---

### Task 12: Akzent-Bedienung (Schalter, Kachel, Standortwechsel)

**Files:**
- Create: `src/ui/AccentMode.tsx`
- Modify: `src/ui/Swatches.tsx`, `src/plugins/elements/tag/TagInspector.tsx`, `src/ui/Inspector.tsx` (SlidePanel, erweitert), `src/ui/Header.tsx` oder erweiterter Bereich
- Test: `e2e/tag.spec.ts`, `e2e/ui-accent.spec.ts`, neu `e2e/location-accent.spec.ts`, `e2e/export.spec.ts` (Golden Heimbach)

**Interfaces:**
- Consumes: `accentFor`, `resolveColor`, `Project.accentMode`.
- Produces: im erweiterten Modus (SlidePanel, ohne Auswahl) ein Abschnitt «Akzentfarbe» mit Radiogruppe «Fixe Akzentfarbe» / «Standortabhängig» (`AccentMode`, ein `apply`); `Swatches` bekommt optional `accent?: string` und zeigt nur dann eine Kachel «Akzent» (Tooltip «Akzent», Füllung = aufgelöste Farbe), wenn das Projekt standortabhängig ist.

- [ ] **Step 1: Failing e2e** `location-accent.spec.ts`: (a) Neues Projekt: Schalter steht auf «Fixe Akzentfarbe», Schul-Tag orange. (b) Auf «Standortabhängig» → Schul-Tag «Bahnhof» wird `#008C7E` (Pixel auf dem Canvas), Scribble und CTA mit `akzent` folgen. (c) Standort im Schul-Tag auf «Heimbach» → alles auf der Slide wechselt zu `#8ED8F8`, Tag-Schrift blauschwarz; eine zweite Slide ohne Tag nimmt `lastTagLocation`. (d) Scribble von Hand auf Blau gestellt → bleibt Blau beim Wechsel. (e) Undo nach Standortwechsel stellt Tag und Elemente in einem Schritt zurück. (f) Zurück auf «Fix» → alles Orange. (g) Im Einfach-Modus ist der Schalter nicht sichtbar, ein standortabhängiges Projekt wirkt trotzdem.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `AccentMode`, Kachel in `Swatches` (Text-, Brand-Inspector reichen `accent` durch `accentFor`), Standortwahl im `TagInspector` setzt weiter `lastTagLocation`. Standardwahl für neue Elemente aus Task 11 bleibt `akzent`.
- [ ] **Step 4: Golden** (Export): Slide mit Heimbach-Tag, CTA und Scribble im Modus `standort`, Export ansehen (Lesbarkeit der Schrift auf hellem Blau) und ablegen.
- [ ] **Step 5:** Spezifikation und `DESIGN.md` kurz nachführen (Akzent der Slides vs. Akzent der App).
- [ ] **Step 6: Gate**, Commit `feat: project accent mode with location colours`.

---

### Task 13: Leiste «Hinzufügen»

**Files:**
- Create: `src/ui/AddBar.tsx`
- Modify: `src/canvas/CanvasView.tsx:225-240`, `src/ui/BrandLibrary.tsx`, `src/ui/app.css`
- Test: `e2e/insert.spec.ts`, `e2e/library.spec.ts`, `e2e/icons-a11y.spec.ts`

**Interfaces:**
- Produces: `AddBar()` rendert für jeden `ElementType` mit `add` einen Knopf mit Icon über Text (gleiche Kachelform und Raster wie `.library-tabs`), in der Bibliothek-Spalte über den Tabs; die Knöpfe heissen unverändert «Foto hinzufügen» und «Text hinzufügen». Die Knöpfe verschwinden aus `CanvasView`.

- [ ] **Step 1: Vorher-Screenshot** der heutigen Anordnung. Impeccable `shape` zur Platzierung; steht die Leiste in der Bibliothek-Spalte schlecht (z. B. zu wenig Platz bei 1280 × 720), zwei Varianten als Screenshots Alexej vorlegen, nicht raten.
- [ ] **Step 2: Test:** `insert.spec.ts` bedient die Knöpfe weiter über `getByRole('button', { name: 'Foto hinzufügen' })`; neu: sie liegen in der Bibliothek-Spalte (`aside[aria-label="Bibliothek"]`), nicht mehr über der Leinwand; Tab-Reihenfolge Leiste → Tabs → Inhalt.
- [ ] **Step 3: Implement** `AddBar` aus `elementTypes.all()`; CSS teilt die Kachelstile mit `.library-tabs`.
- [ ] **Step 4: Gate**, Impeccable `critique`, Commit `feat: add bar in library column`.

---

### Task 14: Eigenschaftenbereich wie Figma gliedern

**Files:**
- Create: `src/ui/Section.tsx`
- Modify: `src/ui/Inspector.tsx`, `src/plugins/elements/photo/PhotoInspector.tsx`, `src/plugins/elements/text/TextInspector.tsx`, `src/plugins/elements/tag/TagInspector.tsx`, `src/plugins/elements/brand/BrandInspector.tsx`, `src/ui/ProPanel.tsx`, `src/ui/Choice.tsx`, `src/ui/Swatches.tsx`, `src/ui/app.css`
- Test: `e2e/inspector-icons.spec.ts`, `e2e/icons-a11y.spec.ts`, neu `e2e/inspector-layout.spec.ts`

**Interfaces:**
- Produces: `Section({ title, children })` (`<section aria-labelledby>` mit kleiner Überschrift und Linie darüber). Reihenfolge je Elementtyp: **Ebene** (Name als `h2`, Duplizieren, Nach vorne/hinten, Löschen), **Darstellung** (Deckkraft, Farbe, Stil, Ausrichtung), **Bild** (Ausschnitt, BBZB-Look, Spiegeln, Bildregler), **Effekte** (Rahmen, Korn, Verläufe); leere Abschnitte erscheinen nicht. Zeilen: Beschriftung links, Wert rechts, gleiche Zeilenhöhe und Abstände aus Tokens/CSS-Variablen; alle Zahlenfelder und Regler fluchten.

- [ ] **Step 1: Vorher-Screenshots** aller Elementtypen (Foto, Text, Tag, Scribble, Slide) in Einfach und erweitert bei 1536 × 864 und 1280 × 720.
- [ ] **Step 2: Test:** `inspector-layout.spec.ts`: je Elementtyp existieren die erwarteten `section`-Überschriften in der oben genannten Reihenfolge; 1280 × 720 ohne vertikalen Scroll des Bereichs für Text und Tag, mit Scroll nur im Inspector selbst (nicht der Seite); alle bisherigen Knopfnamen bleiben (keine Umbenennung).
- [ ] **Step 3: Implement** `Section`, Inspectoren umbauen (nur Struktur, keine neue Funktion); Gestaltung mit Impeccable `shape` und `polish`: eckig, dünne Linien, Beschriftungen `--muted`, kein Kasten um Gruppen.
- [ ] **Step 4:** Nachher-Screenshots; Vorher/Nachher in den Bericht. Impeccable `critique` und `audit` (Kontrast, Fokus, Tastatur).
- [ ] **Step 5: Gate**, Commit `feat: sectioned inspector in Figma style`.

---

### Task 15: Abschluss

**Files:**
- Modify: `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (neuer Abschnitt «Umgesetzt in Phase 2.5»), `docs/roadmap.md` (Zeile 2.5, Backlog), `docs/windows-checkliste.md` (Abschnitt Phase 2.5), `docs/superpowers/naechste-session.md`, `DESIGN.md`

- [ ] **Step 1:** Gesamt-Review des Branches mit dem stärksten Modell; Fix-Runde; Re-Review.
- [ ] **Step 2:** Volles Gate; Netzwerk-Test, Architekturtest und alle Goldens grün. Screenshots Editor und Startseite, Exporte (Collage, Freisteller-Rahmen, zwei Verläufe, Heimbach) öffnen und mit `docs/reference/layouts/` vergleichen.
- [ ] **Step 3:** Dokumente nachführen: was umgesetzt wurde, was von der Spezifikation abweicht (Rulings), neue Handtests für Windows (Regler bei 125 % Skalierung, schwebende Meldung, Rahmen um echtes Freisteller-PNG, Standortfarben im Export), Backlog-Punkte (Light-Schrift, falls Lizenz fehlt).
- [ ] **Step 4:** Nach Merge in `main` und kurzer Rückfrage `npm run deploy`, Live-Bundle prüfen.
- [ ] **Step 5: Commit** `docs: phase 2.5 implemented, checklist and roadmap`.
