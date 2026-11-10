# Phase 2.10 «Bedienung wie Figma» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mehrfachauswahl, Kopieren/Einfügen, Rechtsklickmenü, Position/Grösse im Inspector und eine einzeilige Slide-Leiste.

**Architecture:** Der UI-Store bekommt `selectedIds: string[]`. `selectedId` bleibt als abgeleitetes Feld («genau ein Element gewählt, sonst `null`»), damit Foto-Ausschnitt, Textbearbeitung und Einzel-Inspector unverändert bleiben. Nur Transformer, Leinwand-Klick, Ebenen-Panel, Kürzel und Inspector werden mehrfachfähig. Mehrfachaktionen sind je ein `apply` (ein Undo-Schritt).

**Tech Stack:** React 19, Konva 10 (`Transformer.nodes([...])`), zustand + zundo, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 2.10».

## Global Constraints
- Kein Request nach aussen, keine neue Abhängigkeit. Zwischenablage nur über DOM-Ereignisse `copy`/`cut`/`paste` (keine Berechtigungsabfrage).
- UI-Texte Deutsch, Schweizer Rechtschreibung, Du-Form, Guillemets «…», keine Halbgeviertstriche (–).
- Eckig, keine Schatten ausser Popover; Farben nur über CSS-Variablen und `src/tokens.ts`. Kein `title=`; jeder Icon-Knopf hat `aria-label` und `data-tip`.
- Dateien unter 400 Zeilen (`CanvasView.tsx` 292, `SelectionLayer.tsx` 166: neue Logik in neue Dateien).
- Ein Undo-Schritt pro Geste; Auswahl und Ansicht nie in der History; kein Store-Schreiben und kein React-Render pro Mausbewegung (Aufziehrahmen und Mehrfach-Ziehen imperativ in Konva).
- Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test`, bei UI `npm run test:e2e`. Branch `phase-2.10` von `main`.

## Review Focus
- Mehrfachauswahl nur unter den Elementen der aktuellen Slide (`elementsOnSlide`); Slidewechsel und Undo, das ein Element entfernt, lassen nur noch gültige Ids übrig.
- Gesperrte und ausgeblendete Elemente: Aufziehrahmen und Strg + A überspringen sie; Verschieben, Skalieren, Löschen und Pfeiltasten ändern sie nie (Ebenen-Panel darf sie wählen, um zu entsperren).
- Pfeiltasten dürfen nicht greifen, wenn der Fokus auf einem Regler, Zahlenfeld, Textfeld, Menü oder in der Bibliothek liegt; Strg + A/C/X/V bleiben dort nativ.
- «Ausschneiden, dann Einfügen»: das Bild-Asset des Elements muss das Einfügen überleben (prüfen, wann Assets verworfen werden).
- Einfügen mit leerer oder fremder Zwischenablage (Text aus einer anderen App) darf nichts Altes einfügen; ein Bild aus der Zwischenablage mit unbekanntem Format zeigt eine Meldung statt zu schweigen.

---

### Task 1: Auswahl im Store und im Modell

**Files:** Modify `src/store/ui.ts`, `src/store/document.ts` (`load` setzt `selectedIds: []`), `src/ui/actions.ts` (`installSelectionSync`). Create `src/model/selection.ts`, `src/model/selection.test.ts`. Test `src/ui/actions.test.ts`.

**Interfaces:**
- Produces in `ui.ts`: `selectedIds: string[]`, `setSelectedIds(ids: string[]): void` (setzt `selectedId = ids.length === 1 ? ids[0] : null`), `setSelectedId(id)` ruft `setSelectedIds(id ? [id] : [])`.
- Produces in `selection.ts`: `selectableOnSlide(p: Project, slide: number): string[]` (sichtbar, nicht gesperrt, `elementsOnSlide`), `idsInRect(p: Project, slide: number, rect: Rect): string[]` (davon die, deren `elementBounds` das Rechteck schneiden), `unionBounds(els: Element[]): Rect`.

- [ ] **Step 1: Tests schreiben.** `selection.test.ts`: `selectableOnSlide` lässt ein gesperrtes und ein ausgeblendetes Element weg; `idsInRect` nimmt ein Element, das über die Slide-Grenze ragt, auf beiden Slides mit; `unionBounds` von zwei Elementen. `actions.test.ts`: `setSelectedIds(['a','b'])` ergibt `selectedId === null`; `['a']` ergibt `'a'`; Löschen von `b` per `apply` lässt `selectedIds === ['a']`; Slidewechsel entfernt Ids, die nicht auf der neuen Slide liegen.
- [ ] **Step 2: Fehlschlag prüfen** (`npx vitest run src/model/selection.test.ts src/ui/actions.test.ts`).
- [ ] **Step 3: Implementieren.** `installSelectionSync` filtert `selectedIds` nach Existenz und `elementsOnSlide(currentSlide)`; ein Element, das beim Wechsel der Slide nicht mehr auf ihr liegt, fällt heraus (bei genau einer gewählten Id gilt weiter die bestehende Regel «Auswahl bestimmt die aktuelle Slide»).
- [ ] **Step 4: Tests grün, Gate.**
- [ ] **Step 5: Commit** `feat: selectedIds in ui store, selection helpers`.

### Task 2: Mehrfachaktionen im Modell

**Files:** Modify `src/model/elements.ts`, `src/model/elements.test.ts`, `src/ui/actions.ts`, `src/ui/actions.test.ts`.

**Interfaces:**
- Produces in `elements.ts`: `removeElements(p, ids: string[]): void` (gesperrte bleiben), `duplicateElements(p, ids): string[]` (neue Ids, Reihenfolge und Abstand zueinander bleiben, +40/+40), `moveElements(p, ids, dx: number, dy: number): void` (gesperrte bleiben).
- Produces in `actions.ts`: `removeMany(ids)`, `duplicateMany(ids)` (wählt danach die Kopien), `patchMany(ids, patch: Partial<Element>)` (für `locked`, `visible`; kein leerer Undo-Schritt), `nudge(ids, dx, dy)`; je ein `tryApply`.

- [ ] **Step 1: Tests.** Je Funktion: ein gesperrtes Element in der Menge bleibt unverändert; `duplicateElements` liefert so viele neue Ids wie Eingaben; `removeMany` von drei Elementen ist nach einem `undo()` komplett zurück (ein Schritt).
- [ ] **Step 2: Fehlschlag. Step 3: implementieren** (`duplicateElement` und `removeElement` wiederverwenden, nicht neu schreiben). **Step 4: grün. Step 5: Commit** `feat: multi-element actions`.

### Task 3: Zwischenablage im Modell und als Aktion

**Files:** Create `src/model/clipboard.ts`, `src/model/clipboard.test.ts`, `src/ui/clipboard.ts`, `src/ui/clipboard.test.ts`.

**Interfaces:**
- `copyElements(p: Project, ids: string[]): Element[]` (tiefe Kopien in Ablagereihenfolge, ohne gesperrte? nein: gesperrte werden mitkopiert).
- `pasteElements(p: Project, entries: Element[], slide: number, step: number): string[]`: neue Ids, Gruppe landet mit gleichem Abstand zur Slide-Ecke der aktuellen Slide wie am Ursprung (Ursprung = Slide der Gruppen-Box), plus `step × 40` px; Rolle bleibt wie bei `duplicateElement`; Namen wie bei Duplikaten («… Kopie»).
- `ui/clipboard.ts`: `copySelection(): boolean`, `cutSelection(): boolean`, `pasteClipboard(e?: ClipboardEvent): void`. Marker `bbzb-social-studio:<n>` wird bei Kopieren in `clipboardData` (text/plain) geschrieben. Eingefügt wird aus dem internen Speicher nur, wenn `text/plain` dem Marker entspricht oder kein Ereignis da ist (Menü). Liegen Bilddateien in `clipboardData.files`, haben sie Vorrang und gehen durch `elementTypes.all().find(t => t.acceptsFile?.(f) && t.fromFile)`, sonst Meldung «Diese Datei kann ich nicht verwenden. Erlaubt sind Fotos.» (wie `onDrop`). Wiederholtes Einfügen erhöht `step`, ein neues Kopieren setzt ihn auf 0.

- [ ] **Step 1: Tests.** `pasteElements`: auf Slide 2 eingefügt liegt die Box um genau eine Slide-Breite weiter rechts als am Ursprung auf Slide 1; zweites Einfügen +40; Ids sind neu. `ui/clipboard`: Einfügen nach fremdem `text/plain` («Hallo») fügt nichts ein; Ausschneiden entfernt die Elemente, Einfügen bringt sie zurück und das Foto-Asset ist noch referenzierbar (Review Focus, prüfe in `src/storage` und `withReferencedAssets`, wann Assets verworfen werden; ist es sofort, Assets erst beim Sichern verwerfen).
- [ ] **Step 2 bis 5** wie oben, Commit `feat: clipboard for elements and images`.

### Task 4: Aufziehrahmen und Shift-Klick auf der Leinwand

**Files:** Create `src/canvas/rubberBand.ts`, `e2e/multiselect.spec.ts`. Modify `src/canvas/CanvasView.tsx` (`onPointerDown`, Zeile ~164 bis 190), `src/canvas/SelectionLayer.tsx`.

**Interfaces:**
- `rubberBand(stage: Konva.Stage, layer: Konva.Layer, onDone: (rect: Rect | null) => void): (e: PointerEvent) => void`: zeichnet imperativ ein `Konva.Rect` (Kontur `colors.orange`, Füllung orange 10 %, `listening: false`, `name: 'rubber'`) und ruft bei Loslassen `onDone` mit dem Rechteck in globalen Koordinaten, `null` bei weniger als 4 px Zug.

- [ ] **Step 1: e2e-Test** (`multiselect.spec.ts`, Vorlage `e2e/selection.spec.ts`): zwei Texte auf einer Slide, Aufziehen über beide wählt beide (Ebenen-Panel zeigt zwei markierte Zeilen), Shift-Klick auf einen dritten ergänzt, Shift-Klick auf einen gewählten nimmt ihn heraus, Klick ins Leere wählt ab und setzt die Slide, auf der geklickt wurde. Der Test scheitert vor der Umsetzung.
- [ ] **Step 2: Umsetzen.** Klick auf leere Fläche: bisheriges Verhalten (abwählen, Slide setzen) erst bei `pointerup` ohne Zug; mit Zug `idsInRect(p, slideAt(start), rect)` setzen (Shift: zur Auswahl hinzufügen). Leertaste ziehen (`usePan`) hat Vorrang und startet keinen Rahmen. Shift-Klick auf ein Element (Treffer wie bisher über `n.id()`) schaltet es in `selectedIds` um, nur wenn es in `selectableOnSlide` der aktuellen Slide liegt.
- [ ] **Step 3: grün, Gate inkl. `npm run test:e2e`. Step 4: Commit** `feat: marquee and shift-click selection`.

### Task 5: Transformer, Ziehen und Einrasten mit mehreren Elementen

**Files:** Modify `src/canvas/SelectionLayer.tsx`, `src/canvas/snap.ts` (`SnapSource` nimmt `movingIds: string[]`, `snapLines(p, ids, o)`), `src/canvas/snap.test.ts`. Create `src/canvas/multiGesture.ts`. Test `e2e/multiselect.spec.ts` (erweitern), `e2e/transform.spec.ts` bleibt grün.

**Interfaces:**
- `snapLines(p: Project, movingIds: string[], o?: SnapOptions): SnapLines` schliesst alle `movingIds` aus den Linienquellen aus (bisheriger Aufruf mit einer Id bleibt gleich wirksam).
- `multiGesture.ts`: `commitMove(ids: string[], nodes: Konva.Node[]): void` und `commitTransform(nodes: Konva.Node[]): void`, je ein `apply` über alle (Position bzw. `afterTransform` je Elementtyp mit der Box aus dem Node, `exact()`-Rundung wie heute).

- [ ] **Step 1: Tests.** `snap.test.ts`: eigene Linien beider bewegten Elemente werden nicht zum Ziel. e2e: Zwei Elemente wählen, ziehen: beide bewegen sich um denselben Betrag, ein `undo` stellt beide zurück; Ecke ziehen skaliert beide proportional; Drehanfasser fehlt bei zwei Elementen; ein gesperrtes Element in der Auswahl bleibt stehen.
- [ ] **Step 2: Umsetzen.** `tr.nodes(allNodes)`; bei mehr als einem Node `rotateEnabled(false)` und nur Eckanfasser; Einrasten rechnet mit der gemeinsamen Box (`unionBounds` aus den aktuellen Node-Positionen). Konva bewegt beim Ziehen eines gewählten Nodes die anderen Nodes des Transformers mit, aber nur der gezogene feuert `dragend`: Position aller Nodes deshalb in `commitMove` aus dem Stage-Ereignis `dragend.snap` schreiben und die Einzel-`onDragEnd` der vier Node-Komponenten dann überspringen (Gestenschutz mit `startGesture`/`endGesture`, damit es ein Undo-Schritt bleibt). Bei genau einem Element läuft der bisherige Pfad unverändert. Prüfe die Mitzieh-Annahme mit einem Wegwerf-Test, bevor `commitMove` gebaut wird.
- [ ] **Step 3: Gate, Ziehen mit 4× CPU-Drosselung messen** (wie `e2e/outline-perf.spec.ts`). **Step 4: Commit** `feat: multi-element drag, scale and snapping`.

### Task 6: Tastatur

**Files:** Modify `src/ui/shortcuts.ts`, `src/ui/keys.ts`, `src/ui/shortcuts.test.ts`; `e2e/multiselect.spec.ts`.

**Interfaces:** Konsumiert `selectableOnSlide`, `removeMany`, `duplicateMany`, `nudge`, `copySelection`, `cutSelection`, `pasteClipboard`. `KEYS` bekommt `selectAll`, `copy`, `cut`, `paste`, `nudge` für die Tooltips.

- [ ] **Step 1: Tests** (`shortcuts.test.ts`): Strg + A wählt `selectableOnSlide(currentSlide)`; Pfeil rechts bewegt die Auswahl um 1, mit Shift um 10, Pfeiltasten mit Fokus auf `input[type=range]` bewegen nichts; Strg + A in einem Textfeld ruft `preventDefault` nicht auf; Alt + ← bleibt wie bisher abgefangen; Entf und Strg + D wirken auf die ganze Auswahl; `copy`/`cut`/`paste` als DOM-Ereignisse mit gesetztem `clipboardData`.
- [ ] **Step 2: Umsetzen.** Pfeiltasten nur, wenn `e.target` der Body oder die Leinwand ist (nicht in Feldern, Reglern, Bibliothek, Menü). Mehrfachaktionen immer über die Funktionen aus Task 2 und 3.
- [ ] **Step 3: Gate. Step 4: Commit** `feat: keyboard for multi-selection and clipboard`.

### Task 7: Ebenen-Panel mit Mehrfachauswahl

**Files:** Modify `src/ui/LayersPanel.tsx` (Klick bei Zeile ~138), `e2e/layers.spec.ts` oder `e2e/multiselect.spec.ts`.

- [ ] **Step 1: e2e-Test.** Strg- oder Shift-Klick auf Zeilen schaltet um und markiert mehrere (`aria-selected`), gewöhnlicher Klick wählt eine; Drag zum Umsortieren bewegt bei mehreren Zeilen nur die gezogene (Entscheid: kein Mehrfach-Umsortieren in 2.10).
- [ ] **Step 2: Umsetzen** mit `setSelectedIds`. **Step 3: Gate. Step 4: Commit** `feat: multi-select in layers panel`.

### Task 8: Inspector: Mehrfachansicht, Position und Grösse, engere Abstände

**Files:** Modify `src/ui/Inspector.tsx`, `src/ui/inspector.css`, `src/ui/NumberField.tsx` (nur falls nötig). Create `src/ui/PositionSection.tsx`, `src/ui/PositionSection.test.tsx`, `e2e/inspector-position.spec.ts`.

**Interfaces:**
- `PositionSection({ ids }: { ids: string[] })`: Zahlenfelder X, Y, B, H (px, relativ zur linken oberen Ecke der aktuellen Slide, gerundet auf 0.01) und bei einem Element Drehung (°). Mehrere Ids: Felder zeigen die gemeinsame Box (`unionBounds`); eine Änderung von X/Y verschiebt alle um die Differenz, B/H skaliert alle proportional zur Box (je Element über `afterTransform`). Je Feldänderung ein Undo-Schritt, Mindestgrösse 20 wie `MIN_SIZE`. Gesperrte Elemente: Felder `readOnly` (so macht es `NumberField`).
- Inspector bei `selectedIds.length > 1`: Titel «N Elemente», Abschnitt «Ebene» (Duplizieren, Nach vorne, Nach hinten per Aufruf auf jedes Element in Ablagereihenfolge, Sperren, Ausblenden, Löschen mit Wort) und `PositionSection`; der Einzel-Inspector bekommt `PositionSection` direkt unter «Ebene».

- [ ] **Step 1: Tests.** Vitest: B auf 400 ändern setzt Breite 400 und Höhe proportional (Elementtyp mit Seitenverhältnis); X-Feld schiebt zwei Elemente um dieselbe Differenz; Wert unter 20 wird auf 20 begrenzt. e2e: Inspector zeigt bei zwei gewählten Elementen «2 Elemente»; Zahl tippen verschiebt das Element sichtbar; `e2e/icons-a11y.spec.ts` und `inspector-icons.spec.ts` bleiben grün.
- [ ] **Step 2: Umsetzen,** dazu `inspector.css`: Zeilenhöhe und Abschnittsabstände enger (Mass gegen Screenshot `docs/ideen screenshots/` prüfen, kein Inhalt fällt weg, Inspector scrollt bei 1280 × 720 nicht mehr als vorher).
- [ ] **Step 3: Gate. Step 4: Commit** `feat: inspector position and size, multi-selection panel, denser rows`.

### Task 9: Rechtsklickmenü

**Files:** Create `src/ui/ContextMenu.tsx`, `src/ui/contextMenuItems.ts`, `src/ui/contextMenuItems.test.ts`, `src/ui/contextmenu.css`, `e2e/contextmenu.spec.ts`. Modify `src/ui/EditorPage.tsx` (einhängen), `src/canvas/CanvasView.tsx` (`contextmenu` der Stage), `src/ui/LayersPanel.tsx` (Zeilen), `src/ui/Tooltip.tsx` nur falls Kürzel-Anzeige nötig.

**Interfaces:**
- `MenuItem = { id: string; label: string; keys?: string; disabled?: string; run(): void } | { separator: true }`.
- `menuItemsFor(ids: string[]): MenuItem[]`: Kopieren, Ausschneiden, Einfügen, Duplizieren | Nach vorne, Nach hinten | Sperren/Entsperren, Ausblenden, Löschen | elementspezifisch bei genau einem Element: Foto «Ausschnitt bearbeiten», «Spiegeln»; Text «Text bearbeiten» (die Aktionen existieren bereits, die Elementtypen liefern sie nicht über die Registry: entweder `ElementType` um optionales `menuItems?(el): MenuItem[]` ergänzen oder die zwei vorhandenen Handler importieren; Registry-Variante vorziehen, der Kern importiert keine Plugins). Ohne Auswahl (Klick auf leere Fläche): nur «Einfügen». Einfügen ist `disabled` mit Begründung, wenn nichts im internen Speicher liegt.
- `ContextMenu`: `role="menu"`, Einträge `role="menuitem"`, Pfeiltasten, Enter, Esc, Fokus geht beim Schliessen zurück; schliesst bei Klick ausserhalb, Scrollen, Fensterwechsel; bleibt im Fenster. Rechtsklick auf ein nicht gewähltes Element wählt es zuerst; auf ein gewähltes behält die Mehrfachauswahl. `preventDefault` unterdrückt das Edge-Menü.

- [ ] **Step 1: Tests.** Vitest: `menuItemsFor([a,b])` enthält kein «Text bearbeiten», `menuItemsFor([])` nur «Einfügen»; gesperrtes Element zeigt «Entsperren» und «Löschen» ist `disabled` mit Begründung. e2e: Rechtsklick auf ein Foto öffnet das Menü, «Duplizieren» erzeugt Kopie, Esc schliesst und der Fokus kehrt zurück, Rechtsklick im Ebenen-Panel funktioniert.
- [ ] **Step 2: Umsetzen. Step 3: Gate. Step 4: Commit** `feat: context menu`.

### Task 10: Slide-Leiste einzeilig, Bild aus Zwischenablage, Abnahme

**Files:** Modify `src/ui/app.css` (`.slidebar` Zeile ~226 bis 245), `src/ui/SlideBar.tsx`, `e2e/viewport.spec.ts`; Create `e2e/clipboard.spec.ts`.

- [ ] **Step 1: e2e-Tests.** `viewport.spec.ts`: bei 1280 × 720 mit 8 Slides hat die Leiste eine Zeile (Höhe einer Kachel plus Polster). `clipboard.spec.ts`: Strg + C, dann Strg + V auf einer anderen Slide legt eine Kopie auf diese Slide; ein `paste`-Ereignis mit einer PNG-Datei erzeugt ein Foto-Element; ein `paste` mit Text «Hallo» ändert nichts.
- [ ] **Step 2: Umsetzen.** «Slide hinzufügen» und «Slide löschen» behalten das Wort ab 1536 px, darunter Icon mit Tooltip (`aria-label` bleibt); Kacheln scrollen horizontal innerhalb der Leiste statt umzubrechen.
- [ ] **Step 3: Selbst anschauen:** App in Edge starten, Aufziehen, Shift-Klick, Ziehen, Skalieren, Strg + C/V über Slides, Rechtsklick, Screenshot bei 1280 × 720 und 1536 × 864, exportierte Datei öffnen und mit `docs/reference/layouts/` vergleichen.
- [ ] **Step 4: Docs.** `docs/windows-checkliste.md`: Handtests (Touchpad-Rechtsklick, Strg + V mit Screenshot aus dem Snipping Tool, Aufziehrahmen bei 125 %). `docs/roadmap.md`: 2.10 auf «erledigt» kürzen, Backlog-Punkt «Slide-Leiste bei 1280 px» streichen, «Gruppen im Ebenen-Panel» im Ideenspeicher belassen, dazu «Ausrichten» und «Kopieren zwischen Projekten». `DESIGN.md`: Kontextmenü und Zahlenfelder kurz nachtragen. Gesamt-Review mit dem stärksten Modell nach `workflow.md`, Plan nach `docs/archiv/plans/`, `naechste-session.md` neu schreiben.
- [ ] **Step 5: Commit** `feat: single-row slide bar, clipboard images; docs`.

---

**Selbstprüfung:** Jeder Punkt der Spezifikation hat einen Task: Auswahl (1, 4, 6, 7), gemeinsames Bearbeiten (2, 5, 8), Copy/Paste samt Bild (3, 6, 10), Menü (9), Kompakt (8, 10). Aufteilung nach Umbau: Task 5 ist der riskanteste (Konva-Mitziehen, Einrasten, `afterTransform`) und gehört dem stärksten Modell.
