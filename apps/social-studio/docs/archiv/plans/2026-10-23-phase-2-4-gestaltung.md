# Phase 2.4 «Gestaltung der App» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ablauf und Regeln: `docs/superpowers/workflow.md`, Vorlagen in `docs/superpowers/sdd-templates/`.

**Goal:** Die ganze App-Oberfläche (Startseite, Kopfzeile, Bibliothek, Leinwand-Werkzeuge, Slide-Leiste, Inspector, Ebenen, Dialoge) wirkt wie ein Stück: Lucide-Icons, ein einheitlicher Tooltip mit Tastenkürzel, schlicht und eckig im BBZB-CI, ohne mit den Slides zu konkurrieren.

**Architecture:** Reine UI-Phase, Dokumentmodell, Export und Leinwand-Rendering bleiben unberührt (Ausnahme Task 8, nur Editor-Text). Icons kommen aus `lucide-react` (Einzelimporte, lokal gebündelt). Ein einziger globaler Tooltip (`src/ui/Tooltip.tsx`) reagiert per Event-Delegation auf `data-tip` und `data-keys` an beliebigen Elementen, es gibt keinen Wrapper pro Knopf. Eine Tabelle `src/ui/keys.ts` ist die einzige Quelle für Kürzel (Tooltips und Handler). Stil per CSS in `src/ui/app.css`, UI-Werte (Tooltip-Verzögerung) in `src/tokens.ts`.

**Tech Stack:** React 19, `lucide-react` (neu, ISC), Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt 8 «Entscheide Phase 2.4» (verbindlich).

**Spielraum:** Ziele, Grenzen und Abnahmetests sind fest. Wo kein Interface vorgegeben ist, wählt der Implementer die kleinste Lösung und begründet sie im Bericht. Wo die Spezifikation «mein Entscheid» sagt, wird gemessen und im Ledger als Ruling festgehalten.

## Global Constraints
- Alle Constraints aus Phase 1 bis 2.3 gelten (`workflow.md`, «Was immer geprüft wird»): kein Request nach aussen (Icons sind inline-SVG, kein CDN), Tokens nur in `src/tokens.ts`, kein Plugin-Import im Kern, Dateien < 400 Zeilen (`app.css` ist bei 314, bei 380 aufteilen, z. B. `tooltip.css`), Schweizer Deutsch ohne Halbgeviertstriche.
- **Zugängliche Namen bleiben:** Jeder Knopf, der Icon-only wird, behält seinen bisherigen sichtbaren Text als `aria-label`, damit Tests und Screenreader gleich bleiben (z. B. «Rückgängig», «Slide duplizieren», «Als Story kopieren»). Wo `getByRole('button', { name })` einen Text findet, der entfällt, wird der Test auf den Namen angepasst und im Bericht genannt, nie abgeschwächt.
- Icons: Lucide, Strichbreite 2, 18 px, `currentColor`, `aria-hidden`, keine Füllung. Grösse und Ausrichtung zentral per CSS (`.lucide`), nicht pro Stelle.
- Knopfhöhe 2.5 rem wie heute, Icon-Knöpfe quadratisch 2.5 rem. Zustände jedes Knopftyps: Normal, Hover, Fokus (`:focus-visible`, Akzent), Aktiv, Deaktiviert (`aria-disabled` wo der Fokus bleiben muss), gedrückt.
- Kein `title`-Attribut mehr in `src/ui`, `src/canvas`, `src/plugins` (ersetzt durch `data-tip`). Ausnahme: keine.
- Bewegung: höchstens 100 ms Einblenden des Tooltips, `prefers-reduced-motion` schaltet es ab.
- Kontrast: Text ≥ 4.5:1, Icons und Feldgrenzen ≥ 3:1. Akzent `uiAccent` nur für Primäraktion, Fokus, Auswahl.
- 1280 × 720 und 1536 × 864, Einfach und Profi: nichts scrollt waagrecht, alles Wichtige sichtbar (`e2e/viewport.spec.ts` bleibt grün).
- Netzwerk-Test bleibt grün.

## Review Focus
1. **Tastatur ohne Maus:** Jeder Icon-Knopf ist per Tab erreichbar, zeigt den Tooltip bei `:focus-visible`, Esc schliesst ihn und hebt die Auswahl trotzdem auf (der Tooltip verschluckt Esc nicht, Task 1).
2. **Tooltip am Rand:** Knöpfe ganz rechts in der Kopfzeile und ganz unten in der Slide-Leiste: Tooltip bleibt im Fenster und verdeckt den Knopf nicht. Knopf verschwindet unter der Maus (Klick auf «Löschen»): Tooltip verschwindet mit.
3. **Strg + S / Strg + E:** wirken nicht beim Tippen in Feldern und nicht bei offenem Dialog, lösen Edge nicht aus («Seite speichern»), Strg + E öffnet den Export-Dialog nur mit geladenen Schriften wie der Knopf.
4. **Deaktivierte Knöpfe:** Rückgängig/Wiederholen ohne Verlauf bleiben fokussierbar, tun nichts, ihr Tooltip nennt das Kürzel trotzdem.
5. **1280 px und 125 %/150 % Skalierung:** Kopfzeile mit Logo, Slide-Leiste mit Panorama-Paar und Popover «Slide hinzufügen» laufen nicht über und werden nicht abgeschnitten.

---

### Task 0: Spezifikation, Branch, Abhängigkeit
- [x] Fragen mit Alexej geklärt (23.10.2026), Spezifikation Abschnitt 8 «Entscheide Phase 2.4», Bestandsaufnahme mit Screenshots.
- [ ] Branch `phase-2-4` von `main` (liegt an, Spezifikation und Plan sind der erste Commit). `npm install --save-exact lucide-react` (aktuelle Version, im Ledger festhalten). Prüfen, dass der Bündel-Zuwachs klein bleibt (Einzelimporte), `npm run build` meldet die Grösse.
- [ ] Ledger und Workspace mit `scripts/sdd-workspace` anlegen.

### Task 1: Tastenkürzel-Tabelle und Tooltip
**Files:**
- Create: `src/ui/keys.ts`, `src/ui/Tooltip.tsx`, `src/ui/tooltipPosition.ts`
- Modify: `src/ui/App.tsx` (ein `<Tooltip />`), `src/ui/app.css`, `src/tokens.ts` (`tooltip: { delayMs: 400, graceMs: 800 }`), `src/ui/shortcuts.ts` (nutzt `keys.ts`)
- Test: `src/ui/keys.test.ts`, `src/ui/tooltipPosition.test.ts`, `e2e/tooltip.spec.ts`

**Interfaces:**
- Produces `keys.ts`: `export const KEYS = { undo: ['Strg','Z'], redo: ['Strg','Umschalt','Z'], duplicate: ['Strg','D'], remove: ['Entf'], zoomIn: ['Strg','+'], zoomOut: ['Strg','−'], zoomFit: ['Strg','0'], save: ['Strg','S'], export: ['Strg','E'], slideLeft: ['Alt','←'], slideRight: ['Alt','→'], deselect: ['Esc'], pan: ['Leertaste','ziehen'] } as const` und `export const keysAttr = (k: readonly string[]): string` (Teile mit «+» getrennt, z. B. «Strg+Z», für `data-keys`).
- Produces `tooltipPosition.ts`: `export function placeTooltip(anchor: DOMRect, tip: { width: number; height: number }, view: { width: number; height: number }): { x: number; y: number; side: 'below' | 'above' }`. Standard unten, 6 px Abstand; passt es unten nicht, oben; x so geklemmt, dass der Tooltip 4 px vom Fensterrand bleibt.
- Produces Konvention für alle Folge-Tasks: ein Element trägt `data-tip="Rückgängig"` und optional `data-keys="Strg+Z"`, optional `data-tip-text="längere Erklärung"` (zweite Zeile).
- `Tooltip.tsx`: eine Komponente, einmal in `App`. Ein Element im Top-Layer (`popover="manual"`, `role` nicht gesetzt, `aria-hidden`), das per `pointerover`/`pointerout`/`focusin`/`focusout` am `document` das nächste `[data-tip]` sucht. Verzögerung `tooltip.delayMs`; wurde in den letzten `tooltip.graceMs` einer offen, erscheint der nächste sofort. Schliesst bei `pointerdown`, `keydown` Esc (ohne `preventDefault`, damit Esc auch die Auswahl aufhebt, siehe Review Focus 1), `scroll` (capture), `blur`, und wenn der Anker aus dem DOM verschwindet. Fokus nur bei `:focus-visible` (`el.matches(':focus-visible')`). Taste je Teil als `<kbd>`.

- [ ] **Step 1: Failing tests**
  - `keys.test.ts`: `keysAttr(KEYS.undo)` ist `'Strg+Z'`; jede Taste in `KEYS` ist nicht leer; kein Kürzel doppelt belegt (Vergleich der `keysAttr`-Strings).
  - `tooltipPosition.test.ts`: Anker oben links → `below`, x ≥ 4; Anker unten am Fenster → `above`; Anker am rechten Rand → `x + width ≤ view.width − 4`.
  - `e2e/tooltip.spec.ts` (gegen einen Knopf mit `data-tip`, solange Task 2 noch fehlt: ein bestehender Knopf, dem der Test per `page.evaluate` das Attribut setzt): Maus darüber → nach 400 ms sichtbar (vorher nicht, `expect.poll`), enthält Text und `<kbd>Strg</kbd><kbd>Z</kbd>`; Mausverlassen schliesst; Tab-Fokus zeigt ihn, Mausklick-Fokus nicht; Esc schliesst ihn und hebt die Auswahl trotzdem auf; zweiter Knopf kurz nach dem ersten erscheint ohne 400 ms; Tooltip am rechten und unteren Rand liegt komplett im Fenster; er überdeckt den Knopf nicht (Rechtecke schneiden sich nicht).
- [ ] **Step 2:** Tests laufen lassen, sie scheitern.
- [ ] **Step 3: Implementieren** wie oben. Stil: Blauschwarz mit Warmweiss, eckig, 0.8125 rem, `<kbd>` als zusammenhängende dünn umrandete Taste, Kontrast ≥ 4.5:1, Maximalbreite 18 rem, `pointer-events: none`.
- [ ] **Step 4:** `shortcuts.ts` liest die Tasten nur zur Anzeige aus `KEYS` (die Handler selbst bleiben, kein Umbau der Logik); Unit-Test prüft, dass jedes Kürzel aus `KEYS` von `installShortcuts` erkannt wird, wo es einen Handler gibt (`save` und `export` folgen in Task 2).
- [ ] **Step 5:** Gate (`typecheck`, `lint`, `npm test`, e2e `tooltip.spec`), Commit.

### Task 2: Strg + S und Strg + E
**Files:** Modify `src/ui/shortcuts.ts`, `src/ui/Header.tsx` (Speichern als Funktion `saveProjectFile()` herausziehen, z. B. nach `src/ui/projectFileActions.ts`), `src/ui/ExportDialog.tsx`, `src/store/ui.ts` (z. B. `exportOpen`-Anforderung, nicht persistiert), Test `e2e/shortcuts-save-export.spec.ts`

**Interfaces:** Consumes `KEYS.save`, `KEYS.export`. Produces `saveProjectFile(): Promise<void>` (dieselbe Logik wie heute der Knopf, inkl. Fehlermeldung) und eine Möglichkeit, den Export-Dialog von aussen zu öffnen (kleinste Lösung, im Bericht).
- [ ] **Step 1: e2e-Tests:** Strg + S löst den Download `<Projektname>.bbzbsocial` aus (`page.waitForEvent('download')`), `defaultPrevented` ist true; Strg + E öffnet den Dialog «Exportieren»; beides wirkt nicht, wenn der Fokus im Projektnamen steht, und nicht bei offenem Dialog; Strg + E bei fehlenden Schriften öffnet den Dialog wie der Knopf (Export bleibt dort gesperrt).
- [ ] **Step 2:** scheitert. **Step 3:** implementieren; Handler in `installShortcuts`, `preventDefault` immer (Edge «Seite speichern»/«Suche»), auch beim Tippen wie bei Strg + D. **Step 4:** grün, Gate, Commit.

### Task 3: Kopfzeile und Leinwand-Werkzeuge
**Files:** Modify `src/ui/Header.tsx`, `src/canvas/CanvasView.tsx` (nur der Block `.canvas-tools`), `src/ui/ExportDialog.tsx` (Knopf), `src/ui/app.css`; Test `e2e/header-icons.spec.ts`, bestehende `viewport.spec.ts`, `channel.spec.ts`, `ui-accent.spec.ts` anpassen

**Interfaces:** Consumes `data-tip`/`data-keys`/`keysAttr`, `KEYS`. Produces eine kleine Hilfskomponente `IconButton` nur, wenn mindestens fünf Stellen dieselbe Props-Kombination brauchen (Icon, `label`, `keys?`, Rest an `<button>`), sonst Icons direkt. Entscheid im Bericht.
- [ ] **Step 1: e2e:** Jeder Knopf der Kopfzeile hat einen nicht leeren zugänglichen Namen (genau die alten: «Übersicht», «Rückgängig», «Wiederholen», «Projektdatei sichern», «Instagram», «LinkedIn»); die Kanal-Gruppe zeigt beim Hover ihren Erklärtext («Passt den Link-Hinweis auf der Abschluss-Slide an.») im Tooltip und hängt ihn weiter als `aria-describedby` an die Knöpfe; Rückgängig ist ohne Verlauf `aria-disabled` und fokussierbar, ein Klick tut nichts; Tooltip von «Rückgängig» zeigt `Strg Z`; das Logo ist bei 1280 px sichtbar und die Kopfzeile scrollt bei 1280 px nicht (sonst Grenze zurück auf 1400 px, Ruling).
- [ ] **Step 2:** scheitert. **Step 3: Umsetzen.** Kopfzeile: links Übersicht (`ArrowLeft`/`House`, nur Icon), Projektname, Kanal (Instagram, LinkedIn; Text bleibt, gedrückt-Stil wie heute); rechts Rückgängig (`Undo2`), Wiederholen (`Redo2`), dünne Trennlinie, Profi (`SlidersHorizontal` + Text, Schalter-Kästchen entfällt, Zustand per Hintergrund wie `aria-pressed`, `role="switch"` bleibt), Projektdatei sichern (`Save`, Tooltip `Strg S`), Exportieren (`Download` + Text, Primär, Tooltip `Strg E`). Werkzeugleiste: Foto hinzufügen (`ImagePlus` + Text) und Text hinzufügen (`Type` + Text) aus `t.add.label` (das Icon kommt aus `ElementType.add`, neues optionales Feld `icon` mit einem Lucide-Icon, das die Registry nur durchreicht, damit der Kern keine Plugins importiert; Entscheid im Bericht), Sicherheitszonen (`ScanLine`, nur Icon, `aria-pressed`, Tooltip mit dem bisherigen Titel «Zeigt, was Instagram überdeckt. Kommt nicht in den Export.» als `data-tip-text`), Zoom (`ZoomOut`, `ZoomIn`, Wert, `Maximize` für Einpassen, Tooltips `Strg −`, `Strg +`, `Strg 0`). Kopfzeile in Gruppen mit Abstand und Trennlinie, nicht mit Rahmen.
- [ ] **Step 4:** Tests grün, Gate, Screenshots 1536 × 864 und 1280 × 720 (Einfach und Profi) ansehen, Commit.

### Task 4: Slide-Leiste und Popover «Slide hinzufügen»
**Files:** Modify `src/ui/SlideBar.tsx`, `src/ui/LayoutPicker.tsx` (nur Gitter), `src/ui/app.css`; Test `e2e/slidebar-icons.spec.ts`, `slide-link.spec.ts`/`viewport.spec.ts` anpassen

- [ ] **Step 1: e2e:** Namen unverändert («Slide nach links», «Slides nach rechts» usw.); bei 1280 × 720 sind mit 6 Slides mindestens vier Kacheln vollständig sichtbar (`boundingBox` innerhalb der Liste) und ein Panorama-Paar ist komplett sichtbar, wenn es das aktuelle ist (`scrollIntoView` der ganzen Gruppe, nicht nur der Kachel); die Paar-Kacheln sind als Paar erkennbar (gemeinsame Klammer, Test auf `data-link`); «Löschen» zeigt Icon und Wort («Slide löschen», «2 Slides löschen»); Tooltips «Alt ←» / «Alt →»; Popover: «Leer» steht nicht mehr allein in einer Zeile (Gitter 4 Spalten, «Leer» bildet mit den anderen eine Reihe oder das Popover nutzt `auto-fill`), und der Umriss der aktuellen Hälfte überlappt die Nachbarkachel nicht (Backlog 2.2).
- [ ] **Step 2:** scheitert. **Step 3: Umsetzen.** Kachelleiste links, Aktionen rechts: `ChevronLeft`, `ChevronRight` (nur Icon), «Slide hinzufügen» (`Plus` + Text, Popover bleibt), Duplizieren (`Copy`, nur Icon), Löschen (`Trash2` + Wort). Bei Platzmangel (1280 px) bricht die Leiste die Aktionen unter die Kacheln, bevor sie Kacheln verdrängt (Entscheid per Messung, im Bericht). Reihenfolge, Drag, Alt + Pfeil und `aria-disabled` bleiben.
- [ ] **Step 4:** Gate, Screenshot bei 1280 px, Commit.

### Task 5: Inspector, Ebenen, Plugin-Inspectors
**Files:** Modify `src/ui/Inspector.tsx`, `src/ui/ProPanel.tsx`, `src/ui/LayersPanel.tsx`, `src/ui/Choice.tsx` (nur Tooltip-Durchreichung), `src/ui/LayoutPicker.tsx`, `src/plugins/elements/{photo,text,brand,tag}/*Inspector.tsx`, `src/ui/app.css`; Test `e2e/inspector-icons.spec.ts`, bestehende Specs anpassen (`editor-actions`, `layers`, `photo-frame`, `photo-scrim`, `text-pro`)

**Interfaces:** Produces `Choice` mit optionalem `tips?: Record<value, string>` oder `description?: string`, die als `data-tip` an Legende bzw. Option hängen (für «Reichweite»: «Wie weit der Verlauf ins Bild reicht.»).
- [ ] **Step 1: e2e:** Zugängliche Namen von Duplizieren, Nach vorne, Nach hinten, Spiegeln, Löschen, Sperren/Ausblenden unverändert; Löschen zeigt Icon + Wort; Aktionsreihe (Duplizieren, Nach vorne, Nach hinten) steht in einer Zeile; Schalter mit Zustand (BBZB-Look, Rahmen, Korn, Aufhellen, Spiegeln als Icon) bleiben `aria-pressed`; Sperren und Ausblenden gibt es im Profi-Modus nur einmal pro Element (Ebenen-Panel: `Eye`/`EyeOff`, `Lock`/`LockOpen`), nicht mehr im Inspector; Tooltip an «Reichweite»; Text-Inspector zeigt «Doppelklick auf der Leinwand bearbeitet den Text.»; Layout-Kacheln im Inspector haben keine Trennstriche in «Querformat», «Abschluss» (kein `hyphens`, kein Namensumbruch mitten im Wort bei 1280 und 1536 px, sonst 3 Spalten, Entscheid per Messung).
- [ ] **Step 2:** scheitert. **Step 3: Umsetzen.** Icons: Ausschnitt bearbeiten `Crop` + Text, BBZB-Look `Palette` + Text, Rahmen `Frame` + Text, Korn `Droplets` + Text (oder ein anderes vorhandenes Lucide-Icon, im Bericht), Spiegeln `FlipHorizontal2` (Icon), Duplizieren `Copy`, Nach vorne `BringToFront`, Nach hinten `SendToBack`, Löschen `Trash2` + Wort. Gleiche Icons in Slide-Leiste und Inspector für dieselbe Aktion. Segmentierte Auswahlen (Choice) bleiben Text, Stil an die Knöpfe angeglichen.
- [ ] **Step 4:** Gate, Screenshots (Foto, Text, Tag, Scribble gewählt; Einfach/Profi), Commit.

### Task 6: Bibliothek
**Files:** Modify `src/ui/BrandLibrary.tsx`, `src/ui/app.css`; Test `e2e/library.spec.ts`, `brand.spec.ts` anpassen

- [ ] **Step 1: e2e:** Die Tabs (Scribbles, Icons, Tags, Rolle `tab`, Namen unverändert) stehen in einer Zeile bei 1280 und 1536 px; Pfeiltasten, Pos1, Ende, Enter und Leertaste verhalten sich wie bisher; Kacheln zeigen den Namen als Tooltip statt `title`.
- [ ] **Step 2:** scheitert. **Step 3: Umsetzen.** Tab = Icon (`Brush`, `Shapes`, `Tag`) über 0.75-rem-Text, einzeilig; Kachelvorschauen unverändert, Hover und Fokus im Stil der Knöpfe. **Step 4:** Gate, Screenshot, Commit.

### Task 7: Startseite, Dialoge, Meldungen
**Files:** Modify `src/ui/StartPage.tsx`, `src/ui/ExportDialog.tsx`, `src/ui/Notice.tsx`, `src/ui/Header.tsx` (Esc im Projektnamen), `src/ui/app.css`; Test `e2e/start-page.spec.ts` (neu) und Anpassungen in `project.spec.ts`, `format-copy.spec.ts`, `layout-choice.spec.ts`, `beginner-trial.spec.ts`

- [ ] **Step 1: e2e:** Format-Knöpfe heissen «Post 4:5 anlegen» und «Story 9:16 anlegen» (bestehende Tests mit Teilnamen laufen weiter); während ein Projekt angelegt wird, sind «Projektdatei öffnen», die Format-Knöpfe und die Projektliste `aria-disabled` und tun nichts; Projektzeile: «Öffnen» (`FolderOpen` + Text) und Icon-Aktionen «Duplizieren», «Als Story kopieren», «Löschen» mit unveränderten zugänglichen Namen und Tooltip; die Zeile läuft bei 1280 px nicht über; der Löschen-Dialog fragt weiter nach; Esc im Projektnamen setzt den Entwurf zurück und nimmt den Fokus heraus, ein zweiter Esc hebt die Auswahl auf (Backlog Probelauf); Meldungsleiste: Schliessen als `X`-Icon mit Namen «Schliessen».
- [ ] **Step 2:** scheitert. **Step 3: Umsetzen** im Stil des Editors; Export-Dialog: Download-Icon am Primärknopf, «Schliessen» ohne Rahmenwechsel, Zeilen- und Segment-Stil an die Knöpfe angeglichen. **Step 4:** Gate, Screenshots Start leer/mit Projekten, Export-Dialog, Löschen-Dialog, Commit.

### Task 8: Platzhalter-Hinweis lesbar
**Files:** Modify die Stelle, die «Foto hierher ziehen» auf der Leinwand zeichnet (suchen: `grep -rn "Foto hierher ziehen" src`), Test `e2e/placeholder.spec.ts`

- [ ] **Step 1: Reproduzieren.** Test: Slide mit Hintergrund Blauschwarz und leerem Fotoplatzhalter (kein Verlauf): Farbe des Hinweises hat zur Platzhalterfläche mindestens 4.5:1 (Pixelprobe im Screenshot oder Prüfung der Text- gegen die Flächenfarbe aus den Tokens). Scheitert der Test nicht (Ursache seit 2.3 weg, Backlog), ist die Aufgabe erledigt: Test als Absicherung behalten, Backlog-Punkt streichen.
- [ ] **Step 2/3:** Scheitert er, Farbe aus den Tokens nach Kontrast zur Fläche wählen (Blauschwarz auf hellen, Warmweiss auf dunklen), nur im Editor, nie im Export (Export-Golden bleibt grün). Gate, Commit.

### Task 9: Impeccable-Durchgang und Abnahme
**Files:** alle geänderten UI-Dateien, `e2e/viewport.spec.ts`, `e2e/icons-a11y.spec.ts` (neu)

- [ ] **Step 1: Test `icons-a11y.spec.ts`:** Im Editor (Einfach, Profi, mit gewähltem Foto, Text, Tag) hat jeder `button` einen nicht leeren zugänglichen Namen; jeder Knopf ohne sichtbaren Text hat `data-tip`; im Quellcode steht kein `title=` mehr (Architekturtest in `src/architecture.test.ts` oder bestehender Ort); Icon-Grösse überall gleich (alle `svg.lucide` messen 18 px).
- [ ] **Step 2: Impeccable.** `/impeccable critique` und `audit` auf Startseite, Kopfzeile, Bibliothek, Slide-Leiste, Inspector, Dialoge (Screenshots 1536 × 864 und 1280 × 720, beide Modi, mit den Bildern von vorher verglichen); den Detektor einmal über die geänderten Dateien: `impeccable detect --json <Dateien>`. Befunde «Wichtig» beheben, `polish` für Abstände, Zustände und Fokus; Rest in `docs/roadmap.md`.
- [ ] **Step 3: Doku.** `impeccable init` (kurzes `PRODUCT.md` aus der Spezifikation: Nutzer:innen, Anti-Ziele, Ton) und `document` (`DESIGN.md` aus der fertigen Oberfläche); Spezifikation «Umgesetzt in Phase 2.4» mit Rulings; `docs/roadmap.md` (2.4 erledigt, Live-Test-Liste 2.4, Backlog bereinigt: Kanal-Erklärung, Reichweite, Layout-Kachelnamen, Doppelklick-Hinweis, doppelte Labels, Logo-Grenze, Slide-Leiste 1280, Startseite-Verben, Esc im Projektnamen, Startseite während Anlegen, Platzhalter-Hinweis); `docs/windows-checkliste.md` (Tooltips, Strg + S/E, Logo bei 1280 px auf echtem Gerät).
- [ ] **Step 4:** Gate komplett (`typecheck`, `lint`, `npm test`, `npm run test:e2e`), Commit.

### Abschluss (nicht Teil der Tasks)
Gesamt-Review des Branches mit dem stärksten Modell, eine Fix-Runde, Re-Review; selbst prüfen (Gate, Screenshots, Bundle-Grösse, Netzwerk-Test); direkt in `main` mergen; vor `npm run deploy` kurz bei Alexej nachfragen; Live-Bundle prüfen.
