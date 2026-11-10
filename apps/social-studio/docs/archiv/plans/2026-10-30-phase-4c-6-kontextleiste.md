# Phase 4c.6 Kontextleiste für mehr Fälle, Duplizieren an gleicher Stelle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (Workspace mit `scripts/sdd-workspace`, Regeln aus `docs/superpowers/sdd-templates/`). Gate und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Die Kontextleiste (heute Ausschnitt und Maske, Komponente `ContextBar` in `src/ui/ContextBar.tsx`) zeigt weitere Zustände direkt auf der Leinwand, und Elemente lassen sich an gleicher Stelle duplizieren.

**Spec:** Spezifikation Abschnitt 8 (Kontextleiste, Duplizieren) nachführen. Look: Bauteile in `src/ui/kit/`, Werte nur aus `src/ui/theme.ts`, Regeln in `DESIGN.md`. Alexej hat alle sechs Ideen unten freigegeben und das Duplizieren dem Ermessen überlassen.

## Global Constraints
Wie im archivierten Plan 4c (`docs/archiv/plans/2026-10-28-phase-4c-redesign.md`): nur transform/opacity animieren, Reduced Motion, kein React-Render pro Mausbewegung, Exporte unverändert (Goldens), Gate grün (`npm run typecheck`, `lint`, `test`, `test:e2e`), kein Hex ausserhalb Theme, Schweizer Deutsch, Guillemets, Du-Form, keine Halbgeviertstriche, nie `.superpowers/` oder die unversionierten `brand/`-Dateien committen (kein `git add -f`).

## Review Focus
- Es ist immer höchstens eine Leiste sichtbar. Reihenfolge der Zustände (oben gewinnt): Ausschnitt, Maske, Text bearbeiten, KI läuft, Mehrfachauswahl, Video, Bitte prüfen, Rückgängig-Hinweis. Ein Test pro Paar, das sich überlappen kann.
- Die Leiste verdeckt nie das Bearbeitete, verschiebt die Leinwand nicht (bestehende Platzierungslogik von `ContextBar`: unten über der Scrollleiste, oben wenn sie das Foto verdecken würde) und fängt keine Pinselstriche ab.
- Rückgängig-Hinweis: «Rückgängig» wirkt nur, wenn die Aktion noch die letzte in der History ist, sonst verschwindet der Hinweis. Fehlermeldungen bleiben normale Meldungen (`Notice`).
- Duplizieren an gleicher Stelle: ein Undo-Schritt, Auswahl wechselt aufs Duplikat, gesperrte Elemente wie beim normalen Duplizieren.
- Tastatur und Bildschirmleser: Leiste nimmt keinen Fokus, ist per Tab erreichbar, `role=status` und `aria-live=polite` nur dort, wo sich Text ändert (KI-Fortschritt gedrosselt, nicht pro Prozent).

## Stand beim Pausieren (30.10.2026)
Branch `phase-4c-6` von `main` (`4bff0f0`). `main` ist nicht deployt: zuletzt deployt wurde der Stand 4c.4 (`https://67857a81.bbzb-social-studio.pages.dev`); danach gemergt, aber nicht deployt ist 4c.5 (Roll-Fix, Ausschnitt-Leiste, Maske-Leiste, Hover-Verlauf).
- **Paket A ist angefangen, ungeprüft:** ein Agent wurde mitten in der Arbeit gestoppt. Die halbfertigen Änderungen stehen als Commit «WIP» auf `phase-4c-6` (Modell `duplicateElement(s)` mit `inPlace`, `actions.ts`, Inspector-Zeile «Ebene», Rechtsklickmenü, Tests teilweise angepasst). Gemessen beim Pausieren: Vitest 721 grün, `npm run typecheck` rot (neues `e2e/duplicate-in-place.spec.ts` liest `assetId` an `Element<unknown>`: Typ eingrenzen), e2e und lint nicht gelaufen; das neue e2e ist nie gelaufen. Entweder darauf aufbauen (zuerst `git show HEAD`, Gate laufen lassen) oder verwerfen und neu beginnen.
- Paket B ist nicht begonnen.

## Pakete
### A: Duplizieren an gleicher Stelle
Standard bleibt das versetzte Duplizieren (Strg + D, Knopf «Duplizieren», Kopie um 40 px versetzt, damit man sie sieht). Neu ein zweiter Knopf «An gleicher Stelle duplizieren» im Inspector («Ebene»-Zeile, Einzel- und Mehrfachauswahl) und im Rechtsklickmenü, direkt nach «Duplizieren», mit gleichen Sperr-Regeln und Gründen. Kein neues Tastenkürzel (Edge belegt Strg + Umschalt + D). Tabler-Symbol, das sich sichtbar von `IconCopy` unterscheidet (z. B. `IconCopyPlus`, als Einzelimport, Version 3.49.0 prüfen). Die Zeile muss im 18 rem breiten Inspector bei 1280 × 720 noch passen.
Signatur: `duplicate(id, { inPlace?: boolean })`, `duplicateMany(ids, { inPlace? })` in `src/ui/actions.ts`. Z-Ordnung wie beim heutigen Duplizieren, Medien geteilt, Namen nummeriert («Foto 2»).
Tests (Vitest und e2e, zuerst rot): gleiche Position, Grösse und Drehung; Standard weiter versetzt; Mehrfachauswahl behält die Abstände; gesperrt; ein Undo-Schritt; Auswahl.

### B: Leiste für weitere Fälle
Eine Registry der Zustände mit Priorität (siehe Review Focus) statt einzelner `if`-Zweige; `ContextBar` zeigt immer den obersten aktiven Eintrag. Neu:
1. **Mehrfachauswahl** (mehr als ein Element gewählt): «3 Elemente», Duplizieren, An gleicher Stelle duplizieren, Nach vorne, Nach hinten, Löschen (Symbol-Tasten mit Tooltip, Löschen mit Wort, wenn Platz). Ausrichten und Verteilen sind ein späterer Ausbau (Ideenspeicher).
2. **KI läuft** (Freistellen): Status («Modell wird geladen, einmalig ca. 88 MB», «Hintergrund wird entfernt») mit Fortschritt (Balken, gedrosselt) und «Abbrechen»; sichtbar auch dann, wenn der Nutzer etwas anderes wählt. Dieselben Daten wie die Statuszeile im Inspector (`ui.ai`), keine zweite Wahrheit.
3. **Text bearbeiten:** Titel «Text», kurzer Hinweis «Strg + Enter übernimmt, Esc verwirft», «Fertig» (selber Pfad wie Klick daneben).
4. **Video** (genau ein Video gewählt): Vorschau Start/Stopp, Ton an/aus, Dauer des Ausschnitts («12,4 s», Hinweis bei Überschreiten der 60-s-Grenze). Dieselben Aktionen wie im Video-Abschnitt des Inspectors.
5. **«Bitte prüfen»** (aktuelle Slide hat `review`, nichts Höheres aktiv): Hinweis «Diese Slide kommt aus dem anderen Format, bitte prüfen» und «Geprüft» (ein Undo-Schritt, wie im Inspector).
6. **Rückgängig-Hinweis:** nach dem Löschen von Elementen oder Slides (und Layout-Wechsel mit Inhalt) «Ebene gelöscht», «3 Elemente gelöscht» oder «Slide gelöscht» mit «Rückgängig». Er verschwindet nach etwa 6 s (Hover und Fokus pausieren) und nur wenn die Aktion noch die letzte History-Position ist. Ersetzt für diese Fälle die Info-Meldung oben; Fehler bleiben `Notice`.
Look aus `ContextBar` und kit (Primärtaste nur «Fertig» und «Geprüft», alle anderen Ruhe-Tasten). Einen Entwurf in Pencil gibt es dafür nicht: im Stil des Ausschnitt-Leisten-Looks bauen und Abweichungen im Bericht nennen.
Tests (zuerst rot): pro Zustand erscheint die Leiste und verschwindet wieder; Prioritätspaare (z. B. Mehrfachauswahl während KI läuft: KI gewinnt; Text bearbeiten bei gewähltem Video: Text gewinnt); Platzierung ändert die Leinwand nicht (Muster `e2e/context-bar.spec.ts`, `e2e/crop-bar.spec.ts`); Rückgängig nur bei letzter Aktion; Abbrechen stoppt die KI; Reduced Motion.

## Danach
Abschluss-Review der Phase, Spezifikation (Abschnitt 8) und Roadmap nachführen, Plan nach `docs/archiv/plans/`, Merge in `main`, vor Deploy fragen (`npm run deploy`). Windows-Checkliste um die Leisten ergänzen.
