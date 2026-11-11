# Plan 1: Fundament, Startseite und News-Banner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `bbzb-tools.pages.dev` läuft mit Startseite, Seite «Datenschutz» und dem umgezogenen News-Banner, gebaut aus einem Workspace-Repo mit gemeinsamem Paket `@bbzb/ui`, getestet und deployt von GitHub Actions.

**Architecture:** npm-Workspaces. `apps/startseite` (Base `/`) und `apps/news-banner` (Base `/news-banner/`) sind eigene Vite-Projekte, `packages/ui` liefert Bauteile, Oberflächen-Tokens, CSS und Schriften als Quellcode (kein eigener Build). `scripts/build.mjs` legt alles in `dist/`, `wrangler pages dev dist` dient lokal und in CI als Testserver, damit `_headers` genau wie bei Cloudflare gilt.

**Tech Stack:** Node 26, npm 11 Workspaces, React 19.3, Vite 8, TypeScript 6 strict, Vitest 5 (Projects), Playwright 1.64 mit Edge, wrangler 4, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-10-bbzb-tools-design.md`

**Folgepläne:** Plan 2 Social Studio (mit privatem Schriften-Repo, Paket `brand`, Dateiprüfung), Plan 3 Embeds, Übersicht und Abschluss. Werden nach Abschluss von Plan 1 geschrieben.

**Quellen:** altes Banner unter `../bbzb-news-banner` (eingefroren, nur lesen), Muster aus `../bbzb-social-studio`.

## Global Constraints
- Nichts verlässt den Browser: kein Backend, kein Upload, keine Analytics, keine Laufzeit-CDNs. Für Startseite und Banner gilt `connect-src 'self'`.
- Werte (Farben, Masse) nur in `packages/ui/src/theme.ts` (Oberfläche) bzw. `apps/news-banner/src/tokens.ts` (Banner), nirgends sonst hart codiert.
- UI-Texte Deutsch, Schweizer Rechtschreibung («ss», Guillemets «…»), Du-Form, kurz. Keine Halbgeviertstriche (–). Gilt auch für `.md`.
- Zielgeräte Windows 11 mit Edge; Playwright läuft mit `channel: 'msedge'`.
- Kein Git-Verlauf aus alten Repos übernehmen, Dateien frisch kopieren.
- Absolute Pfade wie `'/badges/…'` oder `url('/fonts/…')` sind verboten, weil jedes Tool unter einem Unterpfad läuft: Assets importieren oder `import.meta.env.BASE_URL` nutzen.
- Speicher-Namensraum: falls ein Tool `localStorage`, IndexedDB oder OPFS nutzt, beginnt jeder Schlüssel, Datenbank- und Ordnername mit der Tool-ID (`news-banner`, `startseite`). Das Banner speichert in Plan 1 nichts.
- Dateien unter 400 Zeilen. Notizen kurz, `AGENTS.md` je Ordner unter 60 Zeilen.
- Commits Englisch, klein, mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Arbeit auf Branch `plan-1`, Merge nach `main` nur nach Rückfrage bei Alexej. Push und Anlegen von Dingen auf GitHub oder Cloudflare nur nach Rückfrage.
- Abweichung vom Entwurf (Entscheid Claude, im Entwurf nachgeführt): Zu Beginn gibt es nur `packages/ui`. `brand` entsteht in Plan 2 erst, wenn das Studio kommt, ein `config`-Paket gar nicht: `tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts` und `playwright.config.ts` liegen im Hauptordner und gelten für alle.

## Review Focus
1. Direkter Aufruf eines Unterpfads ohne Schrägstrich (`/news-banner`) oder Neuladen auf `/news-banner/`: Tool lädt vollständig, Schriften und Bilder inklusive. Test in Task 4.
2. Zwei CSP-Regeln, die sich bei Cloudflare zu einer Komma-Liste addieren (dann gilt die strengere): jede Seite liefert genau eine CSP. Test in Task 4.
3. Änderung in `packages/ui` bricht das Banner, ohne dass ein Banner-Test scheitert: Banner-e2e und Pixeltests laufen bei jeder Änderung. Gesichert durch CI-Lauf über alles in Task 6.
4. Startseite verlinkt ein Tool, das es nicht gibt (Tippfehler im Pfad): Test besucht jede Kachel und erwartet Status 200 und ein `h1` bzw. die Tool-Kopfzeile. Test in Task 4.
5. Windows-Mitwirkende: Build- und Testskripte nutzen keine Bash-Befehle (`rm -rf`, `cp -R`), nur Node. Gesichert in Task 4 durch `scripts/build.mjs` und einen CI-Lauf auf `windows-latest` in Task 6.

---

### Task 1: Workspace-Gerüst und Agenten-Anweisungen

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `.gitignore`, `.nvmrc`
- Create: `AGENTS.md`, `CLAUDE.md`, `README.md` (ersetzen), `.claude/settings.json`
- Create: `packages/ui/package.json`, `packages/ui/src/index.ts`, `packages/ui/src/smoke.test.ts`

**Interfaces:**
- Produces: Root-Skripte `typecheck`, `lint`, `test`, `test:e2e`, `build`, `dev:<app>`. Paketname `@bbzb/ui` (Workspace, `"private": true`, `"exports": { ".": "./src/index.ts", "./*.css": "./src/*.css" }`).

- [ ] **Step 1:** `package.json` mit `"private": true`, `"type": "module"`, `"workspaces": ["apps/*", "packages/*"]`, `"engines": { "node": ">=26" }`. Abhängigkeiten in den Versionen des Banners (`../bbzb-news-banner/package.json`): React, Vite, TypeScript, Vitest, Playwright, ESLint-Pakete, wrangler, pngjs als Root-devDependencies. Skripte: `typecheck: tsc -b`, `lint: eslint .`, `test: vitest run`, `test:e2e: playwright test`, `build: node scripts/build.mjs`.
- [ ] **Step 2:** `tsconfig.base.json` = `compilerOptions` aus `../bbzb-news-banner/tsconfig.json` (ohne `include`). Root-`tsconfig.json` mit `references` auf jedes Workspace-Paket; jedes Paket hat eine eigene `tsconfig.json`, die `../../tsconfig.base.json` erweitert und `"composite": true` setzt. `eslint.config.js` aus dem Banner, `ignores` ergänzt um `**/dist`. `.gitignore` aus dem Studio plus `/fonts-private/`.
- [ ] **Step 3:** `vitest.config.ts` mit `test.projects: ['apps/*', 'packages/*']` und `exclude` für `**/e2e/**`. Smoke-Test `packages/ui/src/smoke.test.ts`: `expect(1).toBe(1)` (wird in Task 2 durch echte Tests ersetzt und gelöscht).
- [ ] **Step 4:** `AGENTS.md` (Hauptordner), höchstens 60 Zeilen: Zweck der Suite (2 Sätze), Ordnerkarte (`apps/`, `packages/ui`, `embeds/` folgt, `docs/`), Unverhandelbares aus den Global Constraints, Regel «erst nach `packages/`, wenn ein zweites Tool es braucht», Testbefehle als Pflicht vor jedem Commit, «Arbeite im Ordner des Tools und lies dessen `AGENTS.md`, nicht die anderer Tools», Issues mit Label pro Bereich und ohne echte Fotos, Namen oder Projektdateien, Superpowers/Impeccable/Ponytail als Angebot. `CLAUDE.md` enthält nur `@AGENTS.md`. `README.md`: ein Absatz für Menschen, Befehle `npm install`, `npm run dev:startseite`, Link auf `AGENTS.md`.
- [ ] **Step 5:** `.claude/settings.json` mit `extraKnownMarketplaces` (`impeccable` → `pbakaus/impeccable`, `ponytail` → `DietrichGebert/ponytail`) und `enabledPlugins` `superpowers@claude-plugins-official`, `impeccable@impeccable`, `ponytail@ponytail` jeweils `true`.
- [ ] **Step 6:** `npm install && npm run typecheck && npm run lint && npm test`. Erwartet: alles grün, 1 Test bestanden.
- [ ] **Step 7:** Commit `Workspace skeleton, agent instructions`.

### Task 2: Paket `@bbzb/ui` mit gemeinsamem Kopf

**Files:**
- Create: `packages/ui/src/{Button,Switch,Segmented,SlideHighlight}.tsx`, `slide.ts`, `slide.test.ts`, `theme.ts`, `base.css`, `kit.css`, `fonts.css`, `fonts/*.woff2`, `licenses/{host-grotesk,newsreader}-OFL.txt`, `Header.tsx`, `Header.test.tsx`, `header.css`, `AGENTS.md`
- Modify: `packages/ui/src/index.ts`; Delete: `smoke.test.ts`

**Interfaces:**
- Produces (aus `@bbzb/ui`): `Button`, `Switch`, `Segmented`, `SlideHighlight` (Signaturen wie im Banner), `theme`, `applyTheme(root: HTMLElement): void`, `Header({ tool }: { tool: string; children?: ReactNode }): JSX.Element`. CSS-Einstiege `@bbzb/ui/fonts.css`, `@bbzb/ui/base.css`, `@bbzb/ui/kit.css`, `@bbzb/ui/header.css`.

- [ ] **Step 1:** Kopieren aus `../bbzb-news-banner/src/ui/`: `kit/*` (ohne Pfadebene `kit`), `theme.ts`, `base.css`, `fonts.css`; `slide.test.ts` aus `../bbzb-social-studio/src/ui/kit/slide.test.ts`. Schriften aus `../bbzb-news-banner/public/fonts/` nach `src/fonts/`, OFL-Texte nach `licenses/`. In `fonts.css` jede `url('/fonts/…')` durch `url('./fonts/…')` ersetzen (Vite löst relativ auf und hängt den Base-Pfad an). Kommentar in `theme.ts` anpassen: einzige Quelle der Oberflächen-Tokens aller Tools.
- [ ] **Step 2: Failing Test** `Header.test.tsx` mit `renderToStaticMarkup`:
  ```tsx
  it('zeigt Wortmarke und Tool-Namen, verlinkt zur Startseite', () => {
    const m = renderToStaticMarkup(<Header tool="News-Banner" />);
    expect(m).toContain('href="/"');
    expect(m).toContain('BBZB Tools');
    expect(m).toContain('News-Banner');
    expect(m).toMatch(/aria-label="BBZB Tools, zur Startseite"/);
  });
  it('rendert Kinder rechts im Kopf', () => {
    expect(renderToStaticMarkup(<Header tool="X"><button>Hilfe</button></Header>)).toContain('<button>Hilfe</button>');
  });
  ```
- [ ] **Step 3:** `npm test -- packages/ui` → FAIL (`Header` fehlt).
- [ ] **Step 4:** `Header` in `Header.tsx`: `<header class="bbzb-header">` mit `<a href="/" class="bbzb-wordmark" aria-label="BBZB Tools, zur Startseite">` (Zeile «BBZB Tools» in Gewicht 800, darunter Tool-Name wie heute `.logo-sub`), danach `children`. Styles in `header.css`, übernommen aus `.logo`, `.logo-name`, `.logo-sub` in `../bbzb-news-banner/src/ui/app.css`, Farben nur über `var(--…)`.
- [ ] **Step 5:** `npm test -- packages/ui` → PASS (Header und slide-Tests). `npm run typecheck && npm run lint` grün.
- [ ] **Step 6:** `packages/ui/AGENTS.md` (unter 30 Zeilen): Was hier liegt, dass jede Änderung alle Tools trifft und deshalb `npm run test:e2e` für alle Pflicht ist, Herkunft des Looks (`DESIGN.md` und Pen-Entwurf bleiben im Studio-Ordner, ab Plan 2), Impeccable für UI-Änderungen.
- [ ] **Step 7:** Commit `Shared UI package with header`.

### Task 3: Startseite und Seite «Datenschutz»

**Files:**
- Create: `apps/startseite/{package.json,tsconfig.json,vite.config.ts,index.html,datenschutz/index.html}`, `src/{main.tsx,Start.tsx,Datenschutz.tsx,datenschutz-main.tsx,tools.ts,tools.test.ts,start.css}`, `src/vorschau/news-banner.png`, `AGENTS.md`

**Interfaces:**
- Consumes: `Header`, `applyTheme`, CSS-Einstiege aus `@bbzb/ui`.
- Produces: `export type Tool = { id: string; name: string; satz: string; pfad: string; vorschau: string; beta: boolean }` und `export const tools: readonly Tool[]` in `apps/startseite/src/tools.ts`. Task 4 importiert `tools` für den Netzwerk- und Linktest.

- [ ] **Step 1: Failing Test** `tools.test.ts`:
  ```ts
  it('jedes Tool hat eindeutige ID und Pfad /<id>/', () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
    for (const t of tools) expect(t.pfad).toBe(`/${t.id}/`);
  });
  it('Satz kurz, ohne Halbgeviertstrich und ohne ß', () => {
    for (const t of tools) { expect(t.satz.length).toBeLessThanOrEqual(90); expect(t.satz).not.toMatch(/[–ßẞ]/); }
  });
  it('News-Banner ist eingetragen und Beta', () => {
    expect(tools.find((t) => t.id === 'news-banner')).toMatchObject({ name: 'News-Banner', beta: true });
  });
  ```
- [ ] **Step 2:** Test laufen lassen → FAIL.
- [ ] **Step 3:** `tools.ts` mit genau einem Eintrag `news-banner`, Satz «Thumbnails für SharePoint-News in unter einer Minute.», Vorschau als Bild-Import (`import vorschau from './vorschau/news-banner.png'`). Vorschaubild: Export des alten Banners (`../bbzb-news-banner`, `npm run dev`, Standardzustand exportieren), auf 960 × 540 verkleinert. Test → PASS.
- [ ] **Step 4:** `vite.config.ts`: `base: '/'`, `build.rollupOptions.input` mit `index.html` und `datenschutz/index.html`, `build.outDir: '../../dist'`, `build.emptyOutDir: false` (das Leeren macht `scripts/build.mjs`).
- [ ] **Step 5:** `Start.tsx`: `<Header tool="Übersicht" />`, `h1` «Werkzeuge fürs BBZB», Kacheln als Liste von Links (`<a href={t.pfad}>`) mit Vorschaubild (`alt=""`, Name steht daneben), Name, Satz, Badge «Beta». Fusszeile mit Links «Datenschutz» und «Quellcode» (`https://github.com/bbzb-lu/bbzb-tools`). Gestaltung mit `/impeccable` (shape, dann critique), eckig, nur `var(--…)` aus `theme`, Tastatur und Fokusring wie in `kit.css`.
- [ ] **Step 6:** `Datenschutz.tsx`, Text genau so (ein Absatz pro Punkt, Überschrift `h1` «Datenschutz»):
  - «BBZB Tools läuft ganz in deinem Browser. Es gibt keinen Server, der deine Bilder, Texte oder Projekte bekommt.»
  - «Wir speichern nichts bei uns. Wenn ein Tool deine Arbeit sichert, dann nur in deinem Browser auf deinem Gerät.»
  - «Es gibt keine Analyse, kein Tracking und keine Cookies.»
  - Abschnitt «Ausnahmen» mit dem Satz «Zurzeit gibt es keine Ausnahmen.» (Plan 2 und 3 ersetzen ihn durch die Sätze zu Studio, Sudoku und Radio.)
  - «Nachprüfen: Jede Seite schickt eine Content-Security-Policy, die dem Browser verbietet, Daten an andere Adressen zu senden. Du siehst sie in den Entwicklertools unter Netzwerk. Der Quellcode ist öffentlich, und ein automatischer Test prüft bei jeder Änderung, dass keine fremden Adressen angefragt werden.»
- [ ] **Step 7:** `npm run typecheck && npm run lint && npm test` grün. `npm run dev -w apps/startseite`, Startseite und `/datenschutz/` in Edge öffnen, Screenshot ansehen.
- [ ] **Step 8:** `apps/startseite/AGENTS.md` (unter 20 Zeilen): neues Tool = Eintrag in `tools.ts` plus Vorschaubild 960 × 540; Datenschutz-Text anpassen, wenn ein Tool eine Ausnahme bekommt.
- [ ] **Step 9:** Commit `Start page with tool tiles and privacy page`.

### Task 4: Gesamtbuild, Header und gemeinsame e2e-Tests

**Files:**
- Create: `scripts/build.mjs`, `_headers`, `playwright.config.ts`, `e2e/suite.spec.ts`, `e2e/helpers.ts`, `e2e/tsconfig.json` (erweitert `tsconfig.base.json`, im Root-`tsconfig.json` als Referenz eingetragen)

**Interfaces:**
- Consumes: `tools` aus `apps/startseite/src/tools.ts`.
- Produces: `npm run build` erzeugt `dist/` (Startseite in der Wurzel, je Tool `dist/<id>/`, `_headers`). `e2e/helpers.ts` exportiert `foreignRequests(page: Page): string[]` (sammelt jede Anfrage, die nicht mit der eigenen Herkunft, `blob:` oder `data:` beginnt). Playwright-Projekte `suite` (Basis `http://localhost:8788/`) und je Tool eines mit Basis `http://localhost:8788/<id>/` und `testDir: 'apps/<id>/e2e'`.

- [ ] **Step 1:** `scripts/build.mjs`: `fs.rmSync('dist', { recursive: true, force: true })`, dann `npm run build -w apps/startseite` und für jede weitere App `npm run build -w apps/<id>` (Liste aus `fs.readdirSync('apps')`), danach `fs.copyFileSync('_headers', 'dist/_headers')`. Nur Node-APIs und `child_process.execSync`, Abbruch mit Exit-Code ≠ 0 bei Fehler.
- [ ] **Step 2:** `_headers`: Regel `/*` mit `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` und der strengen CSP aus `../bbzb-news-banner/public/_headers` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`). Kommentar oben: «Weichere CSP für einen Pfad: eigene Regel mit `! Content-Security-Policy` und neuer CSP, sonst addiert Cloudflare beide.»
- [ ] **Step 3:** `playwright.config.ts`: `webServer.command: 'npm run build && npx wrangler pages dev dist --port 8788'`, `url: 'http://localhost:8788'`, `reuseExistingServer: !process.env.CI`, alle Projekte mit `channel: 'msedge'`. Bestehende Tool-Tests rufen danach `page.goto('')` statt `page.goto('/')` auf, sonst landen sie auf der Startseite.
- [ ] **Step 4: Failing Tests** `e2e/suite.spec.ts`:
  ```ts
  test('jede Seite: keine fremden Requests', async ({ page }) => {
    for (const p of ['/', '/datenschutz/', ...tools.map((t) => t.pfad)]) {
      const foreign = foreignRequests(page);
      await page.goto(p); await page.waitForLoadState('networkidle');
      expect(foreign, p).toEqual([]);
    }
  });
  test('jede Seite liefert genau eine CSP', async ({ request }) => {
    for (const p of ['/', '/datenschutz/', ...tools.map((t) => t.pfad)]) {
      const csp = (await request.get(p)).headers()['content-security-policy'];
      expect(csp, p).toBeTruthy(); expect(csp, p).not.toContain(',');
    }
  });
  test('Kachel öffnet das Tool, Logo führt zurück', async ({ page }) => {
    for (const t of tools) {
      await page.goto('/'); await page.getByRole('link', { name: new RegExp(t.name) }).click();
      await expect(page).toHaveURL(new RegExp(`${t.pfad}$`));
      await page.getByRole('link', { name: 'BBZB Tools, zur Startseite' }).click();
      await expect(page).toHaveURL(/\/$/);
    }
  });
  test('Unterpfad ohne Schrägstrich und Neuladen laden vollständig', async ({ page }) => {
    for (const t of tools) {
      const failed: string[] = []; page.on('requestfailed', (r) => failed.push(r.url()));
      await page.goto(t.pfad.slice(0, -1)); await page.reload(); await page.waitForLoadState('networkidle');
      // fonts.check() wäre auch ohne @font-face true; load() liefert nur bei vorhandener Schrift einen Eintrag
      expect(await page.evaluate(async () => (await document.fonts.load('16px "Host Grotesk"')).length)).toBeGreaterThan(0);
      expect(failed).toEqual([]);
    }
  });
  ```
- [ ] **Step 5:** `npx playwright test --project suite` → FAIL, solange das Banner fehlt (Kachel ohne Ziel). Dass der Kacheltest bei fehlendem Tool scheitert, ist der Beleg, dass er etwas prüft.
- [ ] **Step 6:** Commit `Suite build, headers and suite-wide e2e` (Tests rot bis Task 5, im Commit-Text vermerken).

### Task 5: News-Banner umziehen

**Files:**
- Create: `apps/news-banner/` aus `../bbzb-news-banner/`: `src/`, `e2e/`, `public/{badges,licenses,favicon.svg}`, `scripts/build-lucide-meta.mjs`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `AGENTS.md`, `CLAUDE.md`, `docs/` (Plan und `deployment.md` nach `docs/archiv/`, PSD-Vorlagen nach `docs/reference/`)
- Delete (in der Kopie): `src/ui/kit/`, `src/ui/theme.ts`, `src/ui/base.css`, `src/ui/fonts.css`, `src/ui/Logo.tsx`, `public/fonts/`, `public/_headers`, Logo-Regeln in `src/ui/app.css`
- Modify: `src/main.tsx`, `src/App.tsx`, alle Importe von `./ui/kit/…`, `e2e/*.spec.ts`, `apps/startseite/src/tools.ts` (nichts, Eintrag existiert schon)

**Interfaces:**
- Consumes: `Button`, `Switch`, `Segmented`, `Header`, `applyTheme` und CSS aus `@bbzb/ui`; `foreignRequests` aus `../../e2e/helpers.ts`.

- [ ] **Step 1:** Dateien kopieren (ohne `.git`, `node_modules`, `dist`, `test-results`). `package.json`: Name `news-banner`, eigene `dependencies` (`lucide`, `@bbzb/ui: "*"`), devDependencies nur was die Wurzel nicht hat (`lucide-static`, `@tabler/icons`), Skripte `dev`, `build`, `build:lucide-meta`; kein `deploy`. `vite.config.ts`: `base: '/news-banner/'`, `build.outDir: '../../dist/news-banner'`, `emptyOutDir: false`, `previewHeaders` entfernen.
- [ ] **Step 2:** Importe auf `@bbzb/ui` umstellen; in `main.tsx` die CSS-Einstiege aus `@bbzb/ui` laden, `applyTheme` von dort. `Logo` durch `<Header tool="News-Banner" />` ersetzen (gleiche Stelle im Layout).
- [ ] **Step 3:** In `App.tsx` `load('/badges/info.png')` → `load(\`${import.meta.env.BASE_URL}badges/info.png\`)`, ebenso `stoerung.png`. Danach `grep -rn "'/[a-z]" apps/news-banner/src` → keine Treffer ausser Tests.
- [ ] **Step 4:** In `e2e/*.spec.ts` `page.goto('/')` → `page.goto('')`; den Test «Keine fremden Requests» auf `foreignRequests` umstellen. Pixel- und Exporttests bleiben unverändert, kein Sollwert wird angepasst.
- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test && npm run test:e2e` → alles grün, inklusive `suite`.
- [ ] **Step 6:** Selbst angeschaut: `npm run build && npx wrangler pages dev dist --port 8788`, in Edge `/news-banner/` öffnen, beide Zielgruppen und «Störung» exportieren, PNG neben die PSD-Vorschau in `docs/reference/` legen und vergleichen. Kopf zeigt «BBZB Tools / News-Banner», Klick führt zur Startseite.
- [ ] **Step 7:** `AGENTS.md` aus der alten `CLAUDE.md` kürzen: Hinweise auf Schwesterprojekt, kopierte Oberfläche, Hosting und Deploy entfallen (steht im Hauptordner); Fallen, Icon-Suche, Unverhandelbares fürs Banner bleiben. `CLAUDE.md` = `@AGENTS.md`.
- [ ] **Step 8:** Commit `Move news banner into the suite`.

### Task 6: CI, automatischer Deploy, Labels und Board

**Files:**
- Create: `.github/workflows/ci.yml`, `docs/deployment.md`, `.github/ISSUE_TEMPLATE/idee.yml`

**Interfaces:**
- Consumes: Root-Skripte aus Task 1, `npm run build` aus Task 4.

- [ ] **Step 1:** `ci.yml`: Auslöser `pull_request` und `push` auf `main`. Job `test` auf `ubuntu-latest`: `actions/setup-node` mit `.nvmrc`, `npm ci`, `npx playwright install --with-deps msedge`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`. Job `windows` auf `windows-latest`: nur `npm ci`, `npm run build`, `npm test`. Job `deploy` nur bei `push` auf `main`, `needs: [test, windows]`: `npm ci`, `npm run build`, `npx wrangler pages deploy dist --project-name bbzb-tools --branch main` mit `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` aus den Secrets. Kein `pull_request_target`.
- [ ] **Step 2:** `docs/deployment.md` (unter 30 Zeilen): Ablauf, Secrets, Live-Adresse, Prüfung nach Deploy (`curl -sI https://bbzb-tools.pages.dev/news-banner/` → genau eine `content-security-policy`), Falle aus dem Banner übernehmen: nie `wrangler pages project create`, Projekt per API anlegen.
- [ ] **Step 3:** Issue-Vorlage `idee.yml`: Felder «Was soll anders sein?», «Bereich» (Auswahl `social-studio`, `news-banner`, `embeds`, `startseite`, `alle`), Hinweis «Keine echten Fotos, Namen oder Projektdateien anhängen.»
- [ ] **Step 4: Rückfrage bei Alexej**, dann gemeinsam: Branch `plan-1` pushen, Pull Request öffnen, CI-Lauf grün abwarten (Beleg: `gh pr checks`). Alexej legt das Cloudflare-Projekt `bbzb-tools` per API an (Befehl aus `docs/deployment.md`) und setzt die zwei Secrets in `bbzb-lu/bbzb-tools`. Labels anlegen (`gh label create` für die fünf Bereiche) und ein GitHub Project «BBZB Tools» mit den Spalten Eingang, Geplant, In Arbeit, Erledigt.
- [ ] **Step 5:** Nach Alexejs Freigabe mergen. Deploy-Job grün abwarten, dann live prüfen: `curl -sI` wie in Step 2, Startseite, Datenschutz und `/news-banner/` in Edge öffnen, ein Banner exportieren.
- [ ] **Step 6:** Commit `CI, deploy and issue template` (vor Step 4).

### Abschluss von Plan 1
- [ ] `superpowers:requesting-code-review` über den ganzen Branch, Befunde beheben.
- [ ] Offene Punkte aus `../bbzb-news-banner` (Plan, offene Tests) als Issues mit Label `news-banner` anlegen (nach Rückfrage).
- [ ] Plan 1 nach `docs/archiv/` verschieben, Plan 2 (Social Studio) schreiben.
