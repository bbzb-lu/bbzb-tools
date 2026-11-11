# Phase 4a Maske und Pinsel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Foto bekommt eine Maske, die man mit einem Pinsel (weich oder hart) von Hand ausblendet und wieder einblendet. Die Maske folgt dem Foto immer exakt und ist die Grundlage für das KI-Freistellen in 4b.

**Architecture:** Die Maske ist ein Graustufenbild am Foto-Element, in denselben Bildpunkten wie das Foto selbst. Damit gelten Ausschnitt, Spiegeln, Verschieben, Drehen und unproportionales Skalieren für Foto und Maske durch dieselbe Rechnung und die Maske kann nicht verrutschen. Sie wirkt im gemeinsamen Rendering von Editor und Export (vor den Effekten) und liefert dem Rahmen die Umrissform. Die Agents entwerfen Datenformat, Speicherung und Pinsel-Ablauf selbst im Planungsmodus und halten die Entscheide im Ledger fest.

**Tech Stack:** bestehend (React, Konva, zustand + immer + zundo, OPFS, Vitest, Playwright). Keine neue Bibliothek, kein Request nach aussen.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Masken und KI-Freistellen» (Entscheide Phase 4a), dazu «Rahmen» in Abschnitt 8.

## Global Constraints
- Kein Foto, keine Maske, keine Projektdatei verlässt den Browser. Kein neuer Request, CSP bleibt `connect-src 'self'`, Netzwerk-Test bleibt grün.
- Werte (Pinselgrössen, Härte, Maskenauflösung, Schrittweiten) nur in `src/tokens.ts`. Texte Deutsch, Schweizer Schreibweise, Du-Form, «…», keine Halbgeviertstriche. Dateien unter 400 Zeilen, Kern importiert keine Plugins.
- Schwache Zielgeräte: kein React-Render und kein Store-Schreiben pro Mausbewegung, Malen mit 4× CPU-Drosselung messen. Maske höchstens 2048 px an der langen Seite (Entscheid von Claude, Foto bleibt bei höchstens 4096 px), Speicher nach jedem Bearbeiten freigeben.
- Ein Strich ist ein Undo-Schritt. Ansicht (Zoom, Auswahl, Pinselmodus) nie in der History.
- Altprojekte und Fotos ohne Maske laden und exportieren unverändert, `schemaVersion` bleibt 1 (neue Felder optional). Golden-Tests bleiben grün.
- Die Maske gibt es nur am Foto, nicht am Video (wie Freistellen laut Spezifikation).
- Barrierefreiheit: Knöpfe mit zugänglichem Namen und Tooltip, Fokus sichtbar, `aria-disabled` statt `disabled`, Pinselmodus per Tastatur verlassbar (Esc).
- Neue Bedienelemente folgen `DESIGN.md`, die Oberfläche mit `/impeccable` prüfen. Test zuerst für Logik, Gate vor jedem Commit, Ergebnis in Edge ansehen.

## Review Focus
- Maske und Foto bleiben deckungsgleich bei: Verschieben, Drehen, Spiegeln, proportional und unproportional Skalieren, Ausschnitt ändern (Doppelklick), Layoutwechsel, Kopieren und Einfügen, Duplizieren, Slide kopieren auf anderes Format.
- «Foto ersetzen» (anderes Bild in denselben Platzhalter) verwirft die Maske; Layoutwechsel behält sie.
- Maske und Undo: Undo/Redo über mehrere Striche, über Umkehren und Zurücksetzen, und nach Neuladen der Seite; kein Verlust durch das Aufräumen verwaister Dateien, solange Undo sie braucht.
- Projektdatei: Sichern und Öffnen mit Maske ergibt dasselbe Bild; Datei ohne Maske lädt wie bisher; defekte oder fehlende Maske zeigt das Foto unmaskiert mit Meldung statt Absturz.
- Rahmen mit Kontur folgt der Maskenform; ein komplett ausgeblendetes Foto stürzt weder Rahmen noch Export ab.
- Sehr grosse und sehr schmale Fotos, Pinsel am Bildrand und ausserhalb des Fotos (kein Strich ausserhalb, keine Ausnahme), Pinselmodus bei Zoom 25 % und 800 %.

## Dateistruktur
- Neu `src/model/mask.ts`: reine Logik der Maske (leere Maske, Strich zeichnen, umkehren, zurücksetzen, weich zeichnen, Umrechnung Leinwandpunkt in Bildpunkt). Kein React.
- Neu `src/plugins/elements/photo/maskLayer.ts` (Maske in das Rendering einbinden), `MaskTool.tsx` (Pinselmodus auf der Leinwand), `MaskSection.tsx` (Inspector-Abschnitt).
- Ändern: `schema.ts` (Feld `mask`), `PhotoNode.tsx` (nur anbinden, Datei hat 320 Zeilen: Logik in die neuen Dateien), `PhotoInspector.tsx`, `index.tsx` (Menü), `fromFile.ts` (Ersetzen), `src/store/ui.ts` (Pinselmodus-Zustand), `src/projectFile/projectFile.ts`, `src/storage/*`, `src/export/*`, `src/tokens.ts`, `src/ui/keys.ts`.

### Task 1: Maskenmodell, Speichern, Projektdatei
**Files:** Create `src/model/mask.ts` und Test; Modify `schema.ts`, `src/storage/*`, `src/projectFile/projectFile.ts`, `src/model/clipboard.ts`/`elements.ts` falls Kopieren die Maske nicht mitnimmt; Tests dazu.
- [ ] Tests zuerst: leere Maske = alles sichtbar; Strich mit hartem und mit weichem Pinsel verändert nur Punkte im Radius, weich fällt zum Rand ab; Einblenden stellt wieder her; Umkehren zweimal = Ausgangsbild; Zurücksetzen = alles sichtbar; weich zeichnen ändert Kanten, nicht Flächen; Strich am und über den Bildrand geklemmt; Umrechnung Leinwandpunkt in Bildpunkt stimmt bei Ausschnitt, Spiegeln, Drehung und unproportionaler Box (Pinselspur landet auf dem richtigen Bildpunkt).
- [ ] Schema: `mask` optional am Foto (Verweis auf die Maskendatei); Fotos ohne Feld unverändert. Maske wird wie ein Asset gespeichert, in der Projektdatei mitgepackt und beim Öffnen geprüft (defekt oder fehlend: Foto ohne Maske, Meldung). Kopieren, Einfügen, Duplizieren und Slide-Kopie nehmen die Maske mit; «Foto ersetzen» verwirft sie.
- [ ] Aufräumen verwaister Dateien darf keine Maske löschen, die Undo/Redo oder ein gespeichertes Projekt noch braucht (Test, der ohne den Schutz scheitert, über die 10-Minuten-Schonfrist hinaus).
- [ ] Gate, Commit.

### Task 2: Darstellung im Editor und Export
**Files:** Create `maskLayer.ts`; Modify `PhotoNode.tsx`, `useOutline.ts`, `src/canvas/effects.ts` und den Exportpfad nach Bedarf; Tests dazu (Vitest wo möglich, sonst Playwright).
- [ ] Tests zuerst: Foto mit Maske zeigt ausgeblendete Bereiche durchsichtig (Pixelprobe Editor und Export gleich); Spiegeln, Ausschnitt und unproportionales Skalieren halten die Maske deckungsgleich (Pixelprobe, nicht nur Zahlen); Rahmen mit Kontur folgt der Maskenform (Pixelprobe der Kontur); Effekte (Look, Verlauf, Korn) laufen nach der Maske; Foto ohne Maske: Golden-Tests unverändert; vollständig ausgeblendet: kein Absturz, Export liefert die Slide.
- [ ] Umsetzen: Maske wirkt vor den Effekten in derselben Rechnung wie der Ausschnitt. Beim Skalieren und Ziehen weiter flüssig (Live-Vorschau zeigt die Maske mit). Ergebnis mit 4× Drosselung messen und im Bericht nennen.
- [ ] Gate (inklusive `npm run test:e2e`), Export öffnen und mit der Leinwand vergleichen, Commit.

### Task 3: Pinselmodus auf der Leinwand
**Files:** Create `MaskTool.tsx`; Modify `src/store/ui.ts` (Pinselmodus, Pinselwerte, nie in der History), `src/ui/keys.ts`, `src/canvas/CanvasView.tsx` und `Scene.tsx` nach Bedarf, `src/tokens.ts`.
- [ ] Tests zuerst: Pinselmodus öffnen und verlassen (Knopf, Esc, Klick auf anderes Element); Strich ausblenden und einblenden verändert die Maske, ein Strich = ein Undo-Schritt, Redo stellt ihn wieder her; X tauscht Ausblenden und Einblenden; Grösse per Regler und Tastenkürzel, begrenzt auf Min und Max aus den Tokens; Härte weich bis hart; Strich ausserhalb des Fotos ändert nichts; Mausrad zoomt weiter die Ansicht, malt nicht; Pinselmodus und «Ausschnitt bearbeiten» schliessen sich gegenseitig aus.
- [ ] Umsetzen: rote, durchscheinende Folie auf den ausgeblendeten Bereichen (Token für die Folie, nur im Editor, nie im Export), Pinselring in der Mausposition in der richtigen Grösse bei jedem Zoom. Gemalt wird direkt auf einer Arbeitskopie der Maske; der Store wird erst am Ende des Strichs beschrieben. Tastenkürzel für die Grösse funktionieren auf der Schweizer Tastatur (nach `e.key`, nicht nach Tastenposition: `[` und `]` sowie `+` und `-`), das Kürzel steht im Tooltip. Malen mit 4× Drosselung messen.
- [ ] Gate, in Edge von Hand malen und Screenshot ansehen, `/impeccable critique` auf Folie und Pinselring, Commit.

### Task 4: Inspector-Abschnitt und Menü
**Files:** Create `MaskSection.tsx`; Modify `PhotoInspector.tsx`, `index.tsx` (Kontextmenü), `src/ui/app.css` und `inspector.css`, `DESIGN.md`.
- [ ] Tests zuerst (Playwright): Abschnitt «Maske» erscheint am Foto (Einfach und Profi), nicht am Video und nicht am leeren Platzhalter; Knöpfe «Ausblenden» und «Einblenden» (aktiver Zustand erkennbar), Regler Grösse und Härte, «Maske umkehren», «Maske zurücksetzen», «Maske weich zeichnen» (Regler für Weichheit, ein Undo-Schritt je Loslassen); Zurücksetzen und Weich zeichnen ohne Maske sind deaktiviert (`aria-disabled`); Kontextmenü «Maske bearbeiten»; alle Knöpfe haben Namen und Tooltip; bei 1280 × 720 ohne Scrollen der Seite bedienbar.
- [ ] Umsetzen im Stil der bestehenden Abschnitte (Icons Tabler 18 px, schlicht, eckig), Texte in Schweizer Deutsch. Eintrag in `DESIGN.md`.
- [ ] Gate, `/impeccable audit` und `polish` auf den Abschnitt, Commit.

### Task 5: Abschluss
- [ ] Gesamt-Review des Branches `phase-4a` (stärkstes Modell), Fix-Runde, Re-Review. Leistung mit 4× Drosselung im Bericht.
- [ ] Doku: `docs/windows-checkliste.md` (Pinsel mit Maus und Touchpad, Tastenkürzel auf Schweizer Tastatur, Malen auf dem Schulgerät, grosse Fotos), `docs/roadmap.md` (4a erledigt), Plan und Phasenlog nach `docs/archiv/`, `naechste-session.md` neu schreiben (Start 4b mit Modellvergleich und Lizenzprüfung).
- [ ] Merge direkt in `main`, danach Alexej fragen wegen Push und Deploy (CSP unverändert), Live-Bundle prüfen.
