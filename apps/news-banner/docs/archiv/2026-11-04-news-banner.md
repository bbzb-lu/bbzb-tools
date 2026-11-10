# Plan: BBZB News-Banner

## Ziel
IT-Team erstellt in unter einer Minute ein News-Thumbnail (PNG 1920×1080) für SharePoint. Look wie die PSD-Vorlagen in `docs/reference/`. Kein Speichern, kein Backend.

## Ablauf in der App (eine Seite, links Schritte, rechts Vorschau)
1. **Zielgruppe:** Lernende, Lehrpersonen, Beide. Beide nutzt den dunklen LE-Hintergrund (Entscheid Alexej).
2. **Art:** Info oder Störung. Wechselt das Badge in der Mitte (blauer Info-Punkt oder roter Störungs-Punkt).
3. **Icon links** und **Icon rechts:** Suche über Lucide (Tab «Icons»), Markenicons (Tab «Apps», nur Tabler `brand-*`: Teams, Office, OneDrive, Skype, Windows, Azure, Edge; Entscheid Alexej) oder «Eigenes Bild» (Ausnahme).
4. **Icon unten (optional):** ein kleines Icon mittig unter dem Badge.
5. **Export:** Knopf «PNG laden». Dateiname aus Zielgruppe, Art und Datum.
Vorschau-Schalter «Sperrzonen zeigen» (Standard an). Nie im Export.

## Masse und Farben aus den PSDs (alle in `src/tokens.ts`)
- Fläche 1920×1080. Banner-Zone (Post Banner): y 378 bis 644, volle Breite. Sperrzonen links x 20 bis 265 und rechts x 1652 bis 1896, y 28 bis 1060 (Schätzung aus Screenshot, gegen PSD-Pixel prüfen).
- Hintergrund vertikal, Stützpunkte (y: RGB). **LE:** 0: 84,120,181 · 300: 66,103,169 · 540: 50,88,159 · 800: 33,72,147 · 1079: 16,56,136. **LP:** 0: 255,255,255 · 300: 221,228,241 · 540: 190,204,228 · 800: 158,179,214 · 1079: 129,155,200.
- Badge Mitte: Kreis ca. 121 px, Mitte bei x 960, Info y 449, Störung y 453. Fertige Bilder in `public/badges/info.png` und `stoerung.png` (aus der PSD gerendert, 121×122). Info `#4565CF` mit weissem «i», Störung `#E34343` mit weissem Schild.
- Icons links und rechts: Lucide, Strich 1.5, 24er-Raster, gezeichnet in einer Box von etwa 370 px. LE: weiss, LP: blau `#4565CF` (gegen Pixel prüfen). Mitte der Box links bei x ca. 610, rechts ca. 1290, vertikal um y 511 (Werte der PSD: LE links 363 bis 855, rechts 1083 bis 1510).
- Effekt der Icons: weicher äusserer Schein plus leichtes Relief (innen heller Rand, dezenter Innenschatten). In der PSD in den Smart Objects eingebacken, deshalb per Auge gegen `docs/reference/` abgleichen.

## Technik
React 19, Vite, TypeScript strict, Vitest, Playwright (Edge). Dazu `lucide` (Icons als SVG-Daten) und `@tabler/icons` (nur Marken), kein Konva. Oberfläche aus dem Social Studio kopiert (siehe CLAUDE.md). `renderBanner(ctx, state)` ist eine reine Zeichenfunktion für Vorschau und Export (`canvas.toBlob`). Icon-SVG wird mit Strich 1.5 in ein Bild gerendert und mit Filtern (Glow, Relief) gezeichnet. Eigene Bilder: Datei lesen, in die Slot-Box einpassen (contain), nie hochladen. Max. 4096 px Kantenlänge, sonst verkleinern (schwache Geräte).

## Aufgaben
Stand 04.11.2026: 1 bis 7 gebaut und getestet, 8 vorbereitet (Deploy nach Freigabe von Alexej). Feinschliff Effekte nach Augenmass, Vergleich mit PSD steht aus, sobald das IT-Team testet.
1. **Gerüst:** Vite + React + TS, ESLint, Vitest, Playwright aus `../bbzb-social-studio` übernehmen (Konfigurationen kopieren, nicht neu erfinden). `public/_headers` mit strenger CSP. `npm run deploy`.
2. **Tokens und Zeichenfunktion (Test zuerst):** `tokens.ts`, `renderBanner` mit Hintergrund und Badge. Pixel-Test: Farbe bei y 0, 540, 1079 stimmt mit den Stützpunkten für LE und LP.
3. **Icon-Quelle:** Lucide-Suche (Name, Alias, Tags) und Tabler-Marken-Liste. Test: SVG-String enthält `stroke-width="1.5"`, runde Enden. Tabler-Marken sind Strichicons, gleiche Behandlung wie Lucide.
4. **Icon-Effekte:** Glow und Relief, Vergleich mit PSD-Vorschau LE und LP nebeneinander. Das ist die heikelste Aufgabe, früh machen.
5. **Slots und Eigenes Bild:** Skalierung in feste Boxen, optionales Icon unten, Upload mit Grössenlimit und Fehlermeldung.
6. **Oberfläche (Grundgerüst erledigt):** Kopfzeile, Panel, Banner-Abschnitt, Sperrzonen-Schalter, Export stehen. Offen: Icon-Abschnitte. Mit `/impeccable` prüfen, Tastatur und Beschriftungen vollständig.
7. **Tests und Netzwerk:** e2e: Export-PNG hat 1920×1080, Sperrzonen nicht im Export, keine fremden Requests.
8. **Deploy:** Cloudflare Pages `bbzb-news-banner`, Header mit `curl -I` prüfen, kurze Anleitung für das IT-Team in der App («So geht's» in drei Zeilen).

## Nicht im Umfang
Speichern von Projekten, freies Verschieben, Text im Banner, weitere Formate, Konto oder Login. Auf Zuruf später.

## Offen für Alexej
- Schriften: keine nötig, solange kein Text im Banner steht.
- Authenticator, Outlook, SharePoint fehlen in Tabler: Lucide-Ersatzsymbole, falls kein Wunsch nach Originallogos.
