# Phase 2.3 «Verlauf und Ränder» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ablauf und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Wer ein Foto anklickt, findet dort den Verlauf für bessere Lesbarkeit (Richtung, Stärke, im Profi-Modus Reichweite und Aufhellen), und die 72-px-Ränder sind als Hilfslinien sichtbar.

**Architecture:** Der Verlauf wird ein Foto-Effekt in der bestehenden Effekt-Pipeline (`src/canvas/effects.ts`, `Effect`-Registry), gezeichnet in die gecachte Foto-Canvas nach Look und Bildreglern und vor dem Korn. Damit folgt er dem Foto (Verschieben, Drehen, Ausschnitt, Rahmen) und liegt automatisch unter allen Elementen darüber. Die Slide-Felder `verlaufOben`/`verlaufUnten`, ihr Zeichnen in `src/canvas/SlideBackground.tsx` und die Positionsregel `verlaufIndex` (2.1 Rulings R1/R3) entfallen. Die Ränder sind ein Teil der bestehenden Sicherheitszonen-Ebene.

**Tech Stack:** wie Phase 2.2.

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt 8 «Entscheide Phase 2.3» (verbindlich). Werte: `docs/reference/psd-geometry.json` → `components.verlaufOben`, `components.verlaufUnten`; `src/tokens.ts` → `gradients`, `margin`, `safeZones`.

**Spielraum:** wie bisher. Ziele, Grenzen und Abnahmetests sind fest; wo kein Interface vorgegeben ist, wählt der Implementer die kleinste Lösung und begründet sie im Bericht.

## Global Constraints
- Alle Constraints aus Phase 1 bis 2.2 gelten (`docs/superpowers/workflow.md`, «Was immer geprüft wird»): kein Request nach aussen, Tokens nur in `src/tokens.ts`, kein Plugin-Import in Kern/Store/UI, Dateien < 400 Zeilen, Schweizer Deutsch ohne Halbgeviertstrich, ein Undo-Schritt pro Geste, kein Store-Schreiben und keine Neuberechnung in voller Auflösung pro Mausbewegung (Regler-Vorschau wie bei den Bildreglern aus 2a), Barrierefreiheit.
- Neues Foto-Prop optional, Standard beim Lesen «kein Verlauf» (2a Ruling R8). Phase-1.2-Fixture und Golden bleiben grün und unverändert. Slide-Verläufe aus Testprojekten von 2.1/2.2 werden nicht umgewandelt (Entscheid 22.10.2026).
- Verlaufs-Werte nur in `src/tokens.ts`: «leicht» entspricht `verlaufOben` der PSD (Alpha 0.45 × Ebenendeckkraft 0.25), «stark» entspricht `verlaufUnten` (Alpha 0.7), «mittel» liegt dazwischen; Reichweite Standard 56 % wie die PSD-Stopps, Bereich 30 bis 100 %. Abdunkeln = Blauschwarz, Aufhellen = Warmweiss (Vier-Farben-Regel).
- Die Vorlagen Titel und Vollbild (Post und Story) setzen den Verlauf am Foto und exportieren innerhalb der Golden-Toleranz (≤ 2 % pro Kanal) wie bisher.
- Ränder und Zonen erscheinen nie im Export und fangen keine Klicks.

## Review Focus
1. **Verlauf folgt dem Foto:** gedrehtes Foto, gespiegeltes Foto, Ausschnitt verschoben, Foto mit Rahmen, Panorama über zwei Slides: der Verlauf sitzt an der gewählten Kante des sichtbaren Bildbereichs und dreht/spiegelt sinnvoll mit (Spiegeln ändert die Bildrichtung, nicht die gewählte Verlaufsseite).
2. **Text bleibt hell:** Ein Titel über einem Foto mit starkem Verlauf bleibt im Export reines Warmweiss.
3. **Vorlagen unverändert:** Titel und Vollbild sehen nach dem Umstellen gleich aus (Goldens), Layout-Wechsel und Format-Kopie übernehmen den Verlauf des Fotos.
4. **Leistung:** Stärke- und Reichweiten-Regler bleiben auf einem schwachen Laptop flüssig (Vorschau in reduzierter Auflösung, ein Undo-Schritt pro Geste).
5. **Ränder beim Einrasten:** Ein Tag rastet bei eingeschalteten Sicherheitszonen an den 72-px-Rändern oben und unten ein, bei Zoom ≠ 100 %.

---

### Task 0: Spezifikation nachführen und Fragen klären
- [x] Fragen mit Alexej geklärt (22.10.2026), Spezifikation Abschnitt 8 «Entscheide Phase 2.3», Roadmap (2.3, 2.4 Gestaltung, dann Video).

### Task 1: Verlauf als Foto-Effekt

**Files:**
- Modify: `src/plugins/elements/photo/schema.ts` (Prop), `PhotoInspector.tsx` (UI), ein Effekt-Plugin neben Look/Bildreglern (z. B. `src/plugins/effects/scrim.ts`), `src/plugins/index.ts`, `src/tokens.ts`
- Test: `src/tokens.test.ts`, Effekt-Unit-Test, `src/plugins/elements/photo/photo.test.ts`, neues `e2e/photo-scrim.spec.ts`

**Interfaces:**
- Produces: Foto-Prop `scrim?: { side: 'oben' | 'unten' | 'links' | 'rechts'; strength: 'leicht' | 'mittel' | 'stark'; reach?: number; light?: boolean }` (fehlt = kein Verlauf; `reach` in Prozent 30 bis 100, Standard 56; `light` = Aufhellen). Tokens `scrim` (Alpha je Stärke, Reichweiten-Grenzen, Farben). Task 2 setzt `scrim` in den Presets.

- [ ] Tests zuerst: Tokens gleich PSD (leicht/stark wie oben); Schema akzeptiert gültige Werte, lehnt ungültige ab, altes Foto ohne Prop hat keinen Verlauf und keine Effekt-Canvas mehr als vorher; e2e: Foto anklicken → «Verlauf» mit Richtung (aus/oben/unten/links/rechts) und Stärke in beiden Modi, Reichweite und Aufhellen nur im Profi-Modus; jede Wahl ein Undo-Schritt, Regler ein Undo-Schritt pro Geste; Export-Pixel: Kante dunkler um den Token-Wert, Ende der Reichweite unverändert, Aufhellen heller; Review Focus 1 (gedreht, gespiegelt, Ausschnitt, Rahmen) und 2 (Titel bleibt Warmweiss).
- [ ] Umsetzung als Effekt in der Pipeline, im sichtbaren Bildbereich (`imageArea()` bei Rahmen), nach Look und Bildreglern, vor dem Korn (begründen, falls anders); neutral (kein `scrim`) → kein Effekt aktiv. Regler-Vorschau wie die Bildregler (reduzierte Auflösung während der Geste).
- [ ] Gate, Screenshots (Einfach und Profi), Commit.

### Task 2: Slide-Verläufe entfernen, Vorlagen umstellen

**Files:**
- Modify: `src/model/types.ts`, `src/model/parse.ts`, `src/model/layout.ts`, `src/canvas/SlideBackground.tsx`, `src/canvas/Scene.tsx`, `src/model/geometry.ts` (`verlaufIndex` entfällt), `src/ui/Inspector.tsx` (Slide-Panel: nur noch Hintergrund und Korn), `src/core/types.ts`, `src/plugins/layouts/index.ts`, `src/plugins/layouts/presets/titel*.json`, `vollbild*.json`, `src/tokens.ts`, betroffene Tests (`slide-background.spec.ts`, `layout-choice.spec.ts`, `network.spec.ts`, `layout.test.ts`, `layouts.test.ts`, `parse.test.ts`, `geometry.test.ts`)

**Interfaces:**
- Consumes: Task 1 (`scrim`).

- [ ] Presets: `verlaufOben` → Foto-Platzhalter mit `scrim: { side: 'oben', strength: 'leicht' }`, `verlaufUnten` → `{ side: 'unten', strength: 'stark' }` (Post und Story). Goldens müssen ohne Neuerzeugung bestehen; weicht ein Golden ab, erst Ursache klären und im Bericht erklären.
- [ ] Entfernen: Slide-Felder, Schalter «Verlauf oben/unten», `verlaufIndex` und sein Zeichnen. `parseProject` ignoriert alte `verlaufOben/verlaufUnten`-Felder (Testprojekte öffnen weiter, ohne Verlauf). Tests, die die Slide-Verläufe prüften, auf den Foto-Verlauf umstellen und im Bericht nennen; Review Focus 2 bleibt abgedeckt.
- [ ] Layout-Wechsel (R8 aus 2b: unverändert = Preset gleich) und Format-Kopie übernehmen `scrim` des Fotos (Review Focus 3); Unit-Test.
- [ ] Gate, Commit.

### Task 3: 72-px-Ränder als Hilfslinien

**Files:**
- Modify: `src/canvas/SafeZoneLayer.tsx`, `src/canvas/snap.ts` (Zonen-Quelle), `src/tokens.ts` (Linienstil, falls neu)
- Test: `e2e/safezones.spec.ts`, `src/canvas/snap.test.ts`

- [ ] Tests zuerst: Mit «Sicherheitszonen» erscheinen bei Post und Story zusätzlich die 72-px-Ränder auf allen vier Seiten jeder Slide (unterscheidbar von den Instagram-Zonen, z. B. feiner oder anders gestrichelt); nie im Export (Pixel), keine Klicks; ein Tag rastet oben und unten am Rand ein, auch bei Zoom 200 % (Review Focus 5). Prüfen, ob die Ränder heute schon Einrast-Kandidaten sind (2b), und nur das Fehlende ergänzen.
- [ ] Gate, Screenshot Post und Story mit Zonen, Commit.

### Task 4: Abschluss
- Netzwerk-Test um den Foto-Verlauf erweitern; `/impeccable critique` über den Verlauf im Foto-Inspector (beide Modi) und die Ränder.
- Spezifikation («Umgesetzt in Phase 2.3», Slide-Verlauf aus 2.1 als ersetzt markieren) und `docs/roadmap.md` (2.3 erledigt, Live-Test ausstehend; Live-Test-Liste 2.3; erledigte Backlog-Punkte entfernen; Restpunkte eintragen).
