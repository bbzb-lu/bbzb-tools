# apps/mensa-bahnhof

Mittagsmenü der Mensa Bahnhof unter `/mensa-bahnhof/`. Gedacht für den QR-Code in der Mensa: zuerst das Menü von heute, darunter die Woche. Aktuell ein Test mit einer kleinen Gruppe.
Nie: Anfragen des Browsers an SV, qnips oder Google. Nie eine alte Woche als aktuelle zeigen.

## Datenweg
- Die Action `.github/workflows/mensa-bahnhof.yml` läuft Fr 17:00 UTC sowie Sa, So, Mo 05:00 UTC und per `workflow_dispatch`.
- `scripts/hole-menu.mjs` liest die SV-Seite mit Playwright Chromium (Locale `de-CH`, Cookie-Banner optional, Tabs `a.mat-mdc-tab-link`, Inhalt `mat-card-content.menu-wrapper`, leerer Tag `app-menu-no-data`).
- SV lädt den Inhalt bis ca. 1,5 s nach dem Tabwechsel nach. Das Skript wartet deshalb, bis sich der Inhalt ändert.
- Selbstprüfung `pruefeWoche` in `src/menu.ts`: genau Mo bis Fr, jede Zeile mit Gericht und Preis. Eine ganz leere Woche (Ferien) ist gültig.
- Danach committet die Action `menu.json` auf `main` und startet `gh workflow run ci.yml`, der normale Deploy folgt.

## Wenn es bricht
- Fr bis So: Fehler bleiben grün, mit Hinweis im Lauf.
- Montag: der Lauf wird rot und GitHub mailt.
- Dann die SV-Seite im Browser öffnen und prüfen, ob die Woche da ist. Hat SV das Layout geändert, die Selektoren im Skript anpassen. Danach per `workflow_dispatch` neu starten.
- Lokal: `node apps/mensa-bahnhof/scripts/hole-menu.mjs [--ziel YYYY-MM-DD]` (einmal `npx playwright install chromium`).

## Seite
- `?preis=ma|schu|ext` hebt einen Preis hervor (Standard `ma`). Logik in `src/ansicht.ts`.
- Labels: alle im Kartenkopf gebündelt, Vegan/Vegetarisch zuerst und grün, weitere grau. Icons (Tabler, MIT) in `src/icons.ts`, unbekannte Labels nur als Text.
- Der e2e-Test nutzt `e2e/fixture-menu.json` und eine feste Uhr.

## Betrieb
- GitHub schaltet geplante Workflows nach 60 Tagen ohne Aktivität im Repo ab. Hören die Menüs auf, den Workflow unter Actions wieder aktivieren.
- Bekommt `main` einen Branch-Schutz, braucht der Bot-Push eine Ausnahme.
- QR-Codes in `docs/`: `qr-ma.png`, `qr-schu.png`, `qr-ext.png`.

Starten: `npm run dev -w apps/mensa-bahnhof`.

## SharePoint-Embed
`embed/index.html` mit `src/einbettung.tsx` und `src/Embed.tsx`: nur der heutige Tag, kompakt für 480 × 350 und 350 × 250. Darf als einzige Seite des Tools in SharePoint (`_headers`, Regel `/mensa-bahnhof/embed/*`). Code für den Webpart «Einbetten»:
`<iframe src="https://bbzb-tools.pages.dev/mensa-bahnhof/embed/" width="480" height="350" style="border:0;overflow:hidden" title="Mensa Bahnhof"></iframe>`

## Infoscreen
`infoscreen/index.html` mit `src/bildschirm.tsx` und `src/Infoscreen.tsx` (Einstieg heisst anders, weil macOS `infoscreen.tsx` und `Infoscreen.tsx` nicht unterscheidet). Für die enlogic-Bildschirme beim Eingang, 1920 × 1080: nur heute, Lernende gross, dann Mitarbeitende, dann Externe. Masse in `vh`.
- Läuft tagelang ohne Reload: `useDatei(30 * 60_000)` holt `menu.json` neu, bei Fehlern bleibt das letzte Menü stehen.
- `_headers`: `/mensa-bahnhof/infoscreen/*` mit `frame-ancestors *` (CMS `infoscreen.lu.ch:8800`, der Player kann eine andere Adresse haben). Bei Bedarf auf diese Adressen einschränken.
- URL im enlogic-CMS: `https://bbzb-tools.pages.dev/mensa-bahnhof/infoscreen/`
