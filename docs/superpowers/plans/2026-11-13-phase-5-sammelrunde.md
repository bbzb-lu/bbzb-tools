# Phase 5: Sammelrunde aus den Issues, Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In einer Runde alles aus den offenen Issues erledigen, was ohne Schulgerät und ohne Grundsatzentscheid machbar ist: Video-Lücken, Mehrfachauswahl, Export, Inspector, Pinselmodus, Bedien-Kleinigkeiten, Banner-Effekte für eigene Bilder.

**Architecture:** Drei Bahnen mit getrennten Dateien, jede in einem eigenen Worktree und mit eigenem PR. Innerhalb einer Bahn laufen die Tasks nacheinander (Implementer, dann Reviewer). Keine neuen Abhängigkeiten, keine neuen Registries.

**Tech Stack:** React 19, Konva, zustand, Mediabunny, Canvas 2D, vitest, Playwright (`channel: 'msedge'`).

**Spec:** Die Issues selbst (#17, #20 bis #27, #32, #33) plus `apps/social-studio/docs/2026-10-21-bbzb-social-studio-design.md`. Wo ein Issue-Punkt unklar war, steht der Entscheid unten bei «Entscheide».

## Bahnen und PRs

| Bahn | Branch | Tasks | Schliesst |
|---|---|---|---|
| A Banner | `phase-5-banner` | 1 | #33 |
| B Foto und Video | `phase-5-video` | 2 bis 8 | #20, #25, #26 (bis auf Header-Entscheid), #27, #32 |
| C Oberfläche | `phase-5-ui` | 9 bis 14 | #21, #22, #23, #24, #17 (bis auf Usability-Test) |

Alle Branches von `main` (`2f3b38e` oder neuer). Die offenen Änderungen an `.claude/settings.json` und `AGENTS.md` gehören Alexej und bleiben unberührt.

Modelle: Implementer und Task-Reviewer Sonnet (Wunsch Alexej). Gesamt-Review pro Bahn durch den Controller (Fable). Tasks 3, 7 und 10 berühren den Export: dort liest der Controller das Diff zusätzlich selbst.

## Nicht in dieser Phase

- #28, #10: Handtests auf dem Schulgerät.
- #6 bis #9: Windows-Abweichungen, brauchen ein Windows-Gerät zum Eingrenzen.
- #18: Gestaltungsentscheide, Alexej beantwortet sie im Issue.
- #26 Punkt 3: COOP/COEP-Header für WASM-Threads, Entscheid offen.
- #17 Punkt 3: Usability-Test mit dem Sekretariat.

## Schon erledigt (nur Test ergänzen und im Issue abhaken)

- #26 Sticker von gesperrtem Foto: `duplicateElement` klont `locked` bereits. Test in Task 6.
- #20 Umschalten Folie/Ergebnis live: gibt es im Inspector (`maskView`). Fehlt nur in der Kontextleiste, Task 8.
- #24 Hinweis «Doppelklick bearbeitet den Text»: steht in `TextInspector.tsx:40`.
- #24 gesperrte Fotos per Rechtsklick: «… entsperren» gibt es (`restoreItems`).
- #21 Hinweistexte in Serif: Serif wurde in `a94a14d` entfernt, Punkt entfällt.
- #24 Startseite «zu laut»: Kacheln nutzen keine Akzentfarbe mehr. Task 12 macht einen Screenshot zur Bestätigung.

## Entscheide (Empfehlung gesetzt, Alexej kann vor dem Start ändern)

1. **Banner:** Eigene Bilder mit durchsichtigen Flächen bekommen Schein und Relief automatisch, deckende Bilder (Fotos) wie bisher nicht. Kein Schalter. Die Farben des Bilds bleiben.
2. **Gruppen-Skalieren:** Text skaliert in der Gruppe die Schriftgrösse mit. Tags behalten ihre Grösse (Designsystem) und verschieben sich nur.
3. **Video drehen:** Im Code ist keine Sperre zu finden. Task 4 stellt den Fehler zuerst im Browser nach. Lässt er sich nicht nachstellen, bleibt ein e2e-Test als Beleg und eine Rückfrage im Issue.
4. **Gesperrtes Element:** statt Tooltip an jedem Regler eine Zeile oben im Inspector «Gesperrt.» mit Knopf «Entsperren», die Abschnitte darunter sind `inert`.
5. **Unklar, nicht eingeplant:** «H am einzelnen Text wirkt nicht» (#23, es gibt kein Höhenfeld) und «dünne Linie am Rand des Ausschnitts» (#24, die Linie ist gebaut und getestet). Rückfrage an Alexej, was gemeint ist.

## Global Constraints

- Nichts verlässt den Browser. Einzige fremde Requests: Modelldateien von Hugging Face. Kein neues npm-Paket.
- Werte nur in `packages/ui/src/theme.ts`, `apps/social-studio/src/tokens.ts`, `apps/social-studio/src/ui/theme.ts`, `apps/news-banner/src/tokens.ts`. Kein Hex anderswo.
- UI-Texte Deutsch, Schweizer Rechtschreibung, Guillemets, Du-Form, kein Halbgeviertstrich. Das Attribut `title` ist verboten, Tooltips über `data-tip`.
- Dateien unter 400 Zeilen. `PhotoNode.tsx` hat 340: wer dort mehr als 40 Zeilen zufügt, lagert aus.
- Kein React-Render und kein Store-Schreiben pro Mausbewegung. Neue Rechenarbeit mit 4× CPU-Drosselung messen.
- Pixel-, Golden- und Exporttests nie aufweichen. Tests an neu gewünschtes Verhalten anpassen ist erlaubt und wird im Report genannt.
- Speicher-Namensraum `social-studio`. Der Banner speichert nichts.
- Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npx vitest --project <id> run`, `npx playwright test --project <id>`. Testvideos: `sh apps/social-studio/scripts/make-test-videos.sh`.
- Commits klein, Englisch, mit Co-Authored-By-Zeile. Kein Push, kein Merge durch Subagenten.

## Review Focus

1. Projektdatei aus einer älteren Version mit Video und `frame: true` im Dokument (früher ausgeblendet): öffnet ohne plötzlich sichtbaren Rahmen? Test in Task 3.
2. Zweites Einfügen desselben Videos, danach läuft die Speicherbereinigung: die Datei bleibt. Test in Task 5.
3. Ordner-Export, wenn Edge den Ordnerzugriff ablehnt oder der Dialog abgebrochen wird: keine Fehlermeldung beim Abbruch, klare Meldung bei Ablehnung, ZIP bleibt möglich. Test in Task 10.
4. Abbruch während der Vorbereitung, danach neuer Export: läuft sauber durch, kein hängender Zustand. Test in Task 10.
5. Eigenes Banner-Bild mit halbtransparentem Rand (weicher Schatten aus Photoshop): Schein wird nicht doppelt hart, deckendes JPEG bekommt kein Rechteck-Leuchten. Test in Task 1.

---

## Bahn A: Banner

### Task 1: Eigene Bilder mit Schein und Relief (#33)

**Files:**
- Modify: `apps/news-banner/src/icons/raster.ts`, `apps/news-banner/src/render.ts`
- Test: `apps/news-banner/src/render.test.ts`, `apps/news-banner/e2e/icons.spec.ts`

**Interfaces:**
- `Prepared.tinted` wird zu `Prepared.effects: boolean` (alle Fundstellen umbenennen).
- Neu in `raster.ts`: `export function hasTransparency(src: CanvasImageSource, w: number, h: number): boolean`. Wahr, wenn mindestens 1 % der Pixel Alpha unter 250 hat (auf höchstens 256 px Kantenlänge verkleinert prüfen).
- `prepareIcon` für `kind: 'image'`: mit Transparenz wie ein Icon auf den Inhalt zuschneiden (`trim`, bisher fest `tinted: true`, bekommt den Wert als Parameter) und `effects: true`, sonst unverändert `effects: false`.

- [ ] Test (vitest): `hasTransparency` für ein volles Rechteck falsch, für einen Kreis auf leerem Grund wahr.
- [ ] Test (e2e, `icons.spec.ts`): PNG mit rotem Kreis auf durchsichtigem Grund als eigenes Bild in den linken Platz. Im Export ist ein Pixel 12 px ausserhalb der Kreiskante heller als der Verlauf an derselben Stelle ohne Bild (Schein), der Kreis selbst bleibt rot. Zweiter Fall: deckendes JPEG, Pixel 12 px ausserhalb des Bilds gleich dem Verlauf (Helfer `near`, `px`, `exportPng` aus `e2e/helpers.ts`).
- [ ] Beide scheitern sehen, umsetzen, grün.
- [ ] Export in dunkler und heller Vorlage öffnen, mit einem Lucide-Icon daneben vergleichen, Screenshot in den Workspace.
- [ ] Commit `news-banner: glow and relief for own images with transparency`.

---

## Bahn B: Foto und Video

### Task 2: Video heisst Video (#25, #32) und «Waagrecht» einheitlich (#24)

**Files:**
- Modify: `apps/social-studio/src/plugins/elements/photo/fromFile.ts` (:51, :64), `ImageSection.tsx` (:73 bis :81), `index.tsx` (:41)
- Test: `fromFile.test.ts`, `e2e/video-import.spec.ts`, `e2e/video-inspector.spec.ts`, `e2e/contextmenu.spec.ts`

**Interfaces:** nutzt `nextName(p, label)` und `renameForStyle(name, from, to)` aus `src/model/elements.ts`, `isVideo(p)` aus `schema.ts`.

- [ ] Tests: Video einfügen ergibt Namen «Video 1». Foto «Foto 2» durch ein Video ersetzen ergibt «Video 2», ein von Hand umbenanntes Element behält seinen Namen (so verhält sich `renameForStyle`). Am Video heisst der Knopf «Video ersetzen», der leere Hinweis bleibt «Zieh ein Foto hierher».
- [ ] Kontextmenü «Spiegeln»: Eintrag «Waagrecht» statt «Waagerecht», `contextmenu.spec.ts` anpassen.
- [ ] Umsetzen, Gate, Commit `studio: name videos as videos, unify «Waagrecht»`.

### Task 3: Rahmen am Video (#32)

**Files:**
- Modify: `schema.ts` (:50 bis :64 `frameOf`), `PhotoEffects.tsx` (:40, :50), `fromFile.ts` (:74 `fillPhoto` löscht `frame` nicht mehr), `PhotoNode.tsx` (Kontur-Key um `still.time` ergänzen), `video.test.ts`
- Test: `video.test.ts`, `e2e/video-editor.spec.ts` (:26 erwartet heute 0 Einträge «Rahmen»), neu `e2e/video-frame.spec.ts`

**Interfaces:** `frameOf(p)` gibt `p.frame ?? false` zurück, ohne Videofall. Spiegeln und Bildregler bleiben am Video gesperrt.

- [ ] Test (vitest): `frameOf` ist am Video mit `frame: true` wahr. Projekt-Migration: ein geladenes Video mit `frame: true` aus altem Bestand verliert `frame` beim Laden (Review Focus 1, in der Schema-Migration des Photo-Typs, nicht im Renderer).
- [ ] Test (e2e): Rahmen am Video einschalten, MP4 exportieren, erstes und letztes Frame dekodieren: am Bildrand liegt die Rahmenfarbe, innen das Video. Rahmen «aussen» ebenfalls ein Frame prüfen.
- [ ] Umsetzen. `OutsideFrame` und `InsetFrame` liegen ausserhalb von `VIDEO_FRAME_NODE` und kommen in `renderSlide` automatisch in jedes Frame.
- [ ] Exportiertes MP4 selbst öffnen. Exportdauer einer 10-s-Slide mit und ohne Rahmen notieren (Abweichung über 10 % melden).
- [ ] Commit `studio: frame effect on videos`.

### Task 4: Video drehen (#32, Kommentar)

**Files:** nach Befund. Test: `e2e/transform.spec.ts` oder neu `e2e/video-rotate.spec.ts`.

- [ ] `superpowers:systematic-debugging`: Video einfügen, Dreh-Anker am Transformer ziehen (echte Maus in Playwright, nicht `patch`). Zeigt der Transformer den Anker «rotater»? Dreht das Element, die Vorschau, der Export?
- [ ] Test, der den Fehler zeigt: nach dem Ziehen ist `rotation` ungleich 0, das Startbild ist gedreht, ein exportiertes Frame hat eine Ecke in Hintergrundfarbe.
- [ ] Ursache beheben. Kein Fehler nachstellbar: Test bleibt als Beleg, Status DONE_WITH_CONCERNS mit genauer Beschreibung, was geprüft wurde.
- [ ] Commit `studio: rotate videos` (oder `test: cover rotating videos`).

### Task 5: Gleiches Video nicht neu schreiben (#25)

**Files:**
- Modify: `apps/social-studio/src/storage/assets.ts` (:63 bis :86), `src/storage/gc.ts`
- Test: `src/storage/storage.test.ts`

**Interfaces:** `put(blob, given?)` behält seine Signatur. Liegt unter der ID schon eine Datei gleicher Grösse, wird nicht geschrieben. Der Schutz vor der Bereinigung kommt aus einer Merkliste im Store (`touched: Map<string, number>`, nur für die Sitzung), die `collectGarbage` neben `lastModified` berücksichtigt. Gilt für Fotos und Videos.

- [ ] Test: zweimal `put` mit demselben Blob gegen einen OPFS-Stub, `createWritable` wird einmal aufgerufen. Danach `collectGarbage(store, now + 11 min seit dem ersten put)`: die Datei bleibt, weil das zweite `put` sie vorgemerkt hat (Review Focus 2). Datei gleicher ID, aber anderer Grösse (abgebrochener Schreibvorgang) wird neu geschrieben.
- [ ] Umsetzen, Gate, Commit `studio: skip rewriting assets that are already stored`.

### Task 6: Freistellen: Fehlermeldung und Sticker-Sperre (#26)

**Files:**
- Modify: `src/ai/segmentWorker.ts` (:55), `src/ai/segmentClient.ts` (:17, :46), `src/plugins/elements/photo/cutoutOps.ts` (:15 bis :18, :66)
- Test: `segmentWorker.test.ts`, `segmentClient.test.ts`, `cutoutOps.test.ts`, `stickerOps.test.ts`

**Interfaces:** Worker meldet `reason: 'network' | 'missing' | undefined` statt `network: boolean`. «locate file» und HTTP 404 sind `missing`, «fetch» und «network» bleiben `network`. Neu `class AiMissingError extends Error`. Text `AI_MISSING`: «Das KI-Modell wurde nicht gefunden. Das liegt an der App, nicht an deinem Netz. Bitte melde es über das Feedback-Formular.» `AI_NETWORK` bleibt.

- [ ] Tests: Worker-Fehler «Could not locate file» ergibt `missing` und die neue Meldung, «Failed to fetch» ergibt weiterhin die Netzmeldung mit «huggingface.co». `e2e/network.spec.ts:264` bleibt unverändert grün.
- [ ] Test: `copyAsSticker` und `copyBehindTitle` von einem gesperrten Foto liefern ein gesperrtes Element.
- [ ] Umsetzen, Gate, Commit `studio: tell a missing model apart from a blocked network`.

### Task 7: Testvideos, Naht, Ton-Versatz, HEIC einmal (#27)

**Files:**
- Modify: `apps/social-studio/scripts/make-test-videos.sh`, `e2e/video.ts`, die Specs mit eigenem ffmpeg-Aufruf (`video-export.spec.ts:14`, `video-export-colour.spec.ts:11`, `export-quality.spec.ts:10`), `src/plugins/elements/photo/importImage.ts` (:13), `index.tsx` (:55)
- Create: `e2e/video-seam.spec.ts`

**Interfaces:** `export const isHeic = (f: File) => …` aus `importImage.ts`, `acceptsFile` nutzt sie. Das Skript erzeugt alle Clips (`two-tone`, `two-tone-aac`, `landscape-grid`, `opus-audio`, `tagged-bt709`, `noise`) und überspringt vorhandene. Aufgerufen wird es einmal aus dem Playwright-`globalSetup` des Projekts, nicht mehr aus `video-import.spec.ts`. `vfr-h264.mp4` und `portrait-hevc.mov` nutzt keine Spec: entweder eine Spec dafür oder aus dem Skript streichen (im Report begründen).

- [ ] Neuer Clip `beep-flash.mp4`: 6 s, bei Sekunde 3 wechselt die Farbe und ein Ton setzt ein.
- [ ] e2e Naht: Video liegt über Slide 1 und 2. Export ergibt zwei MP4 gleicher Länge, beide beginnen bei Sekunde 0, an der Naht passt Spalte 1079 von Slide 1 zu Spalte 0 von Slide 2 (gleiches Frame, Abweichung pro Kanal höchstens 8).
- [ ] e2e Ton-Versatz: `beep-flash.mp4` mit Start 2 s exportieren. Farbwechsel im Bild und Einsatz des Tons liegen beide bei 1 s, Abstand höchstens 50 ms.
- [ ] Jede Video-Spec einzeln laufen lassen (`npx playwright test --project social-studio <spec>`) nach `rm -rf e2e/fixtures/video`: alle grün ohne Reihenfolge.
- [ ] Commit `studio tests: one script for test clips, seam and audio offset e2e, single HEIC check`.

### Task 8: Pinselmodus (#20) und Platzhalter-Hinweis (#24)

**Files:**
- Modify: `src/plugins/elements/photo/BrushControls.tsx` (:35 bis :61), `src/ui/contextbar/editBars.tsx` (:15 bis :26), `src/ui/contextbar.css`, `PhotoNode.tsx` (:65, :92, :102, :248 bis :271)
- Create: `src/plugins/elements/photo/freeBand.ts` mit Test
- Test: `e2e/mask-preview.spec.ts`, `e2e/context-bar.spec.ts`, `e2e/mask-perf.spec.ts`, `e2e/placeholder.spec.ts`

**Interfaces:**
- Ausblenden/Einblenden und Folie/Ergebnis im Inspector als `Segmented` aus `@bbzb/ui`, Folie/Ergebnis zusätzlich in `MaskBar`. Kürzel X bleibt.
- Ansicht «Ergebnis» zeigt Look, Regler, Verlauf und Korn. Gerechnet wird nur am Strichende und beim Umschalten, während des Strichs bleibt das Bild ohne Effekte. Key der Effekt-Canvas enthält die Maskenversion.
- `freeBand(photo: Rect, covers: Rect[]): { y: number; height: number }`: grösster senkrechter Streifen des Fotos, den kein Element darüber bedeckt. «Foto hierher ziehen» steht mittig in diesem Streifen. Ohne Überdeckung unverändert mittig.

- [ ] Test (e2e): «Ergebnis» wählen, Foto mit BBZB-Look: Pixel im sichtbaren Bereich entspricht dem Pixel nach «Fertig» (Abweichung höchstens 2). Während eines laufenden Strichs kein Aufruf der Effektrechnung (Zähler über den Testhaken).
- [ ] Test (e2e): Viewport 1024 × 640, Pinselmodus: alle Bedienelemente der `MaskBar` liegen ganz im sichtbaren Bereich der Leinwand. Zusätzlich 1280 × 720 weiterhin eine Zeile.
- [ ] Test (vitest): `freeBand` für das Titel-Layout (Foto 1080 × 1350, Titel y 161 bis 830) liefert den Streifen ab 830. e2e: im Titel-Layout liegt der Hinweistext unterhalb des Titels.
- [ ] `mask-perf.spec.ts` mit 4× Drosselung: Strichende mit «Ergebnis» bleibt unter dem bestehenden Budget der Spec.
- [ ] Umsetzen mit `impeccable:impeccable`, Screenshots beider Viewports, Gate, Commit `studio: brush mode shows effects in result view, fits small screens`.

---

## Bahn C: Oberfläche

### Task 9: Mehrfachauswahl (#23)

**Files:**
- Modify: `src/ui/MultiActions.tsx`, `src/ui/LayersPanel.tsx` (:143 bis :163), `src/plugins/elements/text/index.tsx` (:18), `text/TextNode.tsx` (:31 bis :39), `tag/TagNode.tsx`
- Test: `e2e/multiselect.spec.ts`, `e2e/layers.spec.ts`, `src/plugins/elements/text/text.test.ts`

**Interfaces:**
- `MultiActions`: Knopf «Sperren»/«Entsperren» (`aria-pressed`, `patchMany(ids, { locked })`), gleiche Logik wie `contextMenuItems.ts:64`. Erscheint damit auch in der `MultiBar`.
- Ebenen-Panel: ↑/↓ setzt Fokus und Auswahl auf die Nachbarzeile, Umschalt + ↑/↓ erweitert die Auswahl ab einer Ankerzeile, Umschalt-Klick wählt den Bereich bis zur Ankerzeile. Alt + ↑/↓ ordnet weiter um.
- Text `afterTransform(el, box)`: ändert sich die Höhe im selben Verhältnis wie die Breite (Gruppe, `keepRatio`), wird `fontSize` mit dem Faktor multipliziert und gerundet, sonst wie heute nur die Breite. Während der Geste gleichen Text und Tag `scaleY` aus, damit nichts verzerrt.

- [ ] Tests: zwei Elemente wählen, «Sperren» im Inspector, beide gesperrt, Knopf zeigt «Entsperren». Umschalt + ↓ zweimal wählt drei Zeilen. Gruppe aus Scribble und Text auf 50 % skalieren: `fontSize` halbiert, Text nicht verzerrt (Höhe entspricht `measureTextHeight`). Tag in der Gruppe behält Breite und Höhe. Einzelner Text am Seitenanker: `fontSize` unverändert.
- [ ] Umsetzen, Gate, Commit `studio: lock in multi selection, keyboard range in layers, text scales in groups`.

### Task 10: Export-Dialog und Export in einen Ordner (#22, #17)

**Files:**
- Modify: `src/export/exportZip.ts` (:68 bis :138), `src/ui/ExportDialog.tsx`, `src/ui/app.css` (:196 bis :200)
- Create: `src/export/saveToFolder.ts`
- Test: `e2e/export.spec.ts`, `e2e/video-export-dialog.spec.ts`, neu `e2e/export-folder.spec.ts`

**Interfaces:**
- `exportSlides(content, p, exporter, onProgress, signal, sink: (name: string, data: Uint8Array) => Promise<void>): Promise<void>` ist der bisherige Rumpf. `exportZip` sammelt über `sink` und zippt wie heute. `onProgress(slide, total, percent?)` bleibt, neu ruft die Vorbereitung `onProgress(0, total)` auf.
- `saveToFolder(pick: () => Promise<FileSystemDirectoryHandle>): Promise<{ sink, name: string } | null>`: `null` bei Abbruch des Dialogs. Schreibt jede Datei sofort (kein ZIP im Speicher). Unterordner mit dem Projektnamen, vorhandene Dateien werden überschrieben.
- Dialog: zweiter Knopf «In Ordner speichern», nur wenn `'showDirectoryPicker' in window`. Nach Erfolg «Gespeichert in «<Ordner>».». Ablehnung: «Edge erlaubt hier keinen Ordnerzugriff. Nimm «ZIP herunterladen».»
- `signal.throwIfAborted()` nach jedem Schritt der Vorbereitung, die Warteschleife auf Effekte (bis 15 s) bricht beim Signal sofort ab.
- Fortschritt: `role="progressbar"` mit `aria-valuenow`, `aria-valuetext` gleich dem sichtbaren Text. Gesperrte Formatwahl: `Segmented` mit `hint` «Während des Exports gesperrt.», per `aria-describedby` verbunden. Knopfzeile mit dem Abstand des Dialogs (`gap` der Dialog-Variable, kein neuer Wert).

- [ ] Tests: Abbrechen während «Export wird vorbereitet …» (Testhaken hält die Effekt-Wartezeit offen) zeigt innert 500 ms «Export abgebrochen.», ein zweiter Export danach liefert das ZIP (Review Focus 4). Fortschrittsbalken hat `aria-valuenow`. Ordner-Export mit OPFS-Ordner als Ersatz für den Picker (`navigator.storage.getDirectory()` über den Testhaken): Dateinamen und Bytes gleich wie im ZIP. Picker wirft `AbortError`: keine Meldung. Picker wirft `SecurityError`: Meldung, ZIP-Knopf aktiv (Review Focus 3).
- [ ] Umsetzen, Export beider Wege selbst öffnen, Screenshot des Dialogs im Lauf, Gate.
- [ ] Commit `studio: export into a folder, abortable preparation, accessible progress`.

### Task 11: Inspector (#21)

**Files:**
- Modify: `src/ui/inspector.css` (:10 bis :19), `src/ui/app.css` (:92), `src/ui/Inspector.tsx` (:84 bis :115), `src/ui/EffectsSection.tsx`, `src/ui/SlideEffects.tsx` (:24 bis :33), `PhotoEffects.tsx`, die vier `*Inspector.tsx` (`Section`-`id`)
- Test: `e2e/inspector-layout.spec.ts`, `e2e/effects-section.spec.ts`, `e2e/darstellung.spec.ts`, `src/ui/kit/kit.test.tsx`

**Interfaces:**
- Inspector als Karte wie `.left-box` (gleicher Rand, gleicher Abstand zum Fensterrand, Werte aus denselben Variablen). Abgleich mit `docs/design/editor.pen` nur über die Pencil-Werkzeuge.
- `Section` «Darstellung» bekommt `id={`darstellung-${el.type}`}`, der Klappzustand gilt pro Elementart.
- Gesperrt: Zeile oben «Gesperrt.» mit Knopf «Entsperren», Abschnitte darunter `inert` (Entscheid 4). Der einzelne `disabled` an `OpacitySlider` und Löschen bleibt.
- `EffectEntry` bekommt `icon: ReactNode`, das Menü zeigt es vor dem Namen (dieselben Icons wie `EffectRow`).
- Verläufe: der Klappzustand hängt nicht mehr am Index. Beim Entfernen von Verlauf `k` rücken die Zustände der folgenden nach (Store-Aktion in `store/ui.ts`), kein verwaister Eintrag.

- [ ] Tests: Text «Darstellung» zuklappen, Foto wählen, dort offen. Gesperrtes Foto: Regler nicht fokussierbar, «Entsperren» macht sie bedienbar. Drei Verläufe, mittlerer zugeklappt, ersten entfernen: der zugeklappte bleibt zugeklappt, der letzte offen. Menü «+» zeigt pro Eintrag ein Icon.
- [ ] Umsetzen mit `impeccable:impeccable`, Screenshot bei 1280 px und 125 %, `inspector-layout.spec.ts` an die Karte anpassen, Gate.
- [ ] Commit `studio: inspector card, per-type section state, lock notice, effect icons`.

### Task 12: Kleinigkeiten Bibliothek, Tag, Schalter (#24)

**Files:**
- Modify: `src/ui/libraryItem.ts` (:26 bis :39), `src/ui/BrandLibrary.tsx`, `src/ui/app.css` (:231), `src/ui/Swatches.tsx` (:4 bis :9), `src/plugins/elements/tag/TagInspector.tsx` (:48 bis :77, :125 bis :136), `packages/ui/src/Switch.tsx`, `packages/ui/src/kit.css` (:51 bis :53), `apps/news-banner/src/App.tsx` (:123, nutzt den Schalter)
- Test: `e2e/library.spec.ts`, `e2e/tag-inspector.spec.ts`, `e2e/kit.spec.ts`, `src/ui/libraryItem.test.ts`

**Interfaces:**
- `insertLibraryItem(item, at?)`: ohne `at` wird jeder weitere Klick um 40 px nach rechts unten versetzt, solange an der Zielstelle schon ein Element liegt (gleicher Wert wie `duplicateElement`).
- Hinweis unter den Tabs: «Klicken oder auf die Slide ziehen.» (`.muted.hint`).
- Kachelrand der Bibliothek: dunklere bestehende Variable, kein neuer Wert ausserhalb von `theme.ts`.
- `Swatches.tsx` exportiert `colorNames`, der Tag nutzt sie für die Farbwahl («Akzent» ergänzen). Option «BBZB (ohne Standort)» heisst «Ohne Standort».
- `Switch` bekommt optional `children`: dann rendert er ein `<label>` um Text und Schalter, der Text ist klickbar. Schatten ein und aus gleich, Höhe im Inspector wie die Zeile.

- [ ] Tests: zwei Klicks auf dieselbe Kachel ergeben zwei Elemente mit 40 px Versatz. Klick auf den Text «Fachbereich zeigen» schaltet um. Farbwahl zeigt «Warmweiss» statt eines Rohnamens, keine Option ist abgeschnitten (`scrollWidth <= clientWidth`). Banner-e2e bleibt grün.
- [ ] Screenshot der Startseite des Studios: Kacheln ohne Akzentfarbe, im Report bestätigen.
- [ ] Umsetzen mit `impeccable:impeccable`, Gate für beide Tools, Commit `studio: library offset and hint, readable tag options, clickable switch label`.

### Task 13: Kleinigkeiten Öffnen, Einfügen, Korn (#24)

**Files:**
- Modify: `src/ui/StartPage.tsx` (:62 bis :76, :215), `src/ui/clipboard.ts` (:15, :53 bis :77), `src/ui/contextMenuItems.ts` (:42 bis :48), `src/canvas/SlideBackground.tsx` (:22 bis :84)
- Test: `e2e/tabler.spec.ts`, `e2e/clipboard.spec.ts`, `e2e/grain-knob.spec.ts`, `src/ui/clipboard.test.ts`

**Interfaces:**
- `open(id)`: Sperre wie `creatingNow` (Ref), der Knopf zeigt «Wird geöffnet …» und ist `aria-disabled`, die ganze Liste ist solange nicht bedienbar.
- Rechtsklick «Einfügen» ist immer aktiv. Ist der interne Speicher leer, liest `pasteClipboard` ein Bild über `navigator.clipboard.read()`. Ohne Bild oder ohne Berechtigung: Meldung «Einfügen: drücke Strg + V.» (Text gibt es schon).
- `useBackgroundCanvas` behält nach dem Loslassen die Vorschau-Canvas, bis die volle fertig ist (wie `effects.ts:108`).

- [ ] Tests: `tabler.spec.ts` mit langsamer Datei: Doppelklick auf «Öffnen» lädt das Projekt einmal, der Knopf zeigt «Wird geöffnet …». Kontextmenü «Einfügen» mit einem PNG in der Systemablage (Playwright-Berechtigung `clipboard-read`) legt ein Foto an, mit verweigerter Berechtigung erscheint die Meldung. Korn: mit 4× Drosselung und verzögerter voller Rechnung (Testhaken) ist nach dem Loslassen in keinem Frame der flache `Rect` sichtbar.
- [ ] Umsetzen, Gate, Commit `studio: guard project opening, paste from system clipboard, no flat flash after grain`.

### Task 14: Kurzanleitung (#17)

**Files:**
- Create: `src/ui/HelpDialog.tsx` (Vorbild `LicensesDialog.tsx`)
- Modify: `src/ui/StartPage.tsx`, `src/ui/Header.tsx`
- Test: neu `e2e/help.spec.ts`

**Interfaces:** Knopf «Kurzanleitung» auf der Startseite und als Icon-Knopf «Hilfe» in der Kopfzeile. Dialog mit sechs Schritten, je ein Satz bis zwei: Format wählen, Layout wählen, Foto oder Video einfügen, Text und Standort anpassen, Exportieren (ZIP oder Ordner), Projektdatei sichern. Dazu ein Absatz «Deine Daten»: alles bleibt im Browser auf diesem Gerät, nichts wird hochgeladen, die Projektdatei ist deine Sicherung. Text mit `design:ux-copy` schreiben, keine Bilder.

- [ ] Test: Dialog öffnet von beiden Stellen, Fokus liegt im Dialog, Esc schliesst und gibt den Fokus zurück, kein fremder Request (`foreignRequests` aus `e2e/`).
- [ ] Umsetzen mit `impeccable:impeccable`, Screenshot, Gate, Commit `studio: quick guide dialog`.

---

## Abschluss pro Bahn

- [ ] Gesamt-Review durch den Controller, eine Fix-Runde, ein Re-Review.
- [ ] Volles Gate auf dem Branch: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.
- [ ] PR mit `Closes #…` laut Tabelle, erledigte Punkte in den Issues abhaken, offene Punkte als Kommentar. Neue Handtest-Punkte (Ordner-Export im Schulnetz, Rahmen am Video, Zwischenablage-Berechtigung) in #28 ergänzen.
- [ ] Vorschau-Link an Alexej, Merge erst nach grüner CI und Rückfrage. Danach Plan nach `docs/archiv/`.
