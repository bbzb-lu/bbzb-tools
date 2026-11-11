# Arbeitsweise mit Superpowers (verbindlich für jede Phase)

So sind Phase 1, 1.1 und 1.2 entstanden. Jede neue Phase läuft gleich, damit die Qualität gleich bleibt.

## Ablauf einer Phase
1. **Spezifikation nachführen.** Neue Rückmeldungen und Entscheide in `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` eintragen. Offene Fragen vorher mit Alexej klären (`superpowers:brainstorming`, kurze Auswahlfragen statt langer Texte).
2. **Plan schreiben** (`superpowers:writing-plans`) nach `docs/superpowers/plans/JJJJ-MM-TT-<phase>.md`, mit Global Constraints und Review Focus. Grosse Phasen in Teilpläne teilen (z. B. 2a, 2b).
3. **Branch** `phase-<n>` von `main`. Nie auf `main` umsetzen.
4. **Umsetzen mit `superpowers:subagent-driven-development`:**
   - Workspace mit `scripts/sdd-workspace <plan>`, Ledger `progress.md` darin (git-ignoriert unter `.superpowers/`).
   - Regeln für Subagents aus `docs/superpowers/sdd-templates/` in den Workspace kopieren und Pfade anpassen.
   - Pro Task: ein Implementer-Subagent (TDD, Gate, Commit, Bericht in Datei), danach ein Reviewer-Subagent (Spec + Qualität). Befunde «Critical/Important» gehen in Fix-Runden an denselben Implementer, danach ein gezielter Re-Review.
   - Jede Abweichung vom Plan wird im Ledger als `Ruling:` mit Begründung und Preis festgehalten und am Ende Alexej gemeldet.
   - Kleinere Befunde («Minor») ins Ledger, am Ende entweder im Abschluss-Fix oder in `docs/roadmap.md` (Backlog).
5. **Gesamt-Review** des Branches mit dem stärksten Modell, eine Fix-Runde, ein Re-Review.
6. **Selbst prüfen:** Gate laufen lassen (unten), Screenshots ansehen, Exporte öffnen.
7. **Merge in `main` direkt** nach grünem Gesamt-Review (Alexej entwickelt allein, kein Pull Request nötig). Dann nach kurzer Rückfrage `npm run deploy` (führt das Gate erneut aus) und Live-Bundle prüfen.
8. **Alexej testet live.** Rückmeldungen werden als Nachbesserungs-Phase `<n>.1`, `<n>.2` … geplant oder in die Roadmap einsortiert.

## Gate (vor jedem Commit und vor jedem Deploy)
`npm run typecheck`, `npm run lint`, `npm test` (Vitest), `npm run test:e2e` (Playwright, Edge). Nie Tests abschwächen; Tests an neu verlangtes Verhalten anpassen ist erlaubt und wird im Bericht genannt.

Neue Layout-Datei (JSON in `src/plugins/layouts/presets/`) und Vitest findet sie nicht oder prüft alte Werte: `npx vitest run --clearCache` und danach `npm test`.

## Modellwahl
- Implementer: mittleres Modell für klar beschriebene Tasks, stärkstes Modell für Leinwand-, Export- und Zoom-Logik.
- Reviewer: mindestens mittleres Modell; Gesamt-Review immer das stärkste.
- Kleine Doku- oder Stil-Fixes: der Controller prüft per `git show`/`grep` und hält das im Ledger fest.

## Was immer geprüft wird
- Kein Request nach aussen (Netzwerk-Test), CSP `connect-src 'self'`.
- Tokens nur in `src/tokens.ts`, kein Plugin-Import im Kern, Dateien < 400 Zeilen, Texte Schweizer Deutsch (Architektur-Test).
- Ein Undo-Schritt pro Geste; Ansicht (Zoom, Auswahl) nie in der History.
- Leistung auf schwachen Geräten: kein React-Render oder Store-Schreiben pro Mausbewegung, Ziehen mit 4× CPU-Drosselung messen.
- Barrierefreiheit: Labels, Fokus sichtbar, Tastatur, `aria-disabled` statt `disabled`, wo der Fokus bleiben muss.

## Was nur von Hand geht (Windows-Schulgerät, Edge)
Echtes Mausrad, Touchpad-Pinch, Ctrl + «+» auf Schweizer Tastatur, Alt + Rad und Alt + ←, Bildlaufleisten bei 125 % Skalierung, iPhone-Fotos/Videos, Erreichbarkeit im Schulnetz. Offene Punkte stehen im Backlog in `docs/roadmap.md`.
