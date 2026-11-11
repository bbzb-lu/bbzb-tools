# Phase 2.7 «Tabler-Icons» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lucide durch Tabler ersetzen (Oberfläche, Markenicons, Pin) und in der Bibliothek alle Tabler-Outline-Icons per englischer Suchleiste wählbar machen.

**Architecture:** Ein Skript erzeugt aus `@tabler/icons` die Datei `brand/tabler/outline.json` (Name → Pfade und Stichwörter). Zur Laufzeit lädt `src/brand/tabler.ts` sie als eigenen Chunk, baut daraus SVG-Data-URLs und `BrandAsset`s mit Id `tabler-<name>` und sucht darin. Das Element `brand` bleibt unverändert, nur die Auflösung der Id kennt jetzt auch `tabler-*`. Die 43 UI-Icons kommen aus `@tabler/icons-react`.

**Tech Stack:** React 19, TypeScript strict, `@tabler/icons` und `@tabler/icons-react` 3.49.0 (exakt, MIT), Vite, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 2.7». Dazu `CLAUDE.md`, `DESIGN.md`, `docs/superpowers/workflow.md`.

## Global Constraints
- Kein Request nach aussen: die Icon-Datei kommt von der eigenen Herkunft, kein CDN (Netzwerk-Test bleibt grün, CSP `connect-src 'self'` unverändert).
- Das Hauptpaket wächst nicht um die Icon-Daten (eigener Chunk bzw. eigene Datei, nur bei Bedarf geladen).
- Pfaddaten werden vor dem Einsetzen in ein SVG geprüft (nur Zeichen aus `0-9 MmLlHhVvCcSsQqTtAaZz .,-+eE` und Leerraum), Namen nur `[a-z0-9-]`.
- UI-Texte Deutsch, Schweizer Rechtschreibung, «…», Du-Form, kurz, kein Halbgeviertstrich (–). Englisch bleibt nur der Hinweistext zu den Suchbegriffen.
- Werte nur in `src/tokens.ts`; Dateien unter 400 Zeilen; Kern importiert keine Plugins direkt; Asset-Pfade nur im Manifest bzw. im Tabler-Modul (Architekturtest in `src/brand/manifest.test.ts` anpassen, nicht abschwächen).
- Icons der Oberfläche: Einzelimport, 18 px, `aria-hidden`; Icon-Knopf `.icon-btn` mit `aria-label` und `data-tip`.
- Altprojekte bleiben gültig (Ids `icon-*` und `scribble-*` unverändert, keine `schemaVersion`-Änderung).
- Schwache Windows-Geräte: Suche mit 150 ms Pause, höchstens 120 Kacheln, kein Rendern pro Taste über die Trefferzahl hinaus.
- Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test`, bei UI/Export `npm run test:e2e`. Tests nie abschwächen.
- Branch `phase-2-7` von `main`. Commit-Nachrichten Englisch, Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` und `Claude-Session: https://claude.ai/code/session_011UnvVUvTxhAHWWv9Umd4g3`.

## Review Focus
- Projekt mit einem Tabler-Icon speichern, Seite neu laden, Projekt öffnen: Icon erscheint ohne manuelle Suche, ohne kurz aufblitzende Fehlermeldung.
- Export direkt nach dem Öffnen (Datei noch nicht geladen): wartet, bricht nicht mit «Ein Scribble oder Icon fehlt» ab.
- Unbekannter Tabler-Name in einer Projektdatei: Platzhalter und Meldung, kein Absturz.
- Suche: leerer Text zeigt die 5 Markenicons, Gross-/Kleinschreibung egal, Leerzeichen am Rand egal, keine Treffer gibt eine klare deutsche Meldung mit Hinweis auf Englisch, Tastatur (Pfeile, Enter) wie im Raster.
- Altes Projekt mit `icon-map-pin` und Ort-Tag: Pin sitzt weiter in der Icon-Box (Pixelvergleich), Export gleich Leinwand.
- Kein Lucide mehr: kein Import, keine Abhängigkeit, kein Hinweis in CLAUDE.md oder Doku.

---

### Task 1: Icon-Daten erzeugen

**Files:**
- Create: `scripts/build-tabler.mjs`, `brand/tabler/outline.json` (erzeugt, wird committet), `brand/tabler/LICENSE` (MIT-Text von Tabler), `src/brand/tablerData.test.ts`
- Modify: `package.json` (Dev-Abhängigkeit `@tabler/icons` 3.49.0 exakt, Skript `"build:tabler": "node scripts/build-tabler.mjs"`)

**Interfaces:**
- Produces: `brand/tabler/outline.json` mit Form `{ "<name>": { "p": string[], "t": string } }` (`p` = Pfaddaten `d` aller Pfade ohne den leeren Hintergrundpfad, `t` = Stichwörter durch Leerzeichen getrennt, kleingeschrieben). Quelle: `tabler-nodes-outline.json` und `icons.json` im Paket (alle Knoten sind `path`).

- [ ] **Step 1: Failing test** `src/brand/tablerData.test.ts`: Datei lesen; mindestens 5000 Einträge; `map-pin`, `house`, `camera`, `arrow-up-right` vorhanden; jeder Name passt auf `^[a-z0-9-]+$`; jeder Eintrag hat mindestens einen Pfad, jeder Pfad besteht nur aus erlaubten Zeichen (siehe Constraints); `t` ist ein String.
- [ ] **Step 2:** `npx vitest run src/brand/tablerData.test.ts` → Expected: FAIL (Datei fehlt).
- [ ] **Step 3:** `npm i -D --save-exact @tabler/icons@3.49.0`, Skript schreiben (liest aus `node_modules/@tabler/icons`, schreibt kompaktes JSON), `npm run build:tabler` ausführen, Datei und Lizenz committen.
- [ ] **Step 4:** Test → Expected: PASS. `ls -la brand/tabler/outline.json` zeigt etwa 1.4 MB.
- [ ] **Step 5:** Commit.

### Task 2: Laufzeit, Suche und Auflösung der Ids

**Files:**
- Create: `src/brand/tabler.ts`, `src/brand/tabler.test.ts`
- Modify: die Stelle, die Markenbild-Ids auflöst (`BrandNode.tsx` `findAsset`, `src/ui/libraryItem.ts`, Export-Vorprüfung; `grep -rn "assetPacks" src` zeigt alle), Projekt-Öffnen (Vorladen), `src/brand/manifest.test.ts` (Architekturtest kennt den neuen Pfad)

**Interfaces:**
- Consumes: `brand/tabler/outline.json` aus Task 1.
- Produces (alle in `src/brand/tabler.ts`):
  - `type TablerPack = Record<string, { p: string[]; t: string }>`
  - `loadTabler(): Promise<TablerPack>` (dynamischer Import, einmal gecacht, eigener Chunk)
  - `isTablerId(id: string): boolean` (`tabler-` plus gültiger Name)
  - `tablerAsset(name: string, pack: TablerPack): BrandAsset | undefined` (Id `tabler-<name>`, `file` leer-sinnvoll, `name` = Tabler-Name, `category: 'icon'`, `defaultColor: 'akzent'`, `url` = Data-URL eines SVG: `viewBox 0 0 24 24`, `fill none`, `stroke #000`, `stroke-width 2`, Runde Enden und Ecken, nur geprüfte Pfade; `undefined` bei unbekanntem oder ungültigem Namen)
  - `searchTabler(pack: TablerPack, query: string, limit = 120): string[]` (Namen; Rangfolge: exakter Name, Namensanfang, Name enthält alle Wörter, Stichwort enthält alle Wörter; Gross-/Kleinschreibung und Randleerzeichen egal; leere Anfrage gibt `[]`)
  - `ensureTabler(ids: string[]): Promise<void>`: lädt die Datei, wenn mindestens eine Id `tabler-*` ist, und macht die Assets für `findAsset` und `insertLibraryItem` auffindbar.

- [ ] **Step 1: Failing tests** `src/brand/tabler.test.ts` (mit kleinem Test-Pack): `tablerAsset` ergibt Data-URL mit nur erlaubten Pfaden und `undefined` für `../x`, `A B`, unbekannt; `searchTabler` Rangfolge (exakt vor Anfang vor enthält vor Stichwort), Gross-/Kleinschreibung, Randleerzeichen, leere Anfrage, Limit; `isTablerId('tabler-house')` wahr, `isTablerId('icon-bike')` falsch, `isTablerId('tabler-')` falsch.
- [ ] **Step 2:** Tests laufen und scheitern.
- [ ] **Step 3:** Modul und Integration bauen. Auflösung: `BrandNode` zeigt bei noch nicht geladener Tabler-Id keinen Fehler und keine Meldung, sondern wartet (Zustand «lädt»), und erst bei bekannter Datei plus fehlendem Namen den Platzhalter mit Meldung. Projekt öffnen ruft `ensureTabler` mit allen `brandId` des Projekts vor dem ersten Zeichnen; Export ruft es ebenfalls vorher auf.
- [ ] **Step 4:** Tests grün; E2E `e2e/tabler.spec.ts`: Icon per Test-Hook (`insertBrand('tabler-house')`) einfügen, Projekt speichern und neu laden, Icon erscheint (Pixelprobe in der Akzentfarbe); direkt nach Laden exportieren (PNG): Pixel vorhanden, kein Fehlerdialog; Projekt mit unbekanntem Namen `tabler-gibtesnicht`: Platzhalter und Meldung, App läuft weiter; Netzwerk: nur Requests an die eigene Herkunft.
- [ ] **Step 5:** Commit.

### Task 3: Suchleiste in der Bibliothek

**Files:**
- Modify: `src/ui/BrandLibrary.tsx` (Tab «Icons»), `src/ui/app.css`, `e2e/library.spec.ts` bzw. neue `e2e/icon-search.spec.ts`
- Create (falls Datei über 400 Zeilen würde): `src/ui/IconSearch.tsx`

**Interfaces:**
- Consumes: `loadTabler`, `searchTabler`, `tablerAsset` aus Task 2; bestehendes `Item`, `Thumb`, `insertLibraryItem`.
- Produces: Im Tab «Icons» ein `<input type="search">` mit `aria-label="Icons suchen"`, Platzhalter «Icon suchen…», Hinweis darunter «Suche auf Englisch, z. B. house, arrow, camera.», Treffer als Kachelraster (gleiche Kachel wie die Markenicons, `aria-label` und `data-tip` = englischer Name), Klick oder Enter fügt ein, Ziehen auf die Leinwand geht. Ohne Suchtext: die 5 Markenicons. Ohne Treffer: «Keine Icons gefunden. Suche auf Englisch.» Während die Datei lädt: «Icons werden geladen…», bei Fehler: «Die Icons konnten nicht geladen werden. Lade die Seite neu.»

- [ ] **Step 1: Failing e2e** `e2e/icon-search.spec.ts`: Tab «Icons», 5 Kacheln; «house» tippen (nach 150 ms): mindestens eine Kachel mit Namen «house», höchstens 120; Klick fügt ein Element `brand` mit `brandId: 'tabler-house'` ein; «Camera » (Gross, Randleerzeichen) liefert Treffer; «zzzzqq» zeigt die Meldung mit Hinweis auf Englisch; Suchfeld leeren zeigt wieder die 5 Kacheln; Hinweistext sichtbar; Datei wird erst nach Fokus auf das Suchfeld angefordert (Netzwerkprotokoll).
- [ ] **Step 2:** Test scheitert.
- [ ] **Step 3:** Umsetzen. Eingabe mit 150 ms Pause, Ergebnis über `searchTabler` und `tablerAsset`, Vorschau mit `thumbnail`. Zugänglichkeit: Suchfeld mit Label, Trefferzahl als `role="status"` («12 Treffer»), Fokus bleibt im Feld. `/impeccable` für die neue Fläche.
- [ ] **Step 4:** Test grün; Screenshot in Edge bei 1280 px ansehen (Raster bricht nicht, Hinweis lesbar, nichts läuft über).
- [ ] **Step 5:** Commit.

### Task 4: Oberflächen-Icons auf Tabler

**Files:**
- Modify: die 14 Dateien mit `lucide-react` (`grep -rl "lucide-react" src`), `package.json` (`@tabler/icons-react` 3.49.0 exakt rein, `lucide-react` raus)
- Test: `src/architecture.test.ts` oder bestehender Architekturtest (neu: kein Import von `lucide-react`), bestehende E2E

**Interfaces:**
- Produces: gleiche Icon-Stellen, gleiche Grösse (18 px) und `aria-hidden`; Typ `LucideIcon` wird durch `Icon` aus `@tabler/icons-react` ersetzt. Vorschlag für die Zuordnung (Existenz je Name prüfen, sonst das visuell nächste Tabler-Icon wählen und im Bericht nennen): Pfeile `IconArrowUp/Down/Left/Right`, `IconArrowUpLeft/UpRight/DownLeft/DownRight`; Blend `IconBlend` (sonst `IconContrast`); BringToFront `IconBringToFront`; SendToBack `IconSendToBack`; Brush `IconBrush`; Copy `IconCopy`; Crop `IconCrop`; Download `IconDownload`; Eye `IconEye`; EyeOff `IconEyeOff`; FlipVertical2 `IconFlipVertical`; FolderOpen `IconFolderOpen`; Frame `IconFrame`; House `IconHome`; Image `IconPhoto`; ImagePlus `IconPhotoPlus`; LayoutGridCircles `IconLayoutGrid`; Lock `IconLock`; LockOpen `IconLockOpen`; Maximize `IconMaximize`; Palette `IconPalette`; Pickaxe `IconTools` (Erweiterte Optionen, sonst `IconSettings`); Plus `IconPlus`; Redo2 `IconArrowForwardUp`; Undo2 `IconArrowBackUp`; Save `IconDeviceFloppy`; Shapes `IconCategory`; ShieldAlert `IconShieldExclamation`; Smartphone `IconDeviceMobile`; Tag `IconTag`; Trash2 `IconTrash`; Type `IconTypography`; X `IconX`; ZoomIn `IconZoomIn`; ZoomOut `IconZoomOut`.

- [ ] **Step 1: Failing test:** Architekturtest «kein `lucide-react` in `src` und nicht in `package.json`» (scheitert, solange Lucide da ist).
- [ ] **Step 2:** Test scheitert.
- [ ] **Step 3:** Ersetzen. Strichstärke bei Bedarf so setzen, dass die Icons gleich kräftig wirken wie vorher (Tabler und Lucide haben beide 2).
- [ ] **Step 4:** Gate komplett inklusive E2E. Screenshots von Kopfzeile, Bibliothek, Ebenenpanel, Inspector, Zoomleiste, Slide-Leiste in Edge ansehen: keine Icons fehlen, nichts verrutscht.
- [ ] **Step 5:** Commit.

### Task 5: Markenicons, Pin, Doku, Abnahme

**Files:**
- Modify: `brand/icons/*.svg` (5 Icons durch Tabler-Versionen ersetzen: `bike`, `map-pin`, `mountain`, `tree-pine` (Tabler `trees` oder `tree`, visuell wählen), `waves` (Tabler `wave-sine` oder `ripple`, visuell wählen); Dateinamen und Manifest-Ids bleiben), `brand/manifest.json` (Namen ggf. angleichen), `src/plugins/elements/tag/TagNode.tsx` (`pinGrid`, `pinInk` auf die Tabler-Geometrie), `CLAUDE.md` (Tabelle Brand-Assets: «Tabler-Icons (MIT), Strich Orange», Hinweis auf die Suche), Spezifikation (Zeilen «Lucide-`map-pin`» auf Tabler), `docs/roadmap.md` (2.7 auf erledigt), `docs/superpowers/naechste-session.md` neu, Lizenzhinweis `brand/icons/LICENSE` falls die Lucide-Lizenz dort lag
- Test: `e2e/tag.spec.ts` (Pin-Pixeltest), `src/brand/manifest.test.ts`

**Interfaces:**
- Consumes: Tabler-SVGs aus `node_modules/@tabler/icons/icons/outline/<name>.svg` (Stil und Strich zuerst ansehen).
- Produces: gleiche Dateinamen, jetzt Tabler; Pin im Ort-Tag mit neuen `pinInk`-Werten, sodass die sichtbare Pin-Form wie vorher in der Icon-Box `tagBox.ort.icon` (x 22, y 11, w 33, h 41) sitzt.

- [ ] **Step 1: Failing test:** E2E Ort-Tag: sichtbare Pin-Pixel (Akzentfarbe) liegen im Rechteck x 22 bis 55, y 11 bis 52 des Tags mit höchstens 2 px Abweichung je Kante; Manifest-Test: 5 Icons vorhanden, Ids unverändert.
- [ ] **Step 2:** Test scheitert (mit den neuen SVGs ohne Kalibrierung).
- [ ] **Step 3:** SVGs ersetzen (Tabler-Dateien mit `stroke="currentColor"` und Hintergrundpfad entfernen, Farbe egal da eingefärbt), Pin kalibrieren, Doku nachführen. `grep -ri lucide .` ausserhalb von `node_modules`, `docs/archiv` und Git zeigt nichts mehr.
- [ ] **Step 4: Selbst anschauen** in Edge: Tab «Icons» (5 Markenicons und eine Suche), ein Tabler-Icon einfügen, einfärben (Orange, Warmweiss, Standortfarbe), skalieren, exportieren und das PNG öffnen; Ort-Tag exportieren und den Pin ansehen; Layout «Collage» und «Abschluss» (nutzen Icons?) kurz ansehen; Altprojekt mit `icon-bike`. Screenshots ablegen und ansehen.
- [ ] **Step 5:** Gate komplett. Doku, Plan nach `docs/archiv/plans/`. Commit, Gesamt-Review mit dem stärksten Modell, Merge in `main`, danach Rückfrage vor Push und Deploy.

## Self-Review
- Spec: jeder Punkt aus «Entscheide Phase 2.7» hat eine Aufgabe (Daten T1, Auslieferung und Projekt T2, Suche und Hinweis T3, UI-Icons T4, Markenicons und Pin T5).
- Namen: `loadTabler`, `tablerAsset`, `searchTabler`, `ensureTabler`, `isTablerId` heissen in allen Aufgaben gleich.
- Eigene Setzungen zur Prüfung durch Alexej: 120 Treffer, 150 ms, Rangfolge der Suche, Hinweistext, `tabler-<name>` als Id, Datei als Chunk mit Vorladen beim Öffnen, Zuordnung der 43 UI-Icons (Vorschlag).
- Risiko: `@tabler/icons-react` ist gross, bleibt aber über Einzelimporte klein; Bundle-Grösse nach Task 4 messen und im Bericht nennen.
