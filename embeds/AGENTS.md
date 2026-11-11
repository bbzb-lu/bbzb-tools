# embeds (SharePoint Embeds)

Kleine Spiele und Tools für SharePoint-Seiten, als schlichtes HTML/CSS/JS ohne Build. Jedes Embed liegt in `embeds/<id>/` und läuft unter `/sharepoint/<id>/`. Die Übersicht mit Einbettungscode ist die App `apps/sharepoint`.

## Aufbau
- `<id>/index.html`, `style.css`, `script.js`, `embed.json` (`name`, `satz` höchstens 90 Zeichen, `datum` JJJJ-MM-TT, optional `extern` = Host, den es lädt).
- `_shared/font/` (RawPixel, lizenziert, darf öffentlich) und `_shared/icons/` (Pixel-PNGs): einmal für alle. Verweise immer `../_shared/…`, auch in JS-Strings und CSS `url()`.
- `_vorlage/`: Startpunkt für ein neues Embed, wird nicht deployt. Neues Embed: Ordner kopieren, `embed.json` ausfüllen, fertig. Die Übersicht findet es von selbst.
- Neue Icons nach `_shared/icons/`, Namen ohne Leerzeichen und Umlaute. Bestehende nicht löschen.

## Grösse (hart)
SharePoint-Webpart «Einbetten»: **480 × 350** (Desktop) und **350 × 250** (Mobil). Beides voll bedienbar, ohne Scrollbalken und ohne abgeschnittene Inhalte. Nutzbar im `.card-body` etwa 470 × 305 bzw. 340 × 205. Breit und flach planen.

## Look (Schulplaner 26/27, Pixel-Art)
- Tokens in `style.css` unter `:root`, in jedem Embed gleich, nie ändern: `--blue #4A6FA5`, `--blue-vivid #3B4FC8`, `--blue-light #C8D6E8`, `--pink #E84393`, `--yellow #FFD000`, `--dark #1A1A2E`, `--cream #FFF9E6`, `--font 'RawPixel'`.
- Kein `border-radius`, keine weichen Schatten (nur harte Offsets wie `4px 4px 0 var(--dark)`), `image-rendering: pixelated`.
- Fenster `.card` mit Titelleiste (drei Pixel-Punkte, Name wie `sudoku.exe`), **kein** Schliessen-Knopf.
- Titelbildschirm mit den Klassen `.ts-*` wie in `_vorlage`: Icon, Titel, ein Satz, ein oder zwei Knöpfe. Auswahl (Schwierigkeit, Figuren) erst auf Bildschirm 2.
- Schriftgrössen mit `clamp()` über Container-Einheiten; prüfen, dass sie sich zwischen den zwei Grössen wirklich ändern.

## Netz und Daten
- Keine fremden Requests. Ausnahmen nur mit Eintrag in `_headers` (eigener Pfad), `extern` in `embed.json`, Satz auf der Datenschutzseite: heute Sudoku (Rätsel-API) und Radio (Stream).
- Speichert ein Embed etwas im Browser, beginnt der Schlüssel mit `sharepoint-<id>`.

## Prüfen
`npx playwright test --project sharepoint`: jedes Embed in beiden Grössen (kein Scrollen, RawPixel geladen, keine Rundungen, keine weichen Schatten, keine Fehler), Linkprüfung `npx vitest run scripts/embeds`. Lokal ansehen: `npm run build && npx wrangler pages dev dist`, dann `/sharepoint/<id>/`.
