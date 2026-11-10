# Plan 2: Social Studio umziehen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Social Studio läuft unter `bbzb-tools.pages.dev/social-studio/` mit `@bbzb/ui`, Braveold aus dem privaten Repo, eigenem Speicher-Namensraum und allen bisherigen Tests grün, und neue Tools entstehen aus `apps/_vorlage/`.

**Architecture:** Das Studio wird `apps/social-studio` (Base `/social-studio/`), eigene Marken-Assets bleiben in `apps/social-studio/brand/`. Braveold liegt in `bbzb-lu/bbzb-tools-fonts` und wird nach `fonts-private/` geholt; das Studio lädt sie per `import.meta.glob`, damit der Build ohne die Datei gelingt. Die Edge-Tests brauchen einen Test-Build (`--mode test`, Testhaken), der Live-Build nie.

**Tech Stack:** wie Plan 1, dazu die Studio-Abhängigkeiten (Konva, Mediabunny, transformers.js, Dexie, heic-to, fflate, zustand, zundo, immer, zod).

**Spec:** `docs/superpowers/specs/2026-11-10-bbzb-tools-design.md`. Spezifikation des Studios selbst: `../bbzb-social-studio/docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (wird mitkopiert).

**Quellen:** `../bbzb-social-studio` (eingefroren, nur lesen). Muster für alles Umziehen: wie das Banner in Plan 1 (archiviert in `docs/archiv/`).

## Global Constraints
- Alle Global Constraints aus Plan 1 gelten weiter (keine fremden Requests ausser GET auf KI-Modelle, Werte nur in Token-Dateien, Schweizer Deutsch ohne ß und ohne Halbgeviertstrich, Edge, keine absoluten Asset-Pfade, kein Git-Verlauf aus alten Repos, Dateien unter 400 Zeilen, `AGENTS.md` unter 60 Zeilen).
- **Braveold nie ins öffentliche Repo**, auch nicht als Testdatei, Golden-Bild mit eingebetteter Schrift ist ok (Pixel), die `.otf` nicht. Vor jedem Commit: `git ls-files | grep -i braveold` muss leer sein.
- Segoe UI (Regular, Bold, Black) ist schullizenziert und darf öffentlich (Entscheid Alexej). `Segoe_EULA.txt` wird durch einen Hinweis auf die Schullizenz ersetzt.
- Öffentlich erlaubt (Entscheid Alexej): `docs/reference/` mit den Beispiel-Layouts und der PDF-Anleitung. Nicht übernommen: `docs/ideen screenshots/`, `brand/ui/logo-social-studio*`, `brand/icons/logo-social-studio-v1.psd`, `brand/icons/doodle icons.zip` (nicht versioniert).
- Speicher-Namensraum (Entscheid Claude): Dexie-Datenbank `social-studio`, OPFS-Ordner `social-studio-assets`, localStorage-Schlüssel `social-studio.unterlage`. Die Aufräumzeile für das alte `bbzb.ui` in `main.tsx` und ihr Test entfallen (neue Herkunft, nichts aufzuräumen).
- Der Test-Build (`--mode test`) darf nie deployt werden. Der Live-Build enthält den Testhaken nicht (Test in Task 4).
- Pixel-, Golden- und Exporttests bleiben unverändert, kein Sollwert wird angepasst.
- Kein `packages/brand` (Entscheid Claude, Abweichung vom Entwurf): nur das Studio nutzt Segoe UI und die CI-Farben, beides bleibt in `apps/social-studio`. Das Paket entsteht, wenn ein zweites Tool es braucht.
- Commits Englisch mit den Zeilen `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` und `Claude-Session: https://claude.ai/code/session_014TgXPpEjmPnBX98HDMdFxK`. Branch `plan-2`. Push, PR, Merge, Secrets und Issues nur nach Rückfrage bei Alexej.

## Review Focus
1. Edge-Test liest Dateien relativ zum Arbeitsordner (`readFileSync('e2e/…')`, `'docs/reference/…'`), Playwright läuft aber im Hauptordner: jeder Pfad wird relativ zur Testdatei aufgelöst. Gesichert, weil die betroffenen Tests sonst scheitern (Task 4).
2. Live-Build ohne Braveold (Clone ohne Zugriff): Build gelingt, Studio zeigt den bestehenden Hinweis und blockiert den Export. Test in Task 1.
3. Deploy ohne Braveold würde das Live-Studio unbrauchbar machen: der Deploy-Job bricht ab, wenn `fonts-private/Braveold-Light.otf` fehlt (Task 5).
4. Ein Tool räumt den Speicher eines anderen auf: Aufräumen des Studios fasst nur `social-studio-assets` an. Test in Task 2.
5. Hoisting der Workspaces bricht Pfade in `node_modules` (`segmentWorker.ts` importiert `../../node_modules/onnxruntime-web/…`, `scripts/build-tabler.mjs` liest `node_modules/@tabler/icons/`): beide über die Paketauflösung, wie beim Banner. Gesichert durch Build und KI-Test (Task 2, 4).

---

### Task 1: Private Schriften holen

**Files:**
- Create: `scripts/fonts.mjs`, `scripts/fonts.test.ts`
- Modify: `package.json` (Skript `fonts`), `AGENTS.md` (eine Zeile), `README.md` (eine Zeile)

**Interfaces:**
- Produces: `npm run fonts` legt `fonts-private/` an oder aktualisiert es (`git clone --depth 1 https://github.com/bbzb-lu/bbzb-tools-fonts.git fonts-private` bzw. `git -C fonts-private pull --ff-only`). Ohne Zugriff: Exit-Code 0, Meldung «Keine Berechtigung für bbzb-tools-fonts. Das Social Studio läuft, exportiert aber ohne Braveold nicht.» Mit `--strict` (für den Deploy) Exit-Code 1.
- Export `fontsStatus(dir: string): 'ok' | 'missing'` aus `scripts/fonts.mjs` (prüft `Braveold-Light.otf`).

- [ ] **Step 1: Failing Test** `scripts/fonts.test.ts`: `fontsStatus` gibt `'missing'` für einen leeren Temp-Ordner und `'ok'`, sobald dort eine Datei `Braveold-Light.otf` liegt.
- [ ] **Step 2:** `npm test -- scripts` → FAIL. `vitest.config.ts` um das Projekt `scripts` ergänzen, falls nötig.
- [ ] **Step 3:** `scripts/fonts.mjs` mit `fontsStatus` und dem Ablauf oben, nur Node-APIs plus `git`. Test → PASS.
- [ ] **Step 4:** `npm run fonts` lokal ausführen → `fonts-private/` mit fünf `.otf`, `git status` zeigt den Ordner nicht (steht seit Plan 1 in `.gitignore`).
- [ ] **Step 5:** Commit `Fetch private fonts`.

### Task 2: Studio kopieren, bauen, Unit-Tests grün

**Files:**
- Create: `apps/social-studio/` aus `../bbzb-social-studio/`: `src/`, `brand/` (ohne `fonts/Braveold-*`, ohne `ui/logo-social-studio*`, ohne `icons/logo-social-studio-v1.psd`), `public/{licenses,favicon.png,apple-touch-icon.png}`, `scripts/{build-tabler.mjs,build-doodles.mjs,make-test-videos.sh,model-vergleich/}`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `DESIGN.md`, `PRODUCT.md`
- Modify (in der Kopie): `src/fonts.ts`, `src/storage/db.ts`, `src/storage/assets.ts`, `src/store/ui.ts`, `src/main.tsx`, `src/ui/LicensesDialog.tsx`, `src/ai/segmentWorker.ts`, `scripts/build-tabler.mjs`, Tests mit `readFileSync`/`globSync` relativ zum Arbeitsordner, `brand/fonts/README.md`; Delete `brand/fonts/Segoe_EULA.txt`

**Interfaces:**
- Produces: `npm run build -w apps/social-studio` baut nach `dist/social-studio/`. `npm test` grün inklusive Studio.

- [ ] **Step 1:** Kopieren (ohne `.git`, `node_modules`, `dist`, `test-results`, `e2e/fixtures/video`). `package.json`: Name `social-studio`, eigene `dependencies` aus dem alten Studio plus `"@bbzb/ui": "*"`, devDependencies nur was die Wurzel nicht hat (`@tabler/icons`, `fake-indexeddb`), Skripte `dev`, `build`, `typecheck`, `build:tabler`, `build:doodles`; kein `deploy`, kein `test:e2e`. `vite.config.ts`: `base: '/social-studio/'`, `build.outDir: '../../dist/social-studio'`, `emptyOutDir: false`, Plugin `noCdn` bleibt (auch für Worker), `previewHeaders` entfällt, `test.exclude: ['e2e/**', 'node_modules/**']`.
- [ ] **Step 2:** `src/fonts.ts`: Braveold über `import.meta.glob('../../../fonts-private/Braveold-Light.otf', { query: '?url', import: 'default', eager: true })`; fehlt der Eintrag, verhält sich das Studio wie heute bei einer nicht ladbaren Schrift (Export blockiert, bestehende Meldung). Segoe-Importe bleiben auf `../brand/fonts/`.
- [ ] **Step 3: Failing Test** neben dem bestehenden Schrift-Test: mit leerem Glob-Ergebnis meldet die Schriftladung Braveold als fehlend (bestehende Funktion für «Schrift fehlt» nutzen, Name im Code nachsehen). FAIL → Umsetzung → PASS.
- [ ] **Step 4:** Namensraum laut Global Constraints in `db.ts`, `assets.ts`, `ui.ts`; `localStorage.removeItem('bbzb.ui')` in `main.tsx` und den zugehörigen Teil von `e2e/no-mode.spec.ts` entfernen. **Failing Test** in `src/storage/storage.test.ts`: das Aufräumen löscht nichts in einem fremden OPFS-Ordner `news-banner` (mit Fake-Verzeichnis wie in den bestehenden Speichertests). FAIL → PASS.
- [ ] **Step 5:** Pfade: Lizenzlinks in `LicensesDialog.tsx` über `import.meta.env.BASE_URL`; `segmentWorker.ts` importiert die WASM-Datei über die Paketauflösung (Vite-Alias mit `createRequire().resolve`, wie `@tabler-outline` im Banner); `build-tabler.mjs` findet `@tabler/icons` über `createRequire`. Danach `grep -rnE "'/(fonts|licenses|brand|models)" apps/social-studio/src` → keine Treffer ausser Tests.
- [ ] **Step 6:** Unit-Tests, die Dateien relativ zum Arbeitsordner lesen (`src/architecture.test.ts`, `src/test/architecture.test.ts`, `src/ui/theme.test.ts`, `src/brand/*Data.test.ts`, `src/brand/manifest.test.ts`, `src/tokens.test.ts`), lösen Pfade relativ zur Testdatei auf (`fileURLToPath(new URL('…', import.meta.url))`). Kein Sollwert ändert sich.
- [ ] **Step 7:** `brand/fonts/README.md` neu: Tabelle Segoe UI (Schullizenz BBZB, Entscheid Alexej 10.11.2026), Braveold (Envato, liegt in `bbzb-lu/bbzb-tools-fonts`, `npm run fonts`). `Segoe_EULA.txt` löschen.
- [ ] **Step 8:** `npm run typecheck && npm run lint && npm test && npm run build` grün; `git ls-files | grep -i braveold` leer.
- [ ] **Step 9:** Commit `Move social studio into the suite (build and unit tests)`.

### Task 3: Oberfläche auf `@bbzb/ui`

**Files:**
- Modify: `apps/social-studio/src/main.tsx`, `src/ui/theme.ts`, `src/ui/Header.tsx`, `src/ui/kit/*` (geteilte Teile löschen, Importe umstellen), `src/ui/fonts.css` (löschen), `src/ui/kit/kit.css` (nur Studio-Regeln behalten), `src/ui/Logo.tsx` (löschen), `src/ui/theme.test.ts`
- Modify (nur wenn ein geteiltes Bauteil im Studio anders ist): `packages/ui/src/*`

**Interfaces:**
- Consumes: `Button`, `Switch`, `Segmented`, `SlideHighlight`, `theme`, `applyTheme`, `Header({ tool, children })`, CSS-Einstiege aus `@bbzb/ui`.
- Produces: `applyStudioTheme(root: HTMLElement): void` in `src/ui/theme.ts` = `applyTheme(root)` plus Slide-Farben aus `tokens.ts`, studio-eigene Tokens (`riso-*`, `unterlage-*`, `slide-glow*`) und Slider-/Range-/Scrollbar-Variablen wie heute.

- [ ] **Step 1:** Vor dem Umbau Edge-Screenshots der Startseite des Studios und des Editors mit einem Beispielprojekt (`e2e/fixtures/phase-1-2.bbzbsocial`) im Scratch-Ordner ablegen (Test-Build, `wrangler pages dev`).
- [ ] **Step 2:** Byte-gleiche Kit-Dateien (`Button`, `Switch`, `Segmented`, `SlideHighlight`, `slide.ts`) im Studio löschen und aus `@bbzb/ui` importieren. Weicht eine Datei ab, die Studio-Fassung nach `packages/ui` übernehmen und im Report begründen (sie ist die neuere); das Banner muss danach gleich aussehen (Banner-e2e). `Knob`, `RangeSlider`, `useRoll`, `sliderMath`, `SliderLab` bleiben im Studio.
- [ ] **Step 3:** `theme.ts` des Studios: gemeinsame Tokens aus `@bbzb/ui` (nicht doppelt), Studio-Tokens bleiben hier, `applyStudioTheme` wie oben. `uiFonts` und `loadUiFonts` zeigen auf die Schriften aus `@bbzb/ui` (Import der URLs statt `/fonts/…`). `theme.test.ts` an die neue Aufteilung anpassen, ohne Prüfungen zu streichen.
- [ ] **Step 4:** `Logo` durch `<Header tool="Social Studio">…</Header>` ersetzen, bestehende Kopf-Knöpfe als Kinder. Studio-CSS für `.logo*` entfernen.
- [ ] **Step 5:** Screenshots wie in Step 1 wiederholen und vergleichen. Erwartet: einzig der Kopf links ändert sich (Wortmarke «BBZB Tools / Social Studio»). Abweichungen sonst beheben.
- [ ] **Step 6:** `npm run typecheck && npm run lint && npm test` grün. Commit `Social studio uses the shared UI package`.

### Task 4: Edge-Tests, CSP und Kachel

**Files:**
- Modify: `scripts/build.mjs` (Option `--mode <name>` an jede App weiterreichen), `playwright.config.ts` (webServer baut mit `--mode test`, Timeout pro Test aus dem Studio übernehmen, falls dort gesetzt), `_headers`, `apps/startseite/src/tools.ts`, `apps/startseite/public/vorschau/social-studio.png`, `apps/startseite/src/Datenschutz.tsx`, `e2e/suite.spec.ts`
- Create: `apps/social-studio/e2e/` aus dem alten Studio, `scripts/check-live-build.mjs`, `scripts/check-live-build.test.ts`
- Modify (in der Kopie): alle `page.goto('/')` → `page.goto('')`, alle Dateipfade relativ zur Testdatei, Netzwerk-Test auf `foreignRequests` aus `'../../../e2e/helpers'` mit erlaubtem Hugging Face

**Interfaces:**
- Produces: `node scripts/build.mjs --mode test` = Test-Build. `npm run build` bleibt Live-Build.

- [ ] **Step 1:** `_headers`: Regel `/social-studio/*` mit `! Content-Security-Policy` und der CSP aus `../bbzb-social-studio/public/_headers` (mit `wasm-unsafe-eval`, Blob-Workern, `connect-src 'self' https://huggingface.co https://*.hf.co`), gleiche Kommentarform wie für andere Pfade.
- [ ] **Step 2:** `tools.ts`: Eintrag `social-studio`, Name «Social Studio», Satz «Carousels und Stories für Instagram und LinkedIn im BBZB-Design.», `beta: true`, Vorschau 960 × 540 aus einem Export des alten Studios (Layout «Titel» mit Testbild, keine Personen).
- [ ] **Step 3:** `Datenschutz.tsx`: Abschnitt «Ausnahmen» bekommt statt «Zurzeit gibt es keine Ausnahmen.» den Satz «Das Social Studio lädt beim Freistellen KI-Modelle von Hugging Face herunter. Dabei wird nichts von dir gesendet, deine Bilder bleiben im Browser.»
- [ ] **Step 4: Failing Test** `scripts/check-live-build.test.ts`: `findTestHook(dir: string): string[]` (exportiert aus `scripts/check-live-build.mjs`) liefert die Dateien unter `dir`, die den globalen Schlüssel des Testhakens enthalten (in `src/testHook.ts` nachsehen); leer für einen Ordner ohne, ein Treffer für eine Datei mit dem Schlüssel. Das Skript selbst prüft `dist/` und endet mit Exit-Code 1 bei Treffern. Im Report belegen: nach `npm run build` keine Treffer, nach `node scripts/build.mjs --mode test` Treffer. Task 5 ruft das Skript im Deploy-Job nach dem Build auf.
- [ ] **Step 5:** Edge-Tests kopieren und anpassen (siehe Files). Testvideos lokal erzeugen: `sh apps/social-studio/scripts/make-test-videos.sh` (braucht ffmpeg).
- [ ] **Step 6:** `npm run test:e2e` → alle Projekte grün (`suite`, `news-banner`, `social-studio`). Laufzeit im Report notieren.
- [ ] **Step 7:** Selbst angeschaut: Live-nahes Bild mit `npm run build && npx wrangler pages dev dist --port 8788`, in Edge `/social-studio/` öffnen, Beispielprojekt laden, PNG- und ZIP-Export, mit `docs/reference/layouts/` vergleichen; Freistellen einmal echt (lädt das Modell von Hugging Face, prüft die CSP).
- [ ] **Step 8:** Commit `Social studio e2e, CSP and tile`.

### Task 5: CI mit Schriften, Videos und Windows

**Files:**
- Modify: `.github/workflows/ci.yml`, `docs/deployment.md`

- [ ] **Step 1:** Job `test` (ubuntu): `npm ci`, Typecheck, Lint, Unit-Tests, Prüfung `git ls-files | grep -i braveold` leer (Schritt scheitert sonst).
- [ ] **Step 2:** Job `e2e` auf `windows-latest` (Zielsystem, Edge vorinstalliert): Schriften holen mit `actions/checkout` (`repository: bbzb-lu/bbzb-tools-fonts`, `path: fonts-private`, `ssh-key: ${{ secrets.FONTS_DEPLOY_KEY }}`), ffmpeg (`choco install ffmpeg -y` oder vorinstalliert prüfen), Testvideos erzeugen (Skript unter Git-Bash: `shell: bash`), `npm run test:e2e` mit `PLAYWRIGHT_HTML_OPEN: never`, Report als Artefakt bei Fehler, `timeout-minutes: 45`.
- [ ] **Step 3:** Job `windows` aus Plan 1 entfällt (der e2e-Job baut auf Windows). Job `deploy` braucht `[test, e2e]`, holt die Schriften wie oben und prüft danach `node scripts/fonts.mjs --strict` vor dem Build und `node scripts/check-live-build.mjs` nach dem Build.
- [ ] **Step 4:** Alle Actions auf die aktuelle Hauptversion heben (`actions/checkout@v5`, `actions/setup-node@v5`, `actions/upload-artifact@v5`), weil v4 auf Node 20 läuft (Warnung aus dem ersten Deploy).
- [ ] **Step 5:** `docs/deployment.md`: Abschnitt Schriften: Deploy-Key einrichten (Befehle für Alexej, siehe Step 6), was ohne Zugriff passiert.
- [ ] **Step 6: Rückfrage bei Alexej.** Er führt aus (Claude trägt keine Schlüssel ein): `ssh-keygen -t ed25519 -N "" -f /tmp/fonts-key -C bbzb-tools-ci`, `gh repo deploy-key add /tmp/fonts-key.pub --repo bbzb-lu/bbzb-tools-fonts --title bbzb-tools-ci`, `gh secret set FONTS_DEPLOY_KEY --repo bbzb-lu/bbzb-tools < /tmp/fonts-key`, `rm /tmp/fonts-key /tmp/fonts-key.pub`. Claude prüft danach mit `gh secret list`.
- [ ] **Step 7:** Commit `CI: private fonts, test videos, e2e on Windows`.

### Task 6: Vorlage für neue Tools und Notizen

**Files:**
- Create: `apps/_vorlage/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx,src/App.tsx,e2e/start.spec.ts,AGENTS.md,CLAUDE.md}`, `scripts/neues-tool.mjs`, `scripts/neues-tool.test.ts`
- Create: `apps/social-studio/AGENTS.md`, `apps/social-studio/CLAUDE.md`, `apps/social-studio/docs/` (Spezifikation, `research/`, `design/`, `reference/`, `archiv/`, `deployment.md` nach `archiv/`)
- Modify: `AGENTS.md`, `apps/startseite/AGENTS.md`, `docs/superpowers/specs/2026-11-10-bbzb-tools-design.md`

**Interfaces:**
- Produces: `npm run neues-tool -- <id> "<Name>"` kopiert `apps/_vorlage` nach `apps/<id>`, ersetzt Platzhalter `__ID__` und `__NAME__`, trägt einen Eintrag (Beta, Platzhalter-Satz, Platzhalter-Vorschau) in `apps/startseite/src/tools.ts` ein. Lehnt IDs ab, die nicht `^[a-z][a-z0-9-]*$` entsprechen oder schon existieren.

- [ ] **Step 1: Failing Test** `scripts/neues-tool.test.ts` (Temp-Kopie des Repos-Ausschnitts): erzeugt `apps/test-tool` mit ersetzten Platzhaltern und neuem Eintrag in `tools.ts`; lehnt `Test Tool`, `1abc` und eine bestehende ID mit Meldung ab.
- [ ] **Step 2:** FAIL → `apps/_vorlage` (kleinste App mit `Header`, einer Überschrift und dem e2e-Test «Seite lädt, Kopf zeigt __NAME__») und `scripts/neues-tool.mjs` → PASS. `scripts/build.mjs` überspringt `_vorlage` schon (Plan 1).
- [ ] **Step 3:** `apps/social-studio/AGENTS.md` aus der alten `CLAUDE.md` kürzen: Hosting, Deploy, Arbeitsweise und Brand-Tabelle der allgemeinen Teile fallen weg (stehen im Hauptordner); Fallen, Unverhandelbares des Studios, Pencil-Regel für `docs/design/editor.pen`, Verweis auf die Studio-Spezifikation bleiben. `CLAUDE.md` = `@AGENTS.md`.
- [ ] **Step 4:** Root-`AGENTS.md` und `apps/startseite/AGENTS.md`: neues Tool = `npm run neues-tool`, dann Satz und Vorschau eintragen.
- [ ] **Step 5:** Entwurf nachführen: `packages/brand` erst bei zweitem Nutzer, Edge-Tests der CI auf Windows, Testmodus-Build nie deployt.
- [ ] **Step 6:** `npm run typecheck && npm run lint && npm test && npm run test:e2e` grün. Commit `Tool template and studio notes`.

### Abschluss von Plan 2
- [ ] Gesamtreview (`superpowers:requesting-code-review`), Befunde beheben.
- [ ] Nach Rückfrage: Branch pushen, PR, CI grün (Beleg `gh pr checks`), Merge, Live-Prüfung wie in Plan 1 plus `/social-studio/` (CSP mit Hugging Face, Export mit Braveold).
- [ ] Nach Rückfrage: offene Punkte aus `roadmap.md`, `ideen.md`, `windows-checkliste.md` des alten Studios als Issues mit Label `social-studio`.
- [ ] Plan 2 nach `docs/archiv/`, Plan 3 (Embeds, Übersicht, Hinweise in alten Repos) schreiben.
