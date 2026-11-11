# Phase 3 Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Videos (und HEIC-Fotos) einfügen, kürzen, mit Look, Verlauf und Korn vorab ansehen und als MP4 exportieren.

**Architecture:** Video = `photo`-Element mit Feld `video` (Spec «Entscheide Phase 3»). Editor: Startbild per `<video>`-Element in den bestehenden Effekt-Pfad (`useEffectCanvas`), Vorschau-Schleife nur zur Laufzeit. Export: Mediabunny dekodiert Frames, jeder Frame läuft durch dieselben Effekte und `renderSlide`, ein MP4 je Video-Slide. Erweiterung über Registries (`VideoExporter` neu in `core/`).

**Tech Stack:** Mediabunny (WebCodecs, MP4), HEIC-WASM-Bibliothek (Wahl in Task 1), Vitest, Playwright (Edge), ffmpeg (nur zum Erzeugen von Testvideos).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 3 «Video»» und «Export»

## Global Constraints
- Kein Request nach aussen, CSP bleibt (`connect-src 'self'`, `media-src blob:`, `wasm-unsafe-eval` ist schon da). Neue Bibliotheken nur gebündelt, schwere in eigenen Chunks (Hauptpaket wächst nicht, Chunkgrössen im Bericht).
- Schwache Zielgeräte: Vorschau höchstens 540 px, kein Store-Schreiben pro Frame, Export ein Slide nach dem anderen, Frames sofort freigeben (`VideoFrame.close()`, Canvas freigeben). Messen mit 4× CPU-Drosselung.
- Werte (Bitrate, fps 30, 1080, 60 s, 500 MB, Mindestlänge 1 s) nur in `src/tokens.ts`. Kein Hex ausser Tokens. Texte Deutsch (Schweizer Schreibweise, Du-Form, «…»), keine Halbgeviertstriche. Dateien unter 400 Zeilen, Kern importiert keine Plugins, Fotos und Altprojekte laden unverändert (`video` optional, `schemaVersion` bleibt 1).
- Testvideos erzeugt ein Skript mit ffmpeg (kleine Clips, H.264 mit Ton, ein HEVC-Clip für die Fehlerprüfung); keine echten Aufnahmen committen.
- Test zuerst für Logik, Gate vor jedem Commit, Ergebnis in Edge ansehen, exportierte MP4 öffnen.

## Review Focus
- Exportierte MP4: Dauer = gekürztes Stück (±1 Frame), 1080 px breit, 30 fps, Ton nur wenn gewählt. Erstes Frame stimmt pixelnah mit dem Editor-Startbild überein (Look, Verlauf, Korn).
- Vorschau und Export zeigen dasselbe Bild (gleicher Ausschnitt, gleiche Effekt-Reihenfolge Look, Verlauf, Korn); Vorschau läuft in Schleife und endet sauber bei Auswahl-, Slide- und Moduswechsel (kein hängender Timer, keine offene `VideoFrame`).
- Altprojekt und Foto-Pfad unverändert (Golden-Tests grün); Video-Element schaltet Rahmen, Bildregler, Spiegeln, Freistellen in Inspector und Menü aus.
- Projektdatei ohne Video lädt und sichert sauber, fehlendes Video zeigt Platzhalter und bricht den Export mit Meldung ab; Umlegen von `packsAsset` genügt später für Videos in der Datei.
- Fehlerfälle mit klarer Meldung: HEVC nicht dekodierbar, kein H.264- oder AAC-Encoder, Speicher voll, Abbruch mitten im Export (kein halbes ZIP, Oberfläche wieder frei).
- Leistung: Import einer 60-s-Datei und Export einer 15-s-Slide auf 4× Drosselung messen und im Bericht nennen.

### Task 1: Spike (wegwerfen, nur Messwerte und Entscheide)
**Files:** `scripts/make-test-videos.sh` (bleibt), Wegwerf-Seite im Scratchpad; Ergebnis als Ledger-Eintrag.
- [ ] Mediabunny und eine HEIC-Bibliothek (`heic-to` gegen `libheif-js`: Grösse, Pflege, Edge) in Edge ausprobieren. Zu klären, je mit Messwert: (a) Dekodierbarkeit prüfen (`canDecode`) für H.264 und HEVC; (b) Zeit je Frame für Dekodieren, Look (`lookPixels` auf 1080 × 1350), Verlauf und Korn, Encoden (H.264) auf Mac und mit 4× Drosselung; (c) ist AAC-Encoding in Edge da, sonst Opus-in-MP4 prüfen (Instagram verlangt AAC); (d) Orientierung (iPhone-Drehmetadaten) und Variable Framerate; (e) Zeit und Speicher für `renderSlide` je Frame (Klon der Ebene) gegenüber «Hintergrund einmal, Video und Overlays je Frame».
- [ ] Entscheide festhalten: Bibliothek fürs HEIC, Frame-Pfad im Export (einfach pro Frame vs. Schichten), Look je Frame in JS oder per Tabelle, ob 30 s auf schwachem Gerät in vertretbarer Zeit gehen. Fällt ein Wert unter «brauchbar» (Export länger als etwa das Vierfache der Videolänge), Alexej melden, bevor Task 5 beginnt.

### Task 2: Modell, Speichern, Projektdatei
**Files:** Modify `src/plugins/elements/photo/schema.ts` (`video` mit zod: `start`, `end`, `sound`, `duration`; `videoOf`, `isVideo`), `src/model/elements.ts` (`assetIdOf` unverändert nutzbar), `src/storage/assets.ts` (Hash für Videos nach Spec), `src/projectFile/projectFile.ts` (`packsAsset`, tolerantes `unpackProject`), `src/core/types.ts` (`timeBased` raus, `VideoExporter`), `src/core/registries.ts`; Tests dazu.
- [ ] Tests: Schema akzeptiert Foto ohne `video` und mit `video` (end > start, Mindestlänge, innerhalb `duration`), lehnt Unsinn ab; `copyElements` und Duplizieren behalten `video`; Hash-Funktion gleich für gleiche Datei, verschieden bei geändertem Ende; `packProject` lässt Video-Assets weg und führt sie in `project.json`; `unpackProject` akzeptiert ein Projekt mit fehlendem Video-Asset (Foto-Asset fehlt weiterhin Fehler). Rot, umsetzen, Gate, Commit.

### Task 3: Import (Video, HEIC, Fehlerfälle)
**Files:** Create `src/plugins/elements/photo/importVideo.ts`, `heic.ts` (lazy `import()`); Modify `importImage.ts` (HEIC über `heic.ts`), `fromFile.ts`, `index.tsx` (`acceptsFile`, Beschriftung «Foto oder Video»), `pickImage` (accept), `tokens.ts`.
- [ ] Tests (Vitest, wo ohne Browser möglich: Grenzenprüfung, Fehlertexte, Element-Aufbau; sonst e2e): Videodatei → Asset (Mime `video/…`, Breite/Höhe nach Drehung) und Element mit `video { start: 0, end: min(duration, 60), sound: false }`; Warnung bei > 60 s oder > 500 MB (Import klappt, Meldung); nicht dekodierbar (HEVC-Clip auf einem Browser ohne Dekoder: im Test über einen künstlich ablehnenden Probe-Aufruf) → Meldung mit Anleitung, kein Element; Drop in leeren Platzhalter und «Foto ersetzen» mit Video und umgekehrt (`fillPhoto`); ein Fehler hinterlässt kein Element; HEIC-Datei → JPEG, richtig gedreht, EXIF raus. Rot, umsetzen, Gate, Commit.

### Task 4: Editor-Darstellung
**Files:** Create `src/canvas/useVideoFrame.ts`; Modify `src/plugins/elements/photo/PhotoNode.tsx` (Quelle `img` kann ein Video-Frame-Canvas sein; Schlüssel für `useEffectCanvas` enthält `start`), `src/canvas/images.ts` (`loadAssetImage` für Video nicht aufrufen; fehlendes Video = `MISSING_IMAGE_NODE` mit Meldung «Video fehlt …»), `src/plugins/elements/photo/PhotoInspector.tsx` (Rahmen, Bildregler, Spiegeln, Freistellen ausblenden bei Video), `index.tsx` (`menuItems`).
- [ ] Tests (e2e): Video einfügen zeigt das Startbild mit Look; Änderung von `start` zeigt ein anderes Bild (Pixelprobe); Effekte (Korn, Verlauf) wirken; Foto-Elemente und alle Golden-Tests unverändert; Projekt neu laden: Video wieder da; Projekt aus Datei ohne Video: Platzhalter-Meldung. Rot, umsetzen, Gate, Commit.

### Task 5: Kürzen und Vorschau im Inspector
**Files:** Create `src/plugins/elements/photo/VideoSection.tsx` (Abschnitt «Video»: Regler Start und Ende, zwei Vorschaubilder, Schalter «Ton», Play-Knopf), `src/plugins/elements/photo/usePreview.ts` (Schleife, Aufräumen); Modify `PhotoInspector.tsx`, `src/ui/keys.ts` falls ein Kürzel (keins vorgesehen).
- [ ] Tests: Regelung (reine Funktion): Start < Ende − Mindestlänge, Klemmen an 0 und `duration`, ein Undo-Schritt je Geste; e2e: Ziehen verändert Vorschaubilder (erstes und letztes Frame ändern sich), Leinwand zeigt Startbild, Ton-Schalter setzt `sound`, Play startet Schleife, Auswahl- und Slidewechsel stoppen sie (kein Timer bleibt), Undo/Redo nicht durch Play berührt, Tastatur bedienbar, Beschriftungen. Rot, umsetzen, `/impeccable` auf den Abschnitt (schlicht, eckig), Gate, Commit.

### Task 6: MP4-Export
**Files:** Create `src/plugins/exporters/mp4.ts` (`VideoExporter`), `src/export/exportVideoSlide.ts`; Modify `src/export/exportZip.ts` (Slide-Typ erkennen, MP4 oder Bild, Abbruch, Fortschritt), `src/plugins/index.ts`.
- [ ] Tests: Mathematik (reine Funktionen): Slide ist Video-Slide, wenn ein sichtbares Video-Element sie schneidet; Dauer = längstes gekürztes Video, höchstens 60 s; Frame-Zeiten bei 30 fps und Start-Offset; Ton-Quelle = erstes sichtbares Video mit Ton an. e2e: ZIP enthält `_01.jpg` und `_02.mp4` bei gemischtem Projekt; MP4 mit Mediabunny auslesen: Dauer, 1080 px, 30 fps, Ton nur wenn an; erstes Frame gegen Editor-Startbild (Toleranz, in Task 4 festgelegt); Abbruch lässt kein ZIP zurück; kein H.264-Encoder (simuliert) → Meldung, nichts exportiert; Netzwerktest bleibt grün. Rot, umsetzen (Ergebnis aus Task 1 für den Frame-Pfad), Gate, Commit.

### Task 7: Export-Dialog und Slide-Leiste
**Files:** Modify `src/ui/ExportDialog.tsx`, `src/ui/SlideBar.tsx`, `src/ui/app.css`, `DESIGN.md`.
- [ ] Tests (e2e): Liste zeigt je Slide «Bild» oder «Video»; Hinweis «LinkedIn erlaubt keine Videos in einem Bildkarussell.» nur bei Video-Slides, unabhängig vom Kanal; Fortschritt in Prozent und «Abbrechen» während des Exports; Kachel mit Video trägt ein Video-Symbol (Tooltip, Name) und bleibt bei 1280 px einzeilig. Rot, umsetzen, `/impeccable critique`, Gate, Commit.

### Task 8: Abschluss
- [ ] Gesamt-Review des Branches (stärkstes Modell), Fix-Runde, Re-Review. Leistung auf 4× Drosselung im Bericht.
- [ ] Doku: `docs/windows-checkliste.md` (iPhone-Video H.264 und HEVC, HEIC, Ton, 30-s-Export auf dem Schulgerät, Edge-Encoder), `docs/roadmap.md` (3 erledigt; Ideenspeicher: Zeitleiste, Panorama-Video, Videos in der Projektdatei, Bildregler/Rahmen am Video), Plan und Phasenlog nach `docs/archiv/`, `naechste-session.md` neu, `CLAUDE.md` Architekturzeile (Mediabunny im Einsatz).
- [ ] Merge in `main`, danach Alexej fragen wegen Push und Deploy (CSP unverändert prüfen), Live-Bundle prüfen.
