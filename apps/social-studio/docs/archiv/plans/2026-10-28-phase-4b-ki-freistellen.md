# Phase 4b KI-Freistellen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Klick auf «Hintergrund entfernen» setzt die Maske am Foto. Dazu «Als Sticker kopieren» und «Motiv vor Titel», beide aus dem freigestellten Foto.

**Architecture:** Ein `AiTool` (neue Registry) liefert aus einem Foto eine Maske im Pixelraum des Fotos. Das Modell läuft in einem Web Worker (transformers.js, WebGPU mit WASM-Fallback). Das Ergebnis wird über dieselbe Schreibkette wie der Pinsel in die Maske des Fotos geschrieben (`maskOps`, ein Undo-Schritt). Sticker und «Motiv vor Titel» sind Kopien eines maskierten Fotos mit dem vorhandenen Duplizieren, nur anders platziert.

**Tech Stack:** bestehend, neu `@huggingface/transformers` 3.8.x (4.3.2 scheitert, siehe Task 1), Modell ISNet fp16 samt onnxruntime-web. Neuer Request nach aussen: GET auf die Modelldateien bei Hugging Face.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Masken und KI-Freistellen» (Entscheide Phase 4b), dazu Abschnitt 9 (CSP) und 12 (Modellquelle konfigurierbar).

## Global Constraints
- Kein Foto, keine Maske, keine Projektdatei verlässt den Browser. Einzige erlaubte neue Requests: GET auf Modelldateien (Hugging Face). Kein POST, keine Bilddaten in URLs, kein Laufzeit-CDN: die WASM- und Laufzeitdateien von onnxruntime liegen auf der eigenen Herkunft.
- Werte (Modell-ID, Quelle, Eingabegrösse, Schwellen, Grössenangabe «ca. X MB») nur in `src/tokens.ts`. Texte Deutsch, Schweizer Schreibweise, Du-Form, «…», keine Halbgeviertstriche.
- Dateien unter 400 Zeilen (`PhotoNode.tsx` und `MaskTool.tsx` sind nah dran: nichts dort anhängen). Der Kern importiert keine Plugins, Erweiterung über die Registry `aiTools`.
- **Kein neuer Elementtyp.** Ein freigestelltes Bild bleibt ein Foto (`photo`) mit Maske; «Sticker» ist nur eine Kopie davon, kein eigener Typ, kein eigenes Schema. Auch ein späterer Tab «Meine Sticker» setzt nur Fotos ein, mit oder ohne Alphakanal. Möglichst wenig neuer Code: vorhandene Wege (Duplizieren, Maske, Schreibkette) wiederverwenden.
- Nur am Foto, nie am Video. Schema bleibt 1, keine neuen Dokumentfelder nötig.
- Schwache Windows-Geräte: das Modell läuft nie im Hauptthread, Foto vor dem Modell auf die Eingabegrösse verkleinert, Speicher nach dem Lauf freigeben, Oberfläche bleibt bedienbar, Abbrechen wirkt.
- Neue Oberfläche nur Struktur des Pen-Entwurfs (Artboards «Panel Foto: Maske», «Maske (Pinselmodus)»; nur über Pencil lesen), vorhandene Komponenten, kein eigenes Styling, keine neuen Farben. Fokus sichtbar, `aria-disabled` statt `disabled`, jeder Icon-Knopf mit `aria-label` und `data-tip`.
- Gate vor jedem Commit: typecheck, lint, test, test:e2e. Ergebnis in Edge ansehen, Export öffnen.

## Review Focus
- Modell nicht erreichbar (Schulnetz sperrt Hugging Face, Verbindung bricht beim Download ab): klare Meldung mit Hinweis auf die Netzsperre, kein ewiges Laden, nächster Klick versucht es neu.
- Foto wird während des Laufs gelöscht, ersetzt oder die Maske wird von Hand geändert (Pinsel, Umkehren, Zurücksetzen): das KI-Ergebnis wird verworfen mit Meldung und überschreibt nichts.
- Modell findet kein Motiv (fast alles leer oder fast alles voll): Meldung «Kein Motiv gefunden», Maske bleibt unverändert.
- Sehr grosses Foto (4096 px), sehr schmales Foto, Foto mit EXIF-Drehung, PNG mit Alphakanal: Maske liegt deckungsgleich, kein Speicherabsturz.
- Zwei Klicks hintereinander oder zwei Fotos kurz nacheinander: höchstens ein Lauf zugleich, der zweite Knopf ist `aria-disabled` mit Erklärung, nichts hängt.
- WebGPU fehlt oder bricht ab (Speicher): automatischer Wechsel auf WASM, nicht auf «kaputt».
- Undo nach Freistellen ist genau ein Schritt; Projektdatei sichern und öffnen behält die Maske.

## Dateistruktur
- Neu `src/ai/`: `segmentWorker.ts` (Worker, lädt Modell, rechnet), `segmentClient.ts` (Worker starten, Fortschritt, Abbruch, Fallback), `toMask.ts` (reine Umrechnung Modellausgabe in `Mask`, mit Test).
- Neu `src/plugins/ai/freistellen.ts` (registriert das `AiTool`), `src/plugins/elements/photo/cutoutOps.ts` (Maske setzen, Sticker, Motiv vor Titel; mit Test), `src/plugins/elements/photo/CutoutControls.tsx` (Knöpfe und Anzeige «KI läuft»).
- Ändern: `src/core/types.ts` und `registries.ts` (`AiTool`, `aiTools`), `src/plugins/registerPlugins.ts`, `src/tokens.ts`, `src/store/ui.ts` (KI-Lauf: Phase, Fortschritt, Foto-ID, nie in der History), `maskOps.ts` (Schreibweg für eine fertige Maske), `MaskSection.tsx`, `public/_headers`, `docs/deployment.md`, `src/ui/LicensesDialog.tsx`, `public/licenses/`, `e2e/network.spec.ts`, `vite.config.ts` falls die Laufzeitdateien kopiert werden müssen.

### Task 1: Modellvergleich und Lizenzprüfung (Entscheid mit Alexej)
**Files:** Create `scripts/model-vergleich/` (Wegwerf-Seite oder Skript, nicht in die App), `docs/research/2026-10-28-freistellen-modellvergleich.md` (kurz, eine Tabelle). Keine Änderung an `src/`.
**Interfaces:** Produces: die gewählte Modell-ID, Eingabegrösse, Datentyp (fp32, fp16 oder quantisiert), Dateigrösse und Quelle, eingetragen in die Spezifikation. Task 3 liest sie.
- [ ] Lizenz jedes Kandidaten an der Quelle lesen (Modellkarte und LICENSE bei Hugging Face und im Projekt-Repo): RMBG-2.0, BiRefNet, BiRefNet_lite. Zulässig ist nur, was ein Berufsbildungszentrum ohne eigene Vereinbarung einsetzen und die App ausliefern darf. Wortlaut der Lizenz und Link in die Tabelle.
- [ ] Die zulässigen Kandidaten in Edge mit transformers.js laufen lassen, je WebGPU und WASM, an den Fotos in `e2e/fixtures` und mindestens drei echten Fotos von Alexej (Haare, Helm, Gruppenbild; nur lokal, nie ins Repo). Pro Modell festhalten: Dateigrösse, Laufzeit (Mac und mit 4× CPU-Drosselung), Speicherbedarf, ob WebGPU überhaupt läuft (für BiRefNet_lite sind Speicherfehler gemeldet), Kantenqualität als Bildvergleich.
- [ ] Ergebnis mit Empfehlung an Alexej zeigen. **Halt: Alexej wählt das Modell**, danach Entscheid in die Spezifikation. Task 2 und 3 laufen erst danach.

### Task 2: Schnittstelle `AiTool` und Maske setzen
**Files:** Create `src/ai/toMask.ts` und Test, `src/plugins/elements/photo/cutoutOps.ts` und Test; Modify `src/core/types.ts`, `src/core/registries.ts`, `maskOps.ts`, `src/tokens.ts`.
**Interfaces:**
- Produces: `interface AiTool { id: string; name: string; run(image: Blob, opts: { signal: AbortSignal; onProgress(p: { phase: 'download' | 'run'; fraction: number }): void }): Promise<{ width: number; height: number; alpha: Uint8ClampedArray }> }` und `aiTools = createRegistry<AiTool>('KI-Werkzeug')`.
- Produces: `maskFromAlpha(a: { width; height; alpha }, target: { width; height }): Mask` (in `src/ai/toMask.ts`, skaliert bilinear auf die Maskengrösse des Fotos, `maskSize` aus `src/model/mask.ts`) und `hasSubject(m: Mask): boolean` (falsch, wenn weniger als `tokens.cutout.minCover` oder mehr als `tokens.cutout.maxCover` der Fläche sichtbar ist).
- Produces: `setMaskFromAi(id: string, m: Mask): Promise<void>` in `maskOps.ts`, geht durch dieselbe `enqueue`-Kette wie `changeMask`, schreibt mit `saveMask` und `applyIdle` (ein Undo-Schritt) und verwirft das Ergebnis mit Meldung, wenn sich die Maske des Fotos seit dem Start geändert hat oder das Foto weg ist. Der Aufrufer übergibt dafür `from: string | undefined` (die Masken-ID beim Start).
- [ ] Tests zuerst: `maskFromAlpha` ändert Seitenverhältnis nicht und trifft bei 2:1 Eingabe die richtigen Pixel; `hasSubject` für leer, voll, Mitte gefüllt; `setMaskFromAi` schreibt Maske und Asset-Eintrag, ist mit einem Undo weg, verwirft bei geänderter Maske (Meldung, Dokument unverändert), verwirft bei gelöschtem Foto, läuft nach einem ausstehenden Strich in der Kette (Reihenfolge).
- [ ] Umsetzen wie beschrieben, Werte `tokens.cutout` ({ minCover, maxCover }) in `src/tokens.ts`. Gate, Commit.

### Task 3: Worker, Modell, CSP, Lizenzen
**Files:** Create `src/ai/segmentWorker.ts`, `src/ai/segmentClient.ts`, `src/plugins/ai/freistellen.ts` (Registrierung); Modify `package.json` (transformers.js, exakte Version), `src/plugins/registerPlugins.ts`, `src/tokens.ts` (`tokens.cutout.model`: Modell-ID, Quelle, Eingabegrösse, Datentyp, `downloadMB` aus Task 1), `public/_headers`, `docs/deployment.md`, `src/ui/LicensesDialog.tsx`, `public/licenses/` (transformers.js, onnxruntime-web und die Modelllizenz), `vite.config.ts` nach Bedarf, `e2e/network.spec.ts` (Anpassung kommt in Task 6).
**Interfaces:**
- Consumes: `AiTool` aus Task 2, Modellentscheid aus Task 1 (ISNet fp16, Werte und Normalisierung in `.superpowers/.../task-1-report.md` und `docs/research/2026-10-28-freistellen-modellvergleich.md`: Modell läuft über das generische `AutoModel`, Ausgabe min-max normalisieren, nicht sigmoid).
- Produces: das registrierte Werkzeug `aiTools.get('freistellen')`; `segmentClient` bietet `run(image, opts)` wie `AiTool.run`, mit einem einzigen Worker (zweiter Aufruf bei laufendem Lauf wirft einen Fehler `AiBusy`), Abbruch beendet den Worker, nächster Lauf startet neu. Der Lauf versucht WebGPU und fällt bei jedem Fehler auf WASM zurück, bevor er scheitert.
- [ ] Test zuerst (Vitest, ohne Modell): `segmentClient` mit einem Test-Worker: Fortschritt kommt an, Abbruch beendet und meldet `AbortError`, zweiter paralleler Aufruf wirft `AiBusy`, Fehler im ersten Backend führt zum zweiten Backend. Dazu der Test-Hook, über den e2e-Tests das Backend durch eine feste Maske ersetzen (nur im Testbuild, nie in `dist`).
- [ ] Laufzeitdateien von onnxruntime (WASM) auf die eigene Herkunft legen und transformers.js darauf zeigen lassen, damit kein CDN nötig ist. Prüfen, dass im Build kein Verweis auf eine fremde Adresse bleibt (grep im `dist/`).
- [ ] CSP: `connect-src` um genau die Hosts erweitern, die der Download wirklich braucht (Weiterleitungen von huggingface.co auf den Dateispeicher in einem Netzwerkmitschnitt ermitteln, keine Platzhalter über mehr als nötig). `worker-src` und `script-src` prüfen. Eintrag in `public/_headers` und `docs/deployment.md`, Lizenzen unter `public/licenses/` und im Lizenzen-Dialog.
- [ ] Gate, einmal von Hand in Edge mit dem echten Modell: Download mit Fortschritt, zweiter Lauf ohne neuen Download (Cache). Commit.

### Task 4: «Hintergrund entfernen» im Abschnitt «Maske»
**Files:** Create `CutoutControls.tsx`; Modify `MaskSection.tsx`, `src/store/ui.ts` und Test, `cutoutOps.ts`, `src/ui/keys.ts` nur falls ein Kürzel nötig wird (keines geplant); Create `e2e/cutout.spec.ts`.
**Interfaces:**
- Consumes: `aiTools`, `maskFromAlpha`, `hasSubject`, `setMaskFromAi`, `segmentClient`.
- Produces: `removeBackground(id: string): Promise<void>` in `cutoutOps.ts` (Foto laden, Lauf starten, Ergebnis prüfen, schreiben; Fehler und «Kein Motiv gefunden» als Meldung) und `cancelRemoveBackground(): void`; im UI-Store `ai: { id: string; phase: 'download' | 'run'; fraction: number } | undefined`.
- [ ] Tests zuerst: Store-Test für den Ablauf der Phasen und das Zurücksetzen nach Fehler und Abbruch; `removeBackground` mit Test-Werkzeug: Erfolg setzt die Maske, leeres Ergebnis meldet «Kein Motiv gefunden» und lässt die Maske, Netzfehler meldet die Netz-Meldung mit Hinweis auf Sperre, zweiter Aufruf bei laufendem Lauf ändert nichts.
- [ ] Oberfläche in der Struktur des Entwurfs: «Hintergrund entfernen» als grosser Knopf zuoberst im Abschnitt, darunter «Maske bearbeiten», die übrigen Knöpfe wie heute. Während des Laufs ersetzt eine Zeile den Knopf: «Modell wird geladen, einmalig ca. X MB» mit Prozent bzw. «Foto wird freigestellt …» und ein Knopf «Abbrechen». Beim Foto ohne Maske und mit Maske gleiche Beschriftung. Während des Laufs sind die Pinsel- und Maskenknöpfe dieses Fotos `aria-disabled` («Die Freistellung läuft noch»). Nicht am Video. Mit `/impeccable` auf Struktur und Barrierefreiheit prüfen.
- [ ] e2e mit dem Test-Hook (feste Kreismaske): Klick, Maske sichtbar im Export (Pixelprobe), Strg + Z macht sie rückgängig, Abbrechen vor dem Ende lässt das Foto unberührt, Foto während des Laufs löschen verwirft das Ergebnis. Gate, Commit.

### Task 5: Sticker und «Motiv vor Titel»
**Files:** Modify `cutoutOps.ts`, `CutoutControls.tsx`, `MaskSection.tsx`; Test `cutoutOps.test.ts`, `e2e/cutout.spec.ts`; Modify `src/model/elements.ts` nur falls ein Helfer für die Platzierung fehlt.
**Interfaces:**
- Consumes: `duplicateElement` (`src/model/elements.ts`), Maske am Foto.
- Produces: `copyAsSticker(id: string): string | undefined` (neue Foto-ID: Kopie mit Maske, wie «Duplizieren» versetzt, ganz oben, ausgewählt) und `copyBehindTitle(id: string): string | undefined` (Kopie mit Maske, deckungsgleich, direkt über dem Titel der Slide); beides ein Undo-Schritt, `undefined` ohne Maske oder ohne Titel.
- [ ] Titel der Slide klären: Layouts setzen `Element.role` (siehe `src/plugins/layouts/presets/`). Der Titel ist das Textelement der Slide mit der Rolle für den Titel; gibt es keines, gilt das oberste Textelement mit grösster Schrift. Gibt es gar keinen Text, ist der Knopf `aria-disabled` («Auf dieser Slide fehlt ein Titel»). Der Entscheid mit Begründung ins Ledger.
- [ ] Tests zuerst: Sticker hat dieselbe Maske und `assetId`, liegt über allem, Original unverändert; Motiv vor Titel hat gleiche Position, Grösse, Ausschnitt und Drehung wie das Original und steht in `order` direkt über dem Titel; beide ohne Maske: nichts geschieht, Knopf erklärt warum; Undo entfernt die Kopie in einem Schritt; Kopie über die Projektdatei erhalten.
- [ ] Zwei Knöpfe im Abschnitt «Maske» (Icons aus Tabler, in `DESIGN.md` festhalten), beschriftet «Als Sticker kopieren» und «Motiv vor Titel». e2e: Foto freistellen (Test-Hook), beide Knöpfe, Export zeigt das Motiv über dem Titel (Pixelprobe). Gate, Commit.

### Task 6: Netzwerk, Echtmodell, Leistung, Doku
**Files:** Modify `e2e/network.spec.ts`, `docs/windows-checkliste.md`, `docs/roadmap.md`, `docs/deployment.md`, Specs, `docs/superpowers/naechste-session.md`.
- [ ] Netzwerk-Test erweitern: im normalen Ablauf weiterhin kein Request nach aussen (Test bleibt streng). Neuer Test «Freistellen»: Modell-Hosts per `page.route` bedient oder durchgelassen, erlaubt ist nur GET auf die in Task 3 ermittelten Hosts, nie `postData`, nie ein Request, dessen URL Bilddaten enthält, nie ein Host ausserhalb der Liste. Der Test muss scheitern, wenn man einen fremden Host oder ein POST einbaut (einmal zur Probe tun und im Bericht nennen).
- [ ] Einmal mit dem echten Modell in Edge (nicht in der Pipeline): echtes Foto, Maske im Export, Dauer auf dem Mac und mit 4× Drosselung, Speicher im Task-Manager, WASM-Fallback erzwungen (WebGPU abschalten). Werte in den Bericht und in `docs/research/2026-10-28-freistellen-modellvergleich.md`.
- [ ] Checkliste Windows (neuer Block «Phase 4b»): Download im Schulnetz, WebGPU und Fallback, Dauer und Speicher auf dem schwachen Gerät, Abbrechen, Kantenqualität an echten Fotos, Meldungen verständlich. Roadmap auf «erledigt, Live-Test offen» kürzen, Plan nach `docs/archiv/plans/`, `naechste-session.md` für 4c neu schreiben (Hinweis: «KI läuft» im Pen-Entwurf noch nicht gestaltet, Zustände aus Task 4 im Entwurf nachziehen).
- [ ] Gesamt-Review des Branches (stärkstes Modell), eine Fix-Runde, Gate. Merge in `main`, Rückfrage vor Push und Deploy.
