# Phase 2b «Layouts und Hilfen» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ablauf und Regeln: `docs/superpowers/workflow.md`. Setzt Phase 2a voraus.

**Goal:** Ein Carousel im BBZB-Look ist in unter 15 Minuten fertig: Layout pro Slide wählen, Fotos in Platzhalter ziehen, Texte ändern. Hilfslinien, Einrasten und Safe Zones verhindern schiefe Platzierungen; ein Projekt lässt sich als anderes Format kopieren.

**Architecture:** Layouts sind reine Daten (`LayoutPreset`-Registry) aus `docs/reference/psd-geometry.json`; Instanziieren ist eine reine Funktion im Modell. Platzhalter sind Element-Eigenschaften (leer/gefüllt), kein neuer Renderer. Hilfslinien, Snapping und Safe Zones leben in der UI-Ebene (nie exportiert); die Snap-Berechnung ist eine reine Funktion.

**Tech Stack:** wie Phase 2a.

**Spec:** Spezifikation Abschnitte 6 («Ränder»), 7 (Layouts), 8 («Projekt und Slides», «Gemeinsam für alle»), 12 («Kanal Instagram/LinkedIn», «Layout-Geometrie aus der PSD»). Referenz: `docs/reference/layouts/Beispiel_0X_*.jpg`, `psd-geometry.json` → `layouts`.

**Spielraum:** wie in Phase 2a. Ziele, Grenzen und Abnahmetests sind fest; Datenformat der Presets und interne Interfaces wählt der Implementer und begründet sie.

## Vor dem Start mit Alexej klären (Task 0)
1. **Safe Zones:** Welche Werte für 4:5 und 9:16 (Instagram-UI oben/unten, Profilbild, Buttons)? Aus der PSD übernehmen oder Instagram-Richtwerte? Zuschaltbar im Einfach-Modus oder nur Profi?
2. **Snapping:** Abstand, ab dem eingerastet wird (Vorschlag 6 Bildschirm-px), Taste zum Aussetzen (Vorschlag: Alt während des Ziehens wird schon für Zoom genutzt → Ctrl?).
3. **Layout wechseln auf einer gefüllten Slide:** Inhalte übernehmen (Fotos in die neuen Platzhalter) oder nur auf leeren Slides erlauben?
4. **Story-Varianten:** Welche der 8 Layouts braucht es als 9:16 sofort?
5. **Format-Kopie:** Was passiert mit Elementen, die kein Platzhalter sind (frei gesetzte Scribbles, Texte)? Vorschlag: relativ zur Slide-Mitte übernehmen, in die Safe Zone schieben, Hinweis anzeigen.

## Global Constraints
- Alle Constraints aus Phase 1 bis 2a gelten.
- Layout-Werte (Positionen, Grössen, Schriftgrössen, Effekte) nur aus `psd-geometry.json`; die Text-Bounds dort sind Tinten-Boxen, Positionierung über die Grundlinie mit den Referenz-JPGs abgleichen (Hinweis in `_info.caveats`).
- Golden-Image-Tests: Referenz sind die ersten von Alexej abgenommenen eigenen Exporte, nicht die JPGs mit Platzhalterfotos; Toleranz mittlere Abweichung pro Kanal ≤ 2 %.
- Hilfslinien, Snapping-Anzeige und Safe Zones erscheinen nie im Export.
- «Als anderes Format kopieren» legt immer ein neues Projekt an, das Original bleibt unverändert.
- Neue Layouts brauchen nur Daten + Referenz, keinen Code (Pflege im Repo, Entscheid 21.10.2026).
- Jeder Weg, der ein Element anlegt (Layout-Platzhalter, Foto in Platzhalter ziehen oder ersetzen, Bibliothek), setzt `grain: true` und bei Fotos `look: true` ausdrücklich. Fehlt das Feld, gilt es als altes Projekt: kein Korn, kein Look (Phase 2a, Ruling R10). Ein Test prüft das pro Weg.

## Review Focus
1. **Layout auf eine Slide mit Inhalt anwenden:** Nichts geht verloren ohne Rückfrage; ein Undo-Schritt stellt alles wieder her.
2. **Panorama über zwei Slides:** Foto-Platzhalter über der Naht, Export spaltengenau ohne Versatz (Spaltentest aus Phase 1).
3. **Snapping bei Zoom ≠ 100 % und gedrehten Elementen:** rastet an den richtigen Linien ein, Abstand in Bildschirm-px gleich gross.
4. **Format-Kopie mit Inhalten, die nicht in Platzhaltern stehen:** nichts landet unerreichbar ausserhalb der Slide; Text bleibt ausserhalb der Safe Zones.
5. **Layout-Export gegen Referenz:** jede Vorlage mit Beispielfotos exportiert und von Alexej abgenommen, danach als Golden Image gesichert.

---

### Task 0: Spezifikation nachführen und Fragen klären
- [ ] Fragen oben klären; Spezifikation ergänzen: Safe Zones (aus Phase 5 vorgezogen), Einrasten an Elementen, Format-Kopie (statt «Format nicht änderbar»), Regeln für Layout-Wechsel.
- [ ] Commit `Spec: phase 2b decisions`.

### Task 1: Hilfslinien und Snapping
- Reine Funktion: Kandidaten (Ränder 72 px, Slide-Mitten, Nähte, Kanten und Mitten anderer Elemente) → Einrast-Versatz für Ziehen und Skalieren; Anzeige der aktiven Linie während der Geste.
- Kein Store-Schreiben pro Mausbewegung; Taste zum Aussetzen gemäss Task 0.
- **Abnahme:** Unit-Tests Snap-Funktion (inkl. gedreht, Zoom); e2e Ziehen rastet an Rand, Mitte, Naht und anderem Element ein.

### Task 2: Safe Zones
- Zuschaltbare Überlagerung für 4:5 und 9:16 mit den Werten aus Task 0; Snapping kennt die Safe-Zone-Ränder.
- **Abnahme:** e2e Safe Zones an/aus, nie im Export (Pixel), Story zeigt andere Zonen als Post.

### Task 3: Platzhalter und `LayoutPreset`-Registry
- Platzhalter für Foto, Titel, Kommentar, Tag: leerer Platzhalter mit Hinweis «Foto hierher ziehen», Drop füllt ihn («cover»).
- Preset-Format als Daten, Instanziieren als reine Funktion (Slide-Index → Elemente in globalen Koordinaten), Platzhalter über mehrere Slides (Panorama).
- **Abnahme:** Unit-Tests Instanziieren (1 und 2 Slides), e2e Foto in Platzhalter ziehen.

### Task 4: Die 8 Layouts im Format 4:5
- Titel, Vollbild, Panorama, Collage, Querformat, Drei Fotos, Abschluss, Leer aus `psd-geometry.json` (Motiv vor Titel und Pop-out vorerst als normaler Foto-Platzhalter; Freisteller folgen in Phase 4).
- Selbst anschauen: jede Vorlage exportieren und mit `docs/reference/layouts/` vergleichen; Alexej nimmt ab, danach Golden Images.
- **Abnahme:** Golden-Image-Test pro Layout (Review Focus 5).

### Task 5: Layout-Wahl und Startvorlage
- «Slide hinzufügen» mit Layout-Auswahl; Layout auf bestehende Slide anwenden gemäss Task 0 (Review Focus 1).
- Startseite: «Neues Projekt» mit Startvorlage «Carousel» (Titel, Vollbild, Panorama, Collage, Abschluss) oder leer.
- **Abnahme:** e2e neues Carousel hat 6 Slides (Panorama = 2), Layout-Wechsel ist ein Undo-Schritt.

### Task 6: Kanal Instagram/LinkedIn
- Projekt-Einstellung Kanal; tauscht den CTA auf der Abschluss-Slide («Link in Bio» ↔ «bbzb.lu.ch»).
- **Abnahme:** e2e Kanal wechseln ändert CTA, Undo stellt zurück.

### Task 7: Story-Varianten (9:16)
- Ableitung der Layouts für 9:16 gemäss Task 0, Safe Zones beachten.
- **Abnahme:** Golden Images der Story-Varianten nach Abnahme.

### Task 8: «Als anderes Format kopieren»
- Startseite: Button neben «Duplizieren». Neues Projekt im anderen Format, Platzhalter-Inhalte in die passenden Layout-Varianten, übrige Elemente gemäss Task 0, Hinweis für Elemente, die geprüft werden sollten.
- **Abnahme:** e2e Story → Post und Post → Story, Original unverändert, nichts ausserhalb der Slides (Review Focus 4).

### Task 9: Abschluss
- Netzwerk-Test um Layout-Ablauf erweitern, `/impeccable critique` für Layout-Auswahl und Startseite, 15-Minuten-Probelauf (ein Carousel von Hand bauen, Zeit messen).
- Spezifikation und `docs/roadmap.md` nachführen.
