# Mensa Bahnhof auf dem Infoscreen

## Warum
Die Infoscreens beim Eingang (enlogic, CMS unter `infoscreen.lu.ch:8800`) sollen das Mittagsmenü zeigen. Die Website lässt sich heute nicht einbetten (`frame-ancestors 'none'`), und ihr Layout ist nicht für 1920 × 1080 aus ein paar Metern gemacht.

## Ziele
- Eigene Seite `/mensa-bahnhof/infoscreen/`, füllt 1920 × 1080 ohne Scrollen, lesbar im Vorbeigehen.
- Nur heute (am Wochenende: Montag), alle Gerichte nebeneinander: Linie, Labels, Gericht, Beilagen.
- Preise: Lernende gross, Mitarbeitende mittel, Externe klein.
- Läuft tagelang ohne Reload und zeigt trotzdem immer den richtigen Tag.

## Nicht-Ziele
Wochenvorschau, Preiswahl per URL, Links oder Bedienung.

## Ansätze
- **Eigene Seite als dritter Vite-Einstieg (gewählt):** wie das SharePoint-Embed, nur diese Seite wird einbettbar.
- Normale Seite mit `?infoscreen`: verworfen, sonst müsste die ganze Website einbettbar sein, und die Handy-Logik stört.

## Entscheide
- `_headers`: nur `/mensa-bahnhof/infoscreen/*` bekommt `frame-ancestors *`. Die Seite zeigt nur das öffentliche Menü, ohne Eingaben. Der Player lädt evtl. von einer anderen Adresse als die CMS-Vorschau.
- Auffrischen: `menu.json` alle 30 Minuten neu holen und den Tag neu berechnen. Schlägt das Laden fehl, bleibt das letzte Menü stehen. Kein ganzer Reload, sonst bleibt der Bildschirm bei Netzausfall auf einer Fehlerseite hängen.
- Schrift skaliert mit der Höhe (`vh`), ausgelegt auf 1080 px.
- Sonderfälle wie Website: «Am Montag», «Diese Woche kein Mittagsmenü», «Der Menüplan ist noch nicht da.», gross und mittig.

## Tests
e2e mit Fixture und fester Uhr auf 1920 × 1080: Gerichte sichtbar, kein Überlauf, Preisreihenfolge.
