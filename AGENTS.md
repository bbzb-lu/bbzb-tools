# BBZB Tools

Websuite des BBZB Luzern mit kleinen Browser-Tools, die den Schulalltag einfacher machen. Alles läuft im Browser, nichts wird hochgeladen.

## Ordner
- `apps/`: ein Ordner pro Tool, jeweils mit eigener `AGENTS.md`. `apps/_vorlage/` ist die Vorlage für neue Tools
- `packages/ui/`: gemeinsame Oberfläche (Theme, Bauteile)
- `embeds/`: folgt
- `docs/`: Spezifikationen und Pläne

Arbeite im Ordner des Tools und lies dessen `AGENTS.md`, nicht die anderer Tools.

## Unverhandelbar
- Nichts verlässt den Browser: kein Backend, kein Upload, keine Analytics, keine Laufzeit-CDNs. Für Startseite und Banner gilt `connect-src 'self'`.
- Werte (Farben, Masse) nur in `packages/ui/src/theme.ts` bzw. `apps/news-banner/src/tokens.ts`, nirgends sonst hart codiert.
- Texte auf Deutsch mit Schweizer Rechtschreibung: «ss» statt «ß», Guillemets «…», Du-Form, kurz. Keine Halbgeviertstriche (–). Gilt auch für `.md`.
- Zielgeräte: Windows 11 mit Edge. Playwright läuft mit `channel: 'msedge'`.
- Keine absoluten Pfade wie `'/badges/…'` oder `url('/fonts/…')`, jedes Tool läuft unter einem Unterpfad. Assets importieren oder `import.meta.env.BASE_URL` nutzen.
- Speichert ein Tool etwas (`localStorage`, IndexedDB, OPFS), beginnt jeder Schlüssel und jeder Datenbank- oder Ordnername mit der Tool-ID (`news-banner`, `startseite`).
- Braveold (lizenziert) gehört nie ins Repo, es ist öffentlich. Segoe UI darf rein (Schullizenz).

## Arbeitsweise
- Code erst nach `packages/`, wenn ein zweites Tool ihn braucht.
- Vor jedem Commit grün: `npm run typecheck`, `npm run lint`, `npm test`, bei UI oder Export zusätzlich `npm run test:e2e`.
- Dateien unter 400 Zeilen, Notizen kurz, `AGENTS.md` je Ordner unter 60 Zeilen.
- Commits klein und auf Englisch. Arbeit auf Branches, `main` bleibt lauffähig.
- Issues mit einem Label pro Bereich (Tool oder Paket). Keine echten Fotos, Namen oder Projektdateien anhängen.
- Hilfreich, aber freiwillig: Superpowers (Ablauf), Impeccable (UI), Ponytail (wenig Code).

## Befehle
`npm install`, `npm run dev:startseite`, `npm run build`
Neues Tool: `npm run neues-tool -- <id> "<Name>"`, danach Satz und Vorschaubild in der Startseite ersetzen (`apps/startseite/AGENTS.md`).
Für das Social Studio: `npm run fonts` holt Braveold aus dem privaten Repo (Zugriff nötig).
Ohne Zugriff auf Braveold scheitern einzelne Studio-Tests. Dann nur das eigene Tool testen: `npx vitest --project <id> run` und `npx playwright test --project <id>` (id wie in `apps/startseite/src/tools.ts`).
`npm run test:e2e` braucht die Testvideos: `sh apps/social-studio/scripts/make-test-videos.sh` (braucht ffmpeg).
