# Phase 4b.1 Vorschau-Umschalter und Ausschnittlinie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Im Pinselmodus zwischen roter Folie und echtem Maskenergebnis umschalten; im Ausschnitt-Modus den Rand des Ausschnitts als dünne Linie zeigen.

**Architecture:** Beides ist Ansicht auf der Leinwand, keine Dokumentänderung. Der Umschalter liegt im UI-Store (nie in der History), die Anzeige hängt an der vorhandenen Pinselmodus-Darstellung (`MaskTool.tsx`, `PhotoNode.tsx`), die Linie am vorhandenen Ausschnitt-Modus.

**Tech Stack:** bestehend. Keine neue Bibliothek, keine neuen Requests.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, «Nachbesserung 4b.1».

## Global Constraints
- Nur Ansicht: nichts davon in der History, im Dokument, im Export oder in der Projektdatei. Export sieht unverändert aus (Golden-Tests grün).
- Schwache Geräte: kein React-Render und kein Store-Schreiben pro Mausbewegung. Die Live-Anzeige nutzt die Arbeitskopie der Maske, die der Pinsel schon pflegt, und zeichnet nur die betroffene Fläche nach (wie die rote Folie heute). Malen mit 4× CPU-Drosselung messen.
- Werte (Linienbreite, Farbe) nur in `src/tokens.ts`; die Linie nutzt die vorhandene Auswahl-/Hilfsfarbe der Leinwand (orange), keine neue Farbe. Texte Deutsch (Schweizer Schreibweise, Du-Form), keine Halbgeviertstriche. Dateien unter 400 Zeilen.
- Neue Knöpfe: `aria-label`, `data-tip`, Fokus sichtbar, Tastatur. Aussehen wie vorhandene Umschalter im Inspector; kein eigenes Styling.

## Review Focus
- Umschalter «Ergebnis» zeigt exakt, was der Export zeigt (auch mit Rahmen, Spiegeln, Ausschnitt, unproportionaler Box); beim Wechsel mitten im Strich kein Flackern oder verlorener Strich.
- Ein Strich im Modus «Ergebnis» ist genauso ein Undo-Schritt wie in «Rote Folie».
- Ausschnittlinie bleibt bei Zoom 25 % und 800 % dünn (gleiche Breite am Bildschirm), liegt genau am Ausschnittrand auch bei Drehung und Spiegeln, und erscheint nirgends im Export.

## Task 1: Umschalter «Rote Folie / Ergebnis» im Pinselmodus
**Files:** Modify `src/store/ui.ts` (+Test), `src/plugins/elements/photo/BrushControls.tsx`, `MaskTool.tsx` und/oder `PhotoNode.tsx` nach Bedarf, `src/tokens.ts`; Test `e2e/mask-preview.spec.ts`.
- [ ] Zustand `maskView: 'folie' | 'ergebnis'` im UI-Store (Standard `'folie'`, nicht in der History). Test: Vitest für Setzen und Zurücksetzen beim Verlassen des Modus (Entscheid: Wahl bleibt in der Sitzung, Standard beim ersten Mal «folie»).
- [ ] Umschalter mit zwei Stellungen in `BrushControls` («Rote Folie», «Ergebnis»), per Tastatur bedienbar; Kürzel optional nur, wenn ein freies in `src/ui/keys.ts` naheliegt (z. B. `V`), sonst keines.
- [ ] «Ergebnis»: keine rote Folie; das Foto wird live mit der Maske gezeichnet (ausgeblendet = durchsichtig, wie im Export), und der Pinsel aktualisiert die Anzeige beim Malen. Wiederverwende die bestehende Maskenanzeige von `maskLayer.ts` und die Arbeitskopie des Pinsels, schreibe keine zweite Maskenlogik.
- [ ] e2e: Pixelprobe, dass nach einem Strich «Ergebnis» an der Strichstelle die Slide-Farbe zeigt und «Folie» rot, Umschalten verliert den Strich nicht, Strg + Z macht den Strich in beiden Modi in einem Schritt rückgängig, Export unverändert. Gate, Commit.

## Task 2: Dünne Linie am Ausschnittrand
**Files:** Modify die Ausschnitt-Modus-Datei (`src/canvas/` oder `src/plugins/elements/photo/`, per `grep` nach dem Ausschnitt-Modus suchen), `src/tokens.ts`; Test `e2e/crop-line.spec.ts` (oder bestehender Ausschnitt-Spec).
- [ ] Im Ausschnitt-Modus eine dünne Linie genau am Rand des Ausschnitts (gleiche Breite am Bildschirm bei jedem Zoom, in der Hilfsfarbe der Leinwand), der abgedunkelte Bereich ausserhalb bleibt. Auch bei Drehung und Spiegeln richtig, nicht im Export.
- [ ] Tests: Pixelprobe der Linie bei Zoom 25 % und 200 % (Breite etwa gleich), Linie nach Verlassen des Modus weg, Export ohne Linie. Gate, Screenshot ansehen, Commit.
