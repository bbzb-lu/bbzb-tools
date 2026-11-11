# Plan 3: SharePoint Embeds

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans oder superpowers:subagent-driven-development. Schritte mit `- [ ]`.

**Goal:** Die sechs SharePoint-Embeds laufen als statische Ordner unter `/sharepoint/<name>/`, mit einer Übersicht `/sharepoint/` (Vorschau, Einbettungscode, Sortierung) und einer Kachel «SharePoint Embeds».

**Architecture:** Embeds bleiben HTML/CSS/JS ohne Build in `embeds/<name>/`, Schrift und Icons einmal in `embeds/_shared/`. `scripts/build.mjs` kopiert sie nach `dist/sharepoint/`. Die Übersicht ist eine normale App `apps/sharepoint` (Vite, `@bbzb/ui`), die die Beschreibungen `embeds/*/embed.json` beim Build einliest.

**Spec:** `docs/superpowers/specs/2026-11-10-bbzb-tools-design.md` (Embeds, Header, Tests, Abschluss)

## Global Constraints
- Embeds: `480 × 350` (Desktop) und `350 × 250` (Mobil) voll bedienbar, ohne Scrollbalken. Kein `border-radius`, keine weichen Schatten, Farben und `.ts-*`-Klassen wie im Vorlagen-`CLAUDE.md` (Gruppe A: Vorlage und Vier gewinnt).
- Ordnernamen: `radio-player`, `pomodoro-timer`, `suchspiel-auswertung`, `tictactoe`, `sudoku`, `viergewinnt`. Snake und Gruppengenerator ziehen nicht um.
- Externe Requests nur: Sudoku `https://sudoku-api.vercel.app` (connect-src), Radio `https://stream.streambase.ch` (media-src). Je nur auf ihrem Pfad.
- Embeds: `frame-ancestors 'self' https://sluz.sharepoint.com`. Alles andere bleibt `frame-ancestors 'none'`, auch `/sharepoint/` selbst.
- Dateinamen in `_shared/icons/` in NFC (Umlaute), keine `.DS_Store`, keine `.aseprite`, keine `node_modules`.
- Texte Schweizer Rechtschreibung, Du-Form, keine Halbgeviertstriche.

## Review Focus
- Ein Icon, das nur ein Embed hatte (Radio `pixel *.png`, Vier gewinnt `viergewinnt-*.png`, `robot-icon.png`), fehlt nach dem Umzug: Linkprüfung über alle Embeds (Task 1).
- Cloudflare addiert CSP-Regeln: jede Seite muss genau eine CSP haben, die Übersicht `/sharepoint/` darf nicht einbettbar sein (Task 2).
- Sudoku ohne Netz (API blockiert): Fallback auf lokales Rätsel muss greifen, sonst hängt das Embed in SharePoint bei API-Ausfall (Task 4).
- Einbettungscode zeigt auf die Adresse, unter der die Übersicht läuft (`location.origin`), damit er auch nach dem Domainwechsel stimmt; Sudoku braucht `allow="clipboard-write"` (Task 3).
- Änderung nur in `embeds/` muss im PR das Projekt `sharepoint` testen (Task 4, `scripts/e2e-projects.mjs`).

---

### Task 1: Embeds und gemeinsame Teile umziehen
**Files:** Create `embeds/_shared/{font,icons}/`, `embeds/<name>/{index.html,style.css,script.js,embed.json}` (6×), `embeds/_vorlage/` (aus `bbzb-hub-template`), `embeds/AGENTS.md`, `embeds/CLAUDE.md` (`@AGENTS.md`), `scripts/embeds.mjs` + `scripts/embeds.test.ts`. Modify `scripts/build.mjs`, `AGENTS.md` (Karte).
**Interfaces:** Produces `embed.json` = `{ "name": string, "satz": string, "datum": "YYYY-MM-DD", "extern"?: string }` (Datum = erster Commit des alten Repos, `extern` = Host bei Sudoku/Radio). `scripts/embeds.mjs` exportiert `fehlendeVerweise(dir): string[]` und `kopiereEmbeds(von, nach)`.
- [ ] Test: `fehlendeVerweise('embeds')` ist leer; jedes `embeds/<name>/` (ohne `_`) hat `index.html` und gültiges `embed.json`; kein Dateiname unter `embeds/` in NFD; keine `.DS_Store`.
- [ ] Kopieren aus den lokalen Repos (Stand `main`, ohne Git-Historie). `icons/` = Vereinigung aller Repos (NFC). Verweise `icons/…` → `../_shared/icons/…`, `url('font/…')` → `url('../_shared/font/…')`, auch in JS-Strings.
- [ ] `build.mjs`: nach den Apps `kopiereEmbeds('embeds', 'dist/sharepoint')` ohne `_vorlage`, mit `_shared`.
- [ ] `embeds/AGENTS.md` (< 60 Zeilen) aus Vorlagen-`CLAUDE.md`: Grössen, Pixelregeln, Tokens, `_shared`, neues Embed aus `_vorlage` + `embed.json`, Tests.
- [ ] Commit.

### Task 2: Header und CSP
**Files:** Modify `_headers`, `e2e/suite.spec.ts`, `e2e/helpers.ts`.
- [ ] Test (Suite): `seiten` enthält `/sharepoint/` und alle Embeds; jede Seite genau eine CSP; Embeds `frame-ancestors 'self' https://sluz.sharepoint.com`, alle anderen `frame-ancestors 'none'`; connect-src nur Sudoku mit `https://sudoku-api.vercel.app`, media-src nur Radio mit `https://stream.streambase.ch`; fremde Requests ausser diesen zwei auf ihrem Pfad: keine (Hosts im Test per `page.route` abgefangen, damit offline).
- [ ] `_headers`: `/sharepoint/*` (Embeds), danach `/sharepoint/sudoku/*`, `/sharepoint/radio-player/*`, zuletzt `/sharepoint/` und `/sharepoint/assets/*` (Übersicht, streng), je mit `! Content-Security-Policy`.
- [ ] Commit.

### Task 3: Übersicht `apps/sharepoint`
**Files:** `npm run neues-tool -- sharepoint "SharePoint Embeds"`, dann `apps/sharepoint/src/{App.tsx,embeds.ts,app.css}`, `apps/sharepoint/AGENTS.md`, `apps/sharepoint/e2e/uebersicht.spec.ts`; Modify `apps/startseite/src/{tools.ts,Illustration.tsx}`.
**Interfaces:** `embeds.ts`: `liste: Embed[]` aus `import.meta.glob('../../../embeds/*/embed.json', { eager: true, import: 'default' })`, `Embed = embed.json + { id }`; `code(e: Embed, origin: string): string` liefert `<iframe src="<origin>/sharepoint/<id>/" width="480" height="350" style="border:0" title="<name>"[ allow="clipboard-write"]></iframe>`.
- [ ] Unit-Test `code()`: Adresse, Masse, Titel, `allow` nur bei Sudoku; `liste` hat 6 Einträge mit Datum.
- [ ] Seite: Kopf `Header tool="SharePoint Embeds" feedback="SharePoint Embeds"`, Sortierung «Neueste zuerst» / «Name» (Segmented aus `@bbzb/ui`), je Embed Name, Satz, Datum, Hinweis bei `extern` («lädt Daten von …»), Vorschau als iframe in 480 × 350 (umschaltbar 350 × 250), Knopf «Einbettungscode kopieren» mit Rückmeldung «Kopiert».
- [ ] Kachel: `tools.ts` Eintrag `sharepoint` (Beta), Illustration-Schlüssel `sharepoint`.
- [ ] e2e: Sortierung ändert Reihenfolge; Kopieren legt Code mit `/sharepoint/<id>/` in die Zwischenablage; Vorschau-iframes laden.
- [ ] Commit.

### Task 4: Prüfungen der Embeds
**Files:** `apps/sharepoint/e2e/embeds.spec.ts`, `apps/sharepoint/e2e/viergewinnt.spec.ts`; Modify `scripts/e2e-projects.mjs` + Test.
- [ ] Je Embed bei 480 × 350 und 350 × 250 (Port von `verify.js`): kein Scrollbalken, RawPixel geladen, kein `border-radius`, kein weicher Schatten, keine JS-Fehler, keine Requests mit Status ≥ 400, kein `.titlebar-close`.
- [ ] Sudoku mit blockierter API zeigt trotzdem ein Rätsel. Radio: Stream-Request abgefangen, Seite ohne Fehler.
- [ ] Vier gewinnt (Port von `verify-spiel.js`, gekürzt): gegen Computer starten, ein Zug, Computer antwortet.
- [ ] `pick()`: Dateien unter `embeds/` wählen Projekt `sharepoint`. Test dafür.
- [ ] Commit.

### Task 5: Datenschutz und Doku
**Files:** Modify `apps/startseite/src/Datenschutz.tsx`, `docs/deployment.md`.
- [ ] «Ausnahmen»: Sudoku lädt Rätsel von sudoku-api.vercel.app, der Radio-Player den Stream von stream.streambase.ch. Dabei gehen keine Eingaben mit, wie bei jedem Abruf sieht der Anbieter nur die IP-Adresse.
- [ ] Commit, PR mit Vorschau-Link.

### Danach (mit Alexej, nicht Teil dieses PR)
- SharePoint-Einbettungen auf `https://bbzb-tools.pages.dev/sharepoint/<name>/` umstellen (Alexej).
- Alte Embed-Repos: Hinweis im README, dann archivieren (vorher fragen).
