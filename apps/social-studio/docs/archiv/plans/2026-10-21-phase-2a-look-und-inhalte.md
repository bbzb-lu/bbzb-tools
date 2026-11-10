# Phase 2a «BBZB-Look und Inhalte» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ablauf und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Exporte sehen aus wie die PSD-Vorlage: richtige Textstile, Tags, eingefärbte Scribbles und Icons, Flächen und Verläufe, Filmkorn und BBZB-Look, alles aus einer Brand Library auf einen Klick.

**Architecture:** Alles kommt über die bestehenden Registries dazu (`ElementType`, neu `AssetPack` und `Effect`), der Kern importiert keine Module. Werte stammen aus `docs/reference/psd-geometry.json` und landen in `src/tokens.ts` bzw. im Manifest `brand/manifest.json`. Effekte (Korn, Look, Bildregler) gehören zum Szenengraph der Inhaltsebene, damit der Export sie ohne zweiten Renderer übernimmt.

**Tech Stack:** wie Phase 1 (Konva-Filter/Composite-Operationen für Effekte, zod für das Manifest).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` Abschnitte 6 und 8 («Elemente», «Brand Library», «Modi»). Geometrie: `docs/reference/psd-geometry.json` (`textStyles`, `components`). Referenzbilder: `docs/reference/layouts/`.

**Spielraum:** Dieser Plan legt Ziele, Grenzen und Abnahmetests fest, nicht jede Signatur. Wo kein Interface vorgegeben ist, wählt der Implementer die kleinste Lösung, die zu den bestehenden Registries passt, und begründet sie im Bericht. Der Reviewer beurteilt die Wahl.

## Vor dem Start mit Alexej klären (Task 0)
1. **Profi-Texteinstellungen:** Zeilenabstand und Laufweite in welchem Bereich um den PSD-Wert (Vorschlag: Zeilenabstand 0.8 bis 1.3 × Stilwert, Laufweite ±20/1000 em)? Weitere Einstellungen (Versalien, Absatzabstand)?
2. **BBZB-Look:** Gibt es ein Lightroom-Preset (`.xmp`)? Sonst Annäherung aus `components.bildlook` (Fotofilter «Erwärmen» + Dynamik), Abnahme durch die Kommunikation BBZB.
3. **Bildregler im Profi-Modus:** Helligkeit, Kontrast, Sättigung, Wärme mit welchen Grenzen?
4. **Standort im Schul-Tag:** Standardwert pro Projekt merken? (Vorschlag: ja, zuletzt gewählter Standort.)
5. Gehört der **CTA** («Link in Bio» / «bbzb.lu.ch») schon in 2a als Textstil oder erst mit dem Abschluss-Layout in 2b? (Vorschlag: Stil in 2a, Kanal-Umschaltung in 2b.)

## Global Constraints
- Alle Constraints aus Phase 1 bis 1.2 gelten (`docs/superpowers/workflow.md`, Abschnitt «Was immer geprüft wird»).
- Farben nur aus den vier Tokens; Scribbles, Icons, Flächen und Tags bieten nur diese an. Standortfarben bleiben aus (Konfigurations-Flag, Standard aus).
- Keine abgerundeten Flächen, keine Kreise als Formen, kein Logo, keine Textboxen auf Slides.
- Textstil-Werte ausschliesslich aus `psd-geometry.json` → `src/tokens.ts`; ein Test vergleicht beide.
- Filmkorn nie global: Foto 14 % Overlay, grosse blaue Flächen 40 % Overlay, Textur `brand/textures/film-grain-03.jpg` auf Mittelgrau normalisiert.
- Einfach-Modus: nur «BBZB-Look an/aus», keine Bildregler, keine freien Flächen. Profi-Modus: Bildregler, Flächen, Texteinstellungen.
- Ein neues Asset braucht nur Datei + Manifest-Eintrag, keinen Code.
- **Abwärtskompatibilität:** Projekte und `.bbzbsocial`-Dateien aus Phase 1.x öffnen weiterhin. Neue Felder bekommen Standardwerte; erhöht sich `schemaVersion`, gibt es eine getestete Migration `1 → 2`.
- Export = Editor: gleiche Effekte, exakt 1080 px breit, keine UI.
- Leistung: Effekte auf schwachen Laptops gecacht (Konva `cache()` oder vorberechnete Canvas), Ziehen bleibt bei 4× CPU-Drosselung flüssig.

## Review Focus
1. **Altes Projekt öffnen** (Phase-1.x-Projektdatei mit Foto und Text): öffnet ohne Fehler, sieht gleich aus, neue Optionen haben sinnvolle Standardwerte.
2. **Braveold «st»:** Im Kommentar-Stil erscheint nie die «st»-Ligatur, weder im Editor noch im Export (Pixel-Test).
3. **Korn und Look im Export** entsprechen dem Editor und den Referenzbildern (Golden-Image mit Toleranz, Referenz = erste von Alexej abgenommene Exporte).
4. **Viele Effekte auf vielen Slides** (10 Slides mit Foto + Korn + Look): Ziehen flüssig, Export ohne Speicherproblem.
5. **Manifest kaputt oder Datei fehlt:** Brand Library zeigt die übrigen Assets und eine verständliche Meldung, die App stürzt nicht ab.

---

### Task 0: Spezifikation nachführen und Fragen klären
- [ ] Fragen oben mit Alexej klären, Antworten in Spezifikation Abschnitt 6/8 eintragen (Profi-Texteinstellungen, Bildregler-Grenzen, BBZB-Look-Quelle, Standort-Standard).
- [ ] Commit `Spec: phase 2a decisions`.

### Task 1: Textstile aus der PSD, Tag- und CTA-Stil, Ligatur
- Werte für Titel, Kommentar, Tag, CTA aus `psd-geometry.json` in `src/tokens.ts`; Test vergleicht Tokens und JSON (Backlog-Punkt aus Phase 1).
- Kommentar ohne «st»-Ligatur: Lösung wählen (Laufweite ≠ 0 oder ZWNJ), Pixel-Test im Editor und im Export.
- **Abnahme:** Unit-Test Tokens = PSD; e2e-Pixeltest «Kunst»/«Lust» im Kommentar-Stil zeigt getrennte s und t; Titel-Zeilenabstand 0.86.

### Task 2: Profi-Texteinstellungen
- Zeilenabstand (und je nach Entscheid Laufweite) als Profi-Regler im Text-Inspector, Grenzen aus Task 0, Regler als Geste (ein Undo-Schritt).
- Neue Text-Props mit Standard = Stilwert; Migration/Standardwerte für alte Projekte.
- **Abnahme:** e2e Profi-Regler ändert Zeilenabstand, Einfach-Modus zeigt ihn nicht, altes Projekt öffnet mit Stilwert.

### Task 3: Asset-Manifest und `AssetPack`-Registry
- `brand/manifest.json` mit Scribbles, Icons, Texturen (Dateipfad, Name, Kategorie, Standardfarbe), Validierung mit zod beim Laden.
- Kaputtes Manifest oder fehlende Datei: übrige Assets nutzbar, Meldung (Review Focus 5).
- **Abnahme:** Unit-Tests Manifest gültig/ungültig/Datei fehlt; Architektur-Test: kein Asset-Pfad im Code ausser im Manifest.

### Task 4: Scribble- und Icon-Element
- Element-Typ für eingefärbte PNG-Scribbles und Lucide-SVG-Icons: Farbe aus Palette (Standard Orange), drehen, skalieren (proportional), spiegeln.
- Einfärben so, dass Editor und Export gleich aussehen.
- **Abnahme:** e2e Scribble einfügen → orange im Export (Pixel), Farbe wechseln, spiegeln, ein Undo-Schritt je Aktion.

### Task 5: Tag-Element (Schul-Tag, Ort-Tag)
- Schul-Tag: oranges eckiges Rechteck, Text warmweiss, Versalien, Standort per Auswahl. Ort-Tag: blauschwarz, oranger `map-pin`, Freitext. Masse aus `components.schulTag/ortTag`.
- Breite passt sich dem Text an.
- **Abnahme:** e2e beide Tags einfügen, Standort wechseln, Freitext ändern; Export-Pixel gegen Tokens; keine runden Ecken.

### Task 6: Fläche und Verlauf (Profi)
- Rechteck in Palettenfarbe, optional Korn; Verlauf Palettenfarbe → transparent (Werte `components.verlaufOben/Unten`).
- **Abnahme:** e2e Fläche/Verlauf nur im Profi-Modus einfügbar, Export zeigt Verlauf mit richtigen Endwerten.

### Task 7: `Effect`-Registry und Filmkorn
- Effekte als Registry-Einträge, die ein Element-Typ nutzen kann. Korn: Overlay mit Textur, 14 % auf Fotos, 40 % auf blauen Flächen, pro Element an/aus.
- Gecacht, kein Neuberechnen bei jedem Frame (Review Focus 4).
- **Abnahme:** e2e Korn an/aus verändert Export-Pixel; Golden-Image-Vergleich (mittlere Abweichung pro Kanal ≤ 2 %); Messung Ziehen mit 4× Drosselung.

### Task 8: BBZB-Look, Bildregler, Spiegeln
- «BBZB-Look» pro Foto an/aus (beide Modi), Werte gemäss Task 0. Profi: Helligkeit, Kontrast, Sättigung, Wärme. Foto spiegeln.
- Unbearbeitete Fotos durchlaufen keine Filter (nichts tun, wenn alles neutral ist).
- **Abnahme:** e2e Look an → Export-Pixel wärmer; Regler sind ein Undo-Schritt pro Geste; Einfach-Modus zeigt nur den Look-Schalter.

### Task 9: Brand Library
- Panel mit Tabs Scribbles, Icons, Texturen/Hintergründe, Tags, Farben («Meine Sticker» folgt in Phase 4). Klick setzt mittig auf die aktuelle Slide, Ziehen auf die Leinwand setzt an die Zielposition.
- Gestaltung mit `/impeccable`, schlicht und eckig, in beiden Modi erreichbar.
- **Abnahme:** e2e Klick und Drag setzen Assets; Tastatur bedienbar; Screenshot geprüft.

### Task 10: Abschluss
- Migration/Abwärtskompatibilität end to end (Review Focus 1) mit einer Projektdatei aus Phase 1.2 als Fixture.
- `/impeccable critique` über Editor und Brand Library; Netzwerk-Test um die neuen Abläufe erweitern.
- Spezifikation nachführen, Backlog-Punkte in `docs/roadmap.md` aktualisieren.
