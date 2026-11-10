# Phase 2.2 «Bedienung» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ablauf und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Die App nutzt das Logo-Blau als Akzentfarbe, Panorama-Slides bleiben beim Verschieben, Duplizieren und Löschen zusammen, die Leinwand lässt sich mit Leertaste oder mittlerer Maustaste verschieben, und der Kanal-Schalter erklärt, was er tut.

**Architecture:** Verknüpfung als optionales Feld `Slide.link` (Gruppen-Id, Lesezeit-Standard «nicht verknüpft»), gesetzt vom Layout-Code bei Vorlagen mit mehreren Slides. Die Slide-Operationen im Modell (`src/model/slides.ts`) arbeiten auf Gruppen; die UI ruft sie unverändert auf. Verschieben der Leinwand ändert nur `scrollLeft`/`scrollTop` des bestehenden Scroll-Containers in `src/canvas/CanvasView.tsx`.

**Tech Stack:** wie Phase 2.1.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt 8 «Entscheide Phase 2.2» (verbindlich).

**Spielraum:** wie in 2a bis 2.1. Ziele, Grenzen und Abnahmetests sind fest; wo kein Interface vorgegeben ist, wählt der Implementer die kleinste Lösung und begründet sie im Bericht.

## Global Constraints
- Alle Constraints aus Phase 1 bis 2.1 gelten (`docs/superpowers/workflow.md`, «Was immer geprüft wird»): kein Request nach aussen, Tokens nur in `src/tokens.ts`, kein Plugin-Import in Kern/Store/UI, Dateien < 400 Zeilen, Schweizer Deutsch ohne Halbgeviertstrich, ein Undo-Schritt pro Aktion, Ansicht (Zoom, Scroll, Auswahl) nie im Undo, kein Store-Schreiben pro Mausbewegung, Barrierefreiheit.
- `Slide.link` ist optional; fehlt es, ist die Slide nicht verknüpft (2a Ruling R8). Projekte aus 2.1 mit Panorama ohne `link` bekommen keine nachträgliche Verknüpfung (Testdaten, Entscheid wie in 2.1). `e2e/fixtures/phase-1-2.bbzbsocial` bleibt grün, `.bbzbsocial` behält `link`.
- Eine Gruppe besteht immer aus direkt aufeinanderfolgenden Slides. Keine Operation darf eine Gruppe auseinanderreissen oder eine fremde Slide hineinschieben.
- 20-Slide-Limit gilt auch für das Duplizieren einer Gruppe (klare Meldung, nichts geändert).
- Leertaste und mittlere Maustaste ändern nie das Dokument; während einer Texteingabe (Textfeld, Inspector-Feld, Projektname) tippt die Leertaste normal.

## Review Focus
1. **Panorama verschieben:** Ziehen der linken oder rechten Kachel, «←»/«→» und Alt + Pfeil auf einer Hälfte bewegen beide Slides samt Panorama-Foto; das Foto bleibt nahtlos über der Naht (Spaltentest).
2. **Verschieben über eine Gruppe hinweg:** Eine einzelne Slide, die nach rechts an einem Panorama vorbeigeschoben wird, springt über die ganze Gruppe und landet nie zwischen den beiden Hälften.
3. **Löschen und Duplizieren:** «2 Slides löschen» entfernt die Gruppe, Undo stellt sie her; Duplizieren legt eine neue, eigene Gruppe direkt dahinter an (neue `link`-Id).
4. **Leertaste in Textfeldern:** Beim Bearbeiten eines Textes auf der Leinwand und in Inspector-Feldern erzeugt die Leertaste ein Leerzeichen und verschiebt nichts.
5. **Format-Kopie und Layout-Wechsel:** «Als Story/Post kopieren» behält die Verknüpfung; ein Layout mit einer Slide auf einer verknüpften Slide löst die Gruppe (beide Slides), ein Undo stellt sie her.

---

### Task 0: Spezifikation nachführen und Fragen klären
- [x] Fragen mit Alexej geklärt (22.10.2026), Spezifikation Abschnitt 8 «Entscheide Phase 2.2». Commit `753781b`.

### Task 1: Verknüpfte Slides im Modell und in der Slide-Leiste

**Files:**
- Modify: `src/model/types.ts` (`Slide`), `src/model/parse.ts`, `src/model/slides.ts` (`moveSlide`, `removeSlide`, `duplicateSlide`), `src/model/layout.ts` (`applyLayout`, `addLayoutSlides`, `layoutOnSlide`, `slideAfter`), `src/model/formatCopy.ts`, `src/ui/SlideBar.tsx`, `src/ui/app.css`
- Test: `src/model/slides.test.ts`, `src/model/layout.test.ts`, `src/model/parse.test.ts`, `src/model/formatCopy.test.ts`, neues `e2e/slide-link.spec.ts`

**Interfaces:**
- Produces: `Slide.link?: string`; `groupOf(p: Project, index: number): [first: number, last: number]` in `src/model/slides.ts` (ohne `link`: `[index, index]`). `moveSlide(p, from, to)` verschiebt die Gruppe von `from` so, dass ihre erste Slide bei `to` steht, und rundet `to` auf eine Gruppengrenze; `removeSlide` und `duplicateSlide` wirken auf die ganze Gruppe.

- [ ] Unit-Tests zuerst: `groupOf` mit und ohne `link`; `moveSlide` einer Gruppe nach links/rechts, einer einzelnen Slide über eine Gruppe hinweg (Review Focus 2), Elemente wandern mit (Panorama-Foto über der Naht bleibt nahtlos); `removeSlide` auf beiden Hälften entfernt beide; `removeSlide` der letzten Gruppe, wenn nur sie übrig ist, wirft wie bisher; `duplicateSlide` dupliziert die Gruppe mit neuer `link`-Id und prüft das 20-Slide-Limit für die ganze Gruppe; `parseProject` behält `link`, lehnt Nicht-String ab.
- [ ] Layout-Code: Vorlagen mit `slides > 1` setzen eine neue `link`-Id auf alle ihre Slides; ein Layout mit einer Slide auf einer verknüpften Slide entfernt `link` von der ganzen Gruppe (Review Focus 5); `slideAfter` nutzt `groupOf`, wo `link` vorhanden ist. Format-Kopie behält `link`.
- [ ] Slide-Leiste: verknüpfte Kacheln sichtbar zusammenhängend (gemeinsamer Rahmen oder kein Abstand, eckig, CI-Farben), zugänglicher Name nennt die Gruppe (z. B. «Slide 3, Panorama mit Slide 4»). Knöpfe: «Slide löschen» heisst bei einer Gruppe «2 Slides löschen», «Slide duplizieren» entsprechend «2 Slides duplizieren»; Pfeile und Alt + Pfeil verschieben die Gruppe; Ziehen einer Kachel zieht die Gruppe, Ablegen nur an Gruppengrenzen.
- [ ] e2e (Review Focus 1–3): Panorama über die Layout-Wahl anlegen, je Weg (Ziehen, Pfeile, Alt + Pfeil) verschieben, Export der beiden Slides spaltengenau prüfen; Löschen + Undo; Duplizieren + Limit-Meldung. Screenshot der Slide-Leiste mit Gruppe.
- [ ] Gate, Commit.

### Task 2: Leinwand verschieben mit Leertaste und mittlerer Maustaste

**Files:**
- Modify: `src/canvas/CanvasView.tsx` (oder neue kleine Datei `src/canvas/usePan.ts`), `src/ui/app.css` (Cursor)
- Test: neues `e2e/pan.spec.ts`

- [ ] e2e zuerst: bei Zoom 200 % Leertaste halten und ziehen → `scrollLeft`/`scrollTop` ändern sich um die Zugstrecke, kein Element bewegt, Undo bleibt deaktiviert, Cursor «grab»/«grabbing»; mittlere Maustaste ziehen → gleiches Ergebnis, kein Auto-Scroll-Symbol von Edge (`preventDefault` auf `mousedown` mit `button === 1`); Leertaste beim Bearbeiten eines Textes auf der Leinwand und im Projektnamen tippt ein Leerzeichen (Review Focus 4); Leertaste ohne Ziehen ändert nichts; ein laufendes Ziehen eines Elements wird durch die Leertaste nicht gestört.
- [ ] Umsetzung: nur `scrollLeft`/`scrollTop` des Scroll-Containers, kein Store-Schreiben pro Mausbewegung; während des Verschiebens nimmt die Konva-Stage keine Klicks/Drags an (keine Auswahl beim Loslassen).
- [ ] Gate, Commit.

### Task 3: Kanal-Schalter erklären

**Files:**
- Modify: `src/ui/Header.tsx` (Kanal-Gruppe), `src/ui/layoutActions.ts` (`setChannel` liefert die Anzahl geänderter CTAs), `src/store/ui.ts` bzw. bestehende Notice
- Test: `e2e/channel.spec.ts`

- [ ] e2e zuerst: Die Kanal-Gruppe hat eine sichtbare oder per `title`/`aria-describedby` erreichbare Erklärung «Passt den Link-Hinweis auf der Abschluss-Slide an.»; nach einem Wechsel mit einer Abschluss-Slide meldet eine Notice «1 Link-Hinweis angepasst.» (Einzahl/Mehrzahl korrekt); ohne CTA mit Standardtext meldet sie «Kein Link-Hinweis mit Standardtext gefunden.» Der Wechsel bleibt ein Undo-Schritt; ohne CTA ändert sich nur der Kanal.
- [ ] Umsetzung mit den bestehenden Notice-Mitteln, kurzer Text, Du-Form, keine neue Dialog-Komponente.
- [ ] Gate, Screenshot, Commit.

### Task 4: Akzentfarbe der App

**Files:**
- Modify: `src/tokens.ts` (neues UI-Token `uiAccent: '#405FB7'`, Wert aus `brand/ui/logo-social-studio.png`), `src/ui/app.css` bzw. die Stelle, die die CSS-Variablen aus den Tokens setzt, ggf. `src/ui/Header.tsx`
- Test: `src/tokens.test.ts`, Architektur-Test, bestehende e2e mit Farb- oder Kontrastprüfungen

- [ ] Test zuerst: `uiAccent` ist nicht in `colors`/`colorTokens` (nie Slide-Farbe); e2e: «Exportieren» und der Fokusrahmen nutzen das Logo-Blau, Text darauf warmweiss mit Kontrast ≥ 4.5:1; Auswahl-Handles und Hilfslinien auf der Leinwand bleiben orange.
- [ ] Umsetzung: alle UI-Stellen, die heute `--orange` als Akzent nutzen (primäre Buttons, Fokus, `accent-color` der Regler, aktive Markierungen in Slide-Leiste/Bibliothek/Layout-Wahl), auf das neue Token umstellen; Inhalte (Tag-/CTA-Chips in der Bibliothek, Scribble-Vorschauen) und Leinwand-Overlays unverändert. Screenshots beider Modi ansehen.
- [ ] Gate, Commit.

### Task 5: Abschluss
- Netzwerk-Test um Gruppen-Verschieben, Pan und Kanal-Meldung erweitern; `/impeccable critique` über die Slide-Leiste mit Gruppe, die Kanal-Erklärung und die neue Akzentfarbe.
- Spezifikation («Umgesetzt in Phase 2.2») und `docs/roadmap.md` nachführen: 2.2 erledigt (Live-Test ausstehend), Live-Test-Liste 2.2, erledigte Backlog-Punkte entfernen (Panorama-Teilung beim Löschen/Verschieben), «von Hand verknüpfen im Profi-Modus» in den Ideenspeicher.
