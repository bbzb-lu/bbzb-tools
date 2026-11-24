# Mensa Bahnhof: Design

Neue App `apps/mensa-bahnhof/` unter `/mensa-bahnhof/`. Zeigt den Mittagsmenüplan der Mensa am Standort Bahnhof, übernommen von der SV-Seite https://sv-gastronomie.ch/menu/BBZB,%20Luzern/Mittagsmen%C3%BC.

## Absicht
Heute wird der Plan jeden Freitag von Hand ausgedruckt und aufgehängt. Künftig hängt ein QR-Code in der Mensa. Wer ihn scannt, sieht auf dem Handy sofort, was es heute gibt, darunter den Rest der Woche. Niemand tippt etwas ab: Die Inhalte kommen 1:1 von SV.

Hauptpublikum sind Mitarbeitende. Später sollen weitere QR-Codes für andere Gruppen deren Preis hervorheben.

## Ziele
- Mobil zuerst: Heute ist ohne Scrollen sichtbar, die Woche liegt einen Tipp entfernt.
- Pro Tag jede Linie, wie SV sie zeigt: Linienname (z. B. «Kunterbunt»), Gericht, Beilagen, alle drei Preise (EXT, MA, SCHU).
- Hervorgehobener Preis per URL: Standard MA, `?preis=schu` und `?preis=ext` für eigene QR-Codes. Unbekannter Wert: MA.
- Daten holt eine GitHub Action, nicht der Browser. Die Seite lädt nur von bbzb-tools.pages.dev.
- Die Action prüft selbst, ob die geholte Woche die erwarteten Daten trägt.

## Nicht-Ziele
Allergene, CO₂-Note und Eco-Score, Öffnungszeiten, Vorbestellung, andere Standorte oder Menükarten (Catering), Sprachen ausser Deutsch, Push oder Offline-Modus.

## Anti-Ziele
- Ein veralteter Plan, der als aktuell erscheint. Lieber «noch nicht da» als die falsche Woche.
- Ein Request vom Browser an SV, qnips, Google oder Firebase.

## Ansätze
- **A) SV-Seite im Headless-Browser lesen (gewählt).** Playwright öffnet die Seite, lehnt Cookies ab, liest pro Tag die angezeigten Texte für «Diese Woche» und «Nächste Woche». Übernimmt genau, was SV anzeigt; Playwright ist im Repo. Bricht bei Layout-Änderungen, die Datumsprüfung fängt das ab.
- B) qnips/Firestore direkt abfragen: schlanker, mehr Felder, aber undokumentierte Token-Kette, bricht still, rechtlich heikler.
- C) Wochen-PDF parsen: offiziell, aber Textextraktion aus Spalten ist unzuverlässig.

## Entscheide
### Daten holen
- Skript `apps/mensa-bahnhof/scripts/hole-menu.mjs`, läuft in `.github/workflows/mensa-bahnhof.yml` auf `ubuntu-latest` mit Playwright-Chromium (nicht msedge, nur Server).
- Liest beide Wochen, die SV anbietet, und schreibt beide in die Datei. So hat die Seite am Freitagabend die laufende und die kommende Woche.
- Zeitplan (Cron in UTC, 1 h hinter Winterzeit): Freitag 17:00 UTC, Samstag, Sonntag und Montag 05:00 UTC. Dazu `workflow_dispatch` zum Auslösen von Hand.
- Zielwoche: der nächste Montag bis Freitag, am Montag die laufende Woche. Ist die Zielwoche in der committeten Datei schon gültig, endet der Lauf sofort ohne SV-Aufruf.
- Parsen als reine Funktion in `apps/mensa-bahnhof/src/parse.ts` (Seitentext je Tag rein, Objekte raus) mit Vitest-Tests auf einem Fixture aus dem echten Seitentext.

### Selbstprüfung
- SV zeigt pro Tag Wochentag und Datum ohne Jahr («Mo. 23.11.»). Das Jahr ergibt sich aus der Zielwoche (Jahreswechsel beachten).
- Die Zielwoche gilt nur, wenn genau die fünf erwarteten Daten (Mo bis Fr) vorkommen.
- Ferien (Entscheid Claude): Zeigt SV die Zielwoche mit korrekten Daten, aber an allen Tagen leer, gilt sie als gültig und geschlossen. Die Seite zeigt dann «Diese Woche kein Mittagsmenü». Bietet SV die Woche gar nicht an, scheitert der Montagslauf wie unten.
- Jede gelesene Linie hat Gericht und mindestens einen Preis. Ein Tag, den SV leer zeigt (z. B. Feiertag), ist erlaubt.
- Ein falsches oder fehlendes Datum lässt den Lauf scheitern und schreibt nichts. Die letzten guten Daten bleiben online.
- Scheitert der Montagslauf, endet die Action rot. GitHub schickt die Fehler-Mail an Alexej.

### Ablage und Deploy
- Datei `apps/mensa-bahnhof/public/menu.json`, vom Bot auf `main` committet (`main` ist nicht geschützt). Nur wenn sich der Inhalt geändert hat.
- Danach muss deployt werden. Ein Push mit `GITHUB_TOKEN` löst `ci.yml` nicht aus. Der Umsetzer wählt den Weg, Bedingung: Live geht nur ein Build, der dieselben Prüfungen besteht wie der normale Deploy (Fonts-Check, `check-live-build`).
- Format:
  ```json
  { "geholt": "2026-11-27T17:03:00Z", "quelle": "https://sv-gastronomie.ch/menu/…",
    "wochen": [ { "montag": "2026-11-30", "tage": [
      { "datum": "2026-11-30", "linien": [
        { "linie": "Kunterbunt", "gericht": "Kalbshacksteak",
          "beilagen": "Kräuterjus, Bratkartoffeln, Butterbohnen",
          "preise": { "EXT": "14.50", "MA": "14.50", "SCHU": "11.50" } } ] } ] } ] }
  ```
  Texte unverändert von SV, nur Leerraum getrimmt.

### Seite
- Lädt `menu.json` relativ (`import.meta.env.BASE_URL`), keine CSP-Änderung nötig.
- Oben «Heute, Dienstag 24. November» mit den Linien als Karten: Linie klein, Gericht gross, Beilagen normal, hervorgehobener Preis gross mit Gruppenname («Mitarbeitende», «Lernende», «Externe»), die anderen zwei klein.
- Darunter Tagesleiste Mo bis Fr der angezeigten Woche (`Segmented` aus `@bbzb/ui`), Tipp wechselt die Karten. Heute ist vorgewählt.
- Samstag und Sonntag: Die kommende Woche mit Montag vorgewählt, Überschrift «Am Montag».
- Fehlt die Woche von heute in der Datei: Hinweis «Der Menüplan dieser Woche ist noch nicht da» mit Link auf die SV-Seite. Leerer Tag: «Heute kein Mittagsmenü».
- Fusszeile: «Quelle: SV Restaurant», Link auf die SV-Seite, Stand (`geholt`).
- Kachel auf der Startseite in `apps/startseite/src/tools.ts`, mit Vorschaubild.
- Kein Speicher, keine Analytics.

## Überlassen dem Umsetzer
Genaues Layout und Abstände (mit `impeccable:impeccable`), Selektoren für Playwright, Wahl des Deploy-Wegs nach dem Commit, Text der Kachel, Vorschaubild, wie der QR-Code erzeugt wird (eine Datei je Preisgruppe in `apps/mensa-bahnhof/docs/` reicht).

## Nachtrag 24.11.2026: Ernährungs-Labels und Auffrischung
- SV hängt an jedes Gericht Label-Bilder (`.customtag-list img`, Alt-Text z. B. «Vegan», «Laktosefrei»). Das Skript übernimmt nur den Alt-Text als `labels: string[]` je Linie (leer erlaubt), in SV-Reihenfolge. CO₂-Note und Eco-Score werden nicht übernommen (Entscheid Alexej).
- Die Seite lädt keine Bilder von qnips, sondern zeichnet eigene Icons aus Tabler-Outline (MIT, liegt im News-Banner): Vegan und Vegetarisch `leaf`, Laktosefrei `milk-off`, Glutenfrei `wheat-off`. Unbekannte Labels als Text ohne Icon.
- Hierarchie ohne Lesen: eigener Preis als Fläche in `accent`, Vegan/Vegetarisch als grünes Badge oben in der Karte (neues Token `vegi` in `theme.ts`), Linien unterscheidbar über die `illu`-Stufen. Bestehende Elemente der Suite (Theme, Kachel-Stil der Startseite, Glücksrad-Farbstufen) haben Vorrang vor Neuem.
