# Mensa Bahnhof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue App `apps/mensa-bahnhof/` zeigt den SV-Mittagsmenüplan mobil, Daten holt eine GitHub Action.

**Architecture:** Reine Funktionen in `src/menu.ts` (Parsen, Selbstprüfung) und `src/ansicht.ts` (was die Seite zeigt), beide mit Vitest. Ein Node-Skript liest die SV-Seite mit Playwright und schreibt `public/menu.json`. Eine geplante Action committet die Datei und stösst den normalen CI-Deploy an. Die React-Seite lädt nur `menu.json` von der eigenen Herkunft.

**Tech Stack:** React 19, Vite, `@bbzb/ui`, Vitest, Playwright (Chromium im Skript, msedge in e2e), Node 26 (importiert `.ts` direkt), GitHub Actions, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-11-24-mensa-bahnhof-design.md`

## Global Constraints

- Tool-ID `mensa-bahnhof`, Name «Mensa Bahnhof», Pfad `/mensa-bahnhof/`.
- Quelle: `https://sv-gastronomie.ch/menu/BBZB,%20Luzern/Mittagsmen%C3%BC`.
- Der Browser lädt nur von der eigenen Herkunft, `_headers` bleibt unverändert (`connect-src 'self'`).
- Texte von SV unverändert übernehmen, nur Leerraum trimmen.
- Werte (Farben, Masse) nur aus `packages/ui/src/theme.ts`, keine absoluten Pfade, `menu.json` über `import.meta.env.BASE_URL`.
- Deutsch mit Schweizer Rechtschreibung, Guillemets, Du-Form, keine Halbgeviertstriche (–), auch in `.md`.
- Kein `localStorage`, keine Analytics.
- Dateien unter 400 Zeilen, `apps/mensa-bahnhof/AGENTS.md` unter 60 Zeilen.
- Preise und Gruppen: `EXT` «Externe», `MA` «Mitarbeitende» (Standard), `SCHU` «Lernende». URL `?preis=ma|schu|ext`.
- Commits klein, englisch, mit Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Arbeit in eigenem Worktree auf Branch `mensa-bahnhof` von `main` (der Hauptordner hat fremde, ungespeicherte Änderungen).
- Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npx vitest --project mensa-bahnhof run`; bei UI zusätzlich `npx playwright test --project mensa-bahnhof --project suite`.

## Review Focus

1. Jahreswechsel: Woche Mo 28.12.2026 bis Fr 1.1.2027 muss korrekte ISO-Daten ergeben (Test in Task 1).
2. Linie ohne Beilagen oder mit nur einem Preis darf nicht verrutschen (Test in Task 1).
3. Wochenende und Feiertag: Samstag zeigt Montag der Folgewoche, leerer Tag zeigt «Heute kein Mittagsmenü» (Tests in Task 4).
4. Veraltete Datei: Enthält `menu.json` nur vergangene Wochen, erscheint «noch nicht da», nie ein alter Plan als heute (Test in Task 4).
5. Unbekannter oder gross geschriebener `?preis=` fällt sauber auf MA bzw. die passende Gruppe (Test in Task 4).

---

### Task 1: App anlegen, Typen und Parser

**Files:**
- Create (per Skript): `apps/mensa-bahnhof/**`, `apps/startseite/public/vorschau/mensa-bahnhof.png`, Eintrag in `apps/startseite/src/tools.ts`
- Create: `apps/mensa-bahnhof/src/menu.ts`, `apps/mensa-bahnhof/src/menu.test.ts`, `apps/mensa-bahnhof/src/fixtures/sv-tag.txt`

**Interfaces:**
- Produces (in `src/menu.ts`, nur löschbare TS-Syntax, keine `enum`, damit Node es direkt importiert):
  ```ts
  export type Preis = 'EXT' | 'MA' | 'SCHU';
  export type Linie = { linie: string; gericht: string; beilagen: string; preise: Partial<Record<Preis, string>> };
  export type Tag = { datum: string; linien: Linie[] };          // datum ISO 'YYYY-MM-DD'
  export type Woche = { montag: string; tage: Tag[] };
  export type MenuDatei = { geholt: string; quelle: string; wochen: Woche[] };
  export const QUELLE: string;
  export function parseLinien(text: string): Linie[];
  export function isoDatum(tagMonat: string, montag: string): string;
  ```

- [ ] **Step 1: Worktree und App anlegen**

Worktree nach `superpowers:using-git-worktrees`, Branch `mensa-bahnhof` von `main`. Dann `npm run neues-tool -- mensa-bahnhof "Mensa Bahnhof"`. Spec und Plan aus dem Hauptordner (`docs/superpowers/specs/2026-11-24-mensa-bahnhof-design.md`, `docs/superpowers/plans/2026-11-24-mensa-bahnhof.md`) in den Worktree kopieren und mitcommitten.

- [ ] **Step 2: Fixture aus der echten Seite holen**

Mit einem Wegwerf-Skript in der Scratchpad (Playwright, `ALLE ABLEHNEN` klicken, ersten Tag wählen) den `innerText` des Menübereichs eines Tages in `src/fixtures/sv-tag.txt` speichern. Erwartete Form (Stand 24.11.2026):
```
Kunterbunt
Kalbshacksteak
Kräuterjus, Bratkartoffeln , Butterbohnen
EXT  CHF 14.50
MA  CHF 14.50
SCHU  CHF 11.50
Querbeet
…
```

- [ ] **Step 3: Failing Tests schreiben** in `src/menu.test.ts`

```ts
test('parseLinien liest alle vier Linien des Fixtures', () => {
  const l = parseLinien(readFileSync(new URL('./fixtures/sv-tag.txt', import.meta.url), 'utf8'));
  expect(l.length).toBeGreaterThanOrEqual(1);
  for (const x of l) { expect(x.linie).not.toBe(''); expect(x.gericht).not.toBe(''); expect(Object.keys(x.preise).length).toBeGreaterThan(0); }
});
test('parseLinien: Linie ohne Beilagen und mit nur einem Preis', () => {
  expect(parseLinien('Querbeet\nFregola Sarda\nMA  CHF 14.50\nAlternative\nDöner\nKraut | Salat\nSCHU  CHF 14.00')).toEqual([
    { linie: 'Querbeet', gericht: 'Fregola Sarda', beilagen: '', preise: { MA: '14.50' } },
    { linie: 'Alternative', gericht: 'Döner', beilagen: 'Kraut | Salat', preise: { SCHU: '14.00' } },
  ]);
});
test('parseLinien: leerer Text ergibt leere Liste', () => expect(parseLinien(' \n ')).toEqual([]));
test('isoDatum über den Jahreswechsel', () => {
  expect(isoDatum('28.12.', '2026-12-28')).toBe('2026-12-28');
  expect(isoDatum('01.01.', '2026-12-28')).toBe('2027-01-01');
  expect(isoDatum('1.1.', '2026-12-28')).toBe('2027-01-01');
});
```

- [ ] **Step 4: Run** `npx vitest --project mensa-bahnhof run` → FAIL (Funktionen fehlen).

- [ ] **Step 5: `menu.ts` umsetzen**

`parseLinien`: Zeilen trimmen, leere weg. Preiszeile: `/^(EXT|MA|SCHU)\s+CHF\s+([\d.]+)$/`. Ein Block sind die Nicht-Preiszeilen vor einer Folge von Preiszeilen: erste Zeile `linie`, zweite `gericht`, Rest mit `' '` verbunden als `beilagen`. Innere Leerzeichen der Texte nicht verändern (z. B. «Bratkartoffeln , Butterbohnen» bleibt so). `isoDatum`: Jahr des Montags, liegt das Ergebnis mehr als 7 Tage vor dem Montag, Jahr + 1.

- [ ] **Step 6: Run** `npx vitest --project mensa-bahnhof run` → PASS.

- [ ] **Step 7: Commit** `feat(mensa-bahnhof): scaffold app, menu types and parser`

### Task 2: Zielwoche und Selbstprüfung

**Files:**
- Modify: `apps/mensa-bahnhof/src/menu.ts`, `apps/mensa-bahnhof/src/menu.test.ts`

**Interfaces:**
- Consumes: Typen aus Task 1.
- Produces:
  ```ts
  export function zielMontag(jetzt: Date): string;            // ISO, Zeitzone Europe/Zurich
  export function wochentage(montag: string): string[];       // 5 ISO-Daten Mo bis Fr
  export function pruefeWoche(w: Woche | undefined, montag: string): string | null; // null = gültig, sonst Fehlertext
  export function gueltig(datei: MenuDatei | undefined, montag: string): boolean;  // Zielwoche schon gültig drin?
  ```

- [ ] **Step 1: Failing Tests**

```ts
test('zielMontag: Mo bis Do laufende Woche, Fr bis So nächste', () => {
  expect(zielMontag(new Date('2026-11-23T04:00:00Z'))).toBe('2026-11-23'); // Mo
  expect(zielMontag(new Date('2026-11-26T12:00:00Z'))).toBe('2026-11-23'); // Do
  expect(zielMontag(new Date('2026-11-27T17:00:00Z'))).toBe('2026-11-30'); // Fr 18 Uhr
  expect(zielMontag(new Date('2026-11-29T23:30:00Z'))).toBe('2026-11-30'); // Mo 0:30 in Zürich
  expect(zielMontag(new Date('2026-12-26T05:00:00Z'))).toBe('2026-12-28');
});
test('wochentage über Monatsende', () => expect(wochentage('2026-11-30')).toEqual(['2026-11-30','2026-12-01','2026-12-02','2026-12-03','2026-12-04']));
const tag = (datum: string, n = 1): Tag => ({ datum, linien: Array.from({ length: n }, () => ({ linie: 'L', gericht: 'G', beilagen: '', preise: { MA: '1.00' } })) });
test('pruefeWoche', () => {
  const ok = { montag: '2026-11-30', tage: wochentage('2026-11-30').map((d) => tag(d)) };
  expect(pruefeWoche(ok, '2026-11-30')).toBeNull();
  expect(pruefeWoche(undefined, '2026-11-30')).toMatch(/fehlt/);
  expect(pruefeWoche({ ...ok, tage: ok.tage.slice(0, 4) }, '2026-11-30')).not.toBeNull();
  expect(pruefeWoche({ ...ok, tage: ok.tage.map((t, i) => (i === 2 ? { ...t, datum: '2026-12-09' } : t)) }, '2026-11-30')).not.toBeNull();
  expect(pruefeWoche({ ...ok, tage: ok.tage.map((t) => tag(t.datum, 0)) }, '2026-11-30')).toBeNull(); // Ferien: alle leer, Daten stimmen
  expect(pruefeWoche({ ...ok, tage: [{ datum: '2026-11-30', linien: [{ linie: 'L', gericht: '', beilagen: '', preise: {} }] }, ...ok.tage.slice(1)] }, '2026-11-30')).not.toBeNull();
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** umsetzen; Wochentag und Datum in Zürich über `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', … })`, Datumsrechnung in UTC-Mitternacht. `pruefeWoche` meldet: Woche fehlt, falsche Anzahl oder falsche Daten, Linie ohne Gericht oder ohne Preis. **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat(mensa-bahnhof): target week and self-check`

### Task 3: Skript `hole-menu.mjs` und erste `menu.json`

**Files:**
- Create: `apps/mensa-bahnhof/scripts/hole-menu.mjs`, `apps/mensa-bahnhof/public/menu.json`

**Interfaces:**
- Consumes: `parseLinien`, `isoDatum`, `zielMontag`, `pruefeWoche`, `gueltig`, `QUELLE`, Typen (Import `../src/menu.ts`).
- Produces: `node apps/mensa-bahnhof/scripts/hole-menu.mjs [--ziel YYYY-MM-DD]`. Exit 0 mit Ausgabe `unverändert: <montag>` (schon gültig, kein SV-Aufruf) oder `geschrieben: <montag>`; Exit 1 mit Fehlertext aus `pruefeWoche`, Datei unberührt. `menu.json` im Format `MenuDatei`, `wochen` nach `montag` sortiert, nur die von SV angebotenen Wochen.

- [ ] **Step 1: Skript schreiben.** `chromium` aus `playwright`, Seite laden, Cookie-Dialog mit «ALLE ABLEHNEN» schliessen, im Wochen-Select nacheinander «Diese Woche» und «Nächste Woche» wählen, je Tag-Reiter klicken, Datum aus dem Reiter (`23.11.`) mit `isoDatum` und den `innerText` des Menübereichs mit `parseLinien` lesen. Montag einer Woche ist das Datum des ersten Reiters (bei Ferienwoche ohne Mo-Reiter: `pruefeWoche` scheitert, gewollt). Ist `gueltig(datei, ziel)` schon vorher wahr: sofort `unverändert`. `geholt` = `new Date().toISOString()`. Datei nur schreiben, wenn `pruefeWoche(zielwoche) === null`; ändert sich ausser `geholt` nichts, Datei nicht anfassen.

- [ ] **Step 2: Run** `node apps/mensa-bahnhof/scripts/hole-menu.mjs` → `geschrieben: 2026-11-23` (bzw. aktuelle Zielwoche), `menu.json` enthält zwei Wochen mit je fünf Tagen.

- [ ] **Step 3: Run nochmals** → `unverändert: …`, `git diff --stat` leer.

- [ ] **Step 4: Run** mit `--ziel 2027-03-01` → Exit 1, Meldung «… fehlt», `menu.json` unverändert.

- [ ] **Step 5: Commit** `feat(mensa-bahnhof): fetch script and first menu.json`

### Task 4: Ansicht-Logik

**Files:**
- Create: `apps/mensa-bahnhof/src/ansicht.ts`, `apps/mensa-bahnhof/src/ansicht.test.ts`

**Interfaces:**
- Consumes: Typen, `wochentage` aus `menu.ts`.
- Produces:
  ```ts
  export type Gruppe = { preis: Preis; name: string };
  export const GRUPPEN: Gruppe[]; // MA Mitarbeitende, SCHU Lernende, EXT Externe (in dieser Reihenfolge)
  export function preisAus(search: string): Preis;  // '?preis=schu' → 'SCHU', fehlt/unbekannt → 'MA', Gross/Klein egal
  export type Ansicht =
    | { zustand: 'fehlt' }
    | { zustand: 'geschlossen'; woche: Woche }
    | { zustand: 'offen'; woche: Woche; start: string; titel: 'Heute' | 'Am Montag' };
  export function ansicht(datei: MenuDatei | undefined, jetzt: Date): Ansicht;
  export function tagTitel(datum: string, wochentag = true): string; // 'Dienstag 24. November' bzw. '24. November'
  ```

- [ ] **Step 1: Failing Tests** (Datei mit Wochen `2026-11-23` und `2026-11-30`, Lokalzeit des Geräts):
  - Di 24.11. 10 Uhr → `offen`, `start` `2026-11-24`, `titel` `Heute`.
  - Sa 28.11. → `offen`, Woche `2026-11-30`, `start` `2026-11-30`, `titel` `Am Montag`.
  - So 29.11. ohne Woche `2026-11-30` in der Datei → `fehlt`.
  - Mo 7.12. bei Datei nur mit alten Wochen → `fehlt`.
  - Woche mit lauter leeren Tagen → `geschlossen`.
  - Mi mit leerem Tag (Feiertag) → `offen` mit `start` dieses Tages (die Seite zeigt dann «Heute kein Mittagsmenü»).
  - `preisAus('')`, `preisAus('?preis=foo')` → `MA`; `preisAus('?preis=SCHU')`, `preisAus('?preis=schu')` → `SCHU`; `preisAus('?preis=ext')` → `EXT`.
  - `tagTitel('2026-11-24')` → `Dienstag 24. November`.

- [ ] **Step 2: Run** → FAIL. **Step 3:** umsetzen (`Intl.DateTimeFormat('de-CH', …)` für `tagTitel`). **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat(mensa-bahnhof): view logic`

### Task 5: Seite

**Files:**
- Modify: `apps/mensa-bahnhof/src/App.tsx`, `apps/mensa-bahnhof/src/app.css`, `apps/mensa-bahnhof/e2e/start.spec.ts`
- Create: `apps/mensa-bahnhof/e2e/fixture-menu.json` (Kopie der Datei aus Task 3, Wochen fest)

**Interfaces:**
- Consumes: `ansicht`, `preisAus`, `GRUPPEN`, `tagTitel`, `QUELLE`, `MenuDatei`.

UI mit `impeccable:impeccable`, mobil zuerst (360 px), Bauteile `Header`, `Segmented` aus `@bbzb/ui`. Spec-Abschnitt «Seite» gilt wörtlich: Überschrift `<h1>` «Heute, Dienstag 24. November» bzw. «Am Montag, 30. November» (`tagTitel(start, false)`); Karten je Linie (Linie klein, Gericht gross, Beilagen, hervorgehobener Preis gross mit Gruppenname, zwei andere klein); `Segmented` mit `legend` «Tag» und Optionen `Mo`…`Fr`; Texte «Der Menüplan dieser Woche ist noch nicht da», «Diese Woche kein Mittagsmenü», «Heute kein Mittagsmenü» (bei anderem gewähltem Tag: «Kein Mittagsmenü»); Fusszeile «Quelle: SV Restaurant» mit Link auf `QUELLE` und Stand aus `geholt`. Lädt `${import.meta.env.BASE_URL}menu.json` mit `cache: 'no-cache'`; Ladefehler wie `fehlt`.

- [ ] **Step 1: e2e-Tests schreiben** in `e2e/start.spec.ts` (ersetzt den Vorlage-Test). Jeder Test: `page.clock.setFixedTime(new Date('2026-11-24T10:00:00'))`, `page.route('**/menu.json', r => r.fulfill({ path: … fixture-menu.json }))`, `foreignRequests` am Ende leer.
  - Kopf-Link «BBZB Tools, Mensa Bahnhof, zur Startseite» sichtbar, `h1` enthält «Heute».
  - Erstes Gericht des Fixture-Dienstags sichtbar, Text «Mitarbeitende» beim grossen Preis.
  - `?preis=schu` → «Lernende» beim grossen Preis.
  - Klick auf «Do» → Gericht des Donnerstags sichtbar.
  - Zeit Samstag 28.11. → `h1` enthält «Am Montag».
  - Route liefert 404 → «Der Menüplan dieser Woche ist noch nicht da» und Link auf die SV-Seite.
  - Viewport 360 × 740: erstes Gericht ohne Scrollen sichtbar (`toBeInViewport`).

- [ ] **Step 2: Run** `npx playwright test --project mensa-bahnhof` → FAIL.
- [ ] **Step 3: Seite umsetzen.**
- [ ] **Step 4: Run** `npx playwright test --project mensa-bahnhof --project suite` → PASS. Screenshots bei 360 px und 1280 px in Edge ansehen.
- [ ] **Step 5: Commit** `feat(mensa-bahnhof): mobile menu page`

### Task 6: Action und Deploy-Anstoss

**Files:**
- Create: `.github/workflows/mensa-bahnhof.yml`
- Modify: `.github/workflows/ci.yml` (Trigger und Bedingung des Jobs `deploy`)

**Interfaces:**
- Consumes: Skript aus Task 3 (Exit-Codes).

- [ ] **Step 1: `ci.yml`**: `workflow_dispatch:` unter `on:` ergänzen; Bedingung von `deploy` auf `github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`. Begründung als Kommentar: ein Push mit `GITHUB_TOKEN` startet keine Workflows, `workflow_dispatch` schon.

- [ ] **Step 2: `mensa-bahnhof.yml`**:
  - `on`: `schedule` mit `0 17 * * 5` und `0 5 * * 6,0,1`, dazu `workflow_dispatch`.
  - `permissions: contents: write, actions: write`, `concurrency: mensa-bahnhof`.
  - Schritte: checkout `main`, setup-node (`.nvmrc`, Cache npm), `npm ci`, `npx playwright install --with-deps chromium`, `node apps/mensa-bahnhof/scripts/hole-menu.mjs`.
  - Hat sich `apps/mensa-bahnhof/public/menu.json` geändert: commit als `github-actions[bot]` mit `chore(mensa-bahnhof): update menu <montag>`, push auf `main`, dann `gh workflow run ci.yml --ref main` (`GH_TOKEN: ${{ github.token }}`).
  - Scheitert das Skript am Freitag, Samstag oder Sonntag: Lauf grün beenden mit Hinweis im Log (`::notice::`), am Montag (und bei `workflow_dispatch`) rot. Wochentag in Zürich bestimmen (`TZ=Europe/Zurich date +%u`).

- [ ] **Step 3: Prüfen** mit `npx --yes @action-validator/cli@0.6.0 .github/workflows/mensa-bahnhof.yml .github/workflows/ci.yml` (oder `actionlint`, falls installiert) → keine Fehler. Echter Lauf erst nach dem Merge per `workflow_dispatch`.

- [ ] **Step 4: Commit** `ci(mensa-bahnhof): scheduled menu fetch triggers deploy`

### Task 7: Startseite, Notizen, QR-Codes

**Files:**
- Modify: `apps/startseite/src/tools.ts` (Satz), `apps/startseite/public/vorschau/mensa-bahnhof.png`, `apps/mensa-bahnhof/AGENTS.md`
- Create: `apps/mensa-bahnhof/docs/qr-ma.png`, `qr-schu.png`, `qr-ext.png`

- [ ] **Step 1:** Satz in `tools.ts`: `Mittagsmenü der Mensa Bahnhof, heute und die ganze Woche.` (unter 90 Zeichen). Vorschaubild 960 × 540 als Screenshot der Seite (Fixture-Daten, Viewport 960 × 540).
- [ ] **Step 2:** `AGENTS.md` der App (unter 60 Zeilen): Zweck, Datenweg (Action → `menu.json` → Deploy), Zeitplan, Selbstprüfung, `?preis=`, was bei rotem Montagslauf zu tun ist (SV-Seite prüfen, Parser anpassen, `workflow_dispatch`), dass das Skript bei SV-Layoutänderung bricht.
- [ ] **Step 3:** QR-Codes einmalig erzeugen, ohne neue Abhängigkeit: `npx --yes qrcode@1.5.4 -w 1024 -o apps/mensa-bahnhof/docs/qr-ma.png "https://bbzb-tools.pages.dev/mensa-bahnhof/"`, dazu `?preis=schu` und `?preis=ext`. Mit dem Handy prüfen, dass die Codes die richtige Adresse öffnen.
- [ ] **Step 4:** Gate komplett: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (oder bei fehlendem Braveold `npx playwright test --project mensa-bahnhof --project suite`), Exit-Codes prüfen.
- [ ] **Step 5: Commit** `docs(mensa-bahnhof): start tile, notes, QR codes`, danach PR mit Vorschau nach `docs/workflow.md`. Merge erst nach Rückfrage.
