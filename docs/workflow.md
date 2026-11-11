# Ablauf mit Superpowers

Gilt für jede grössere Änderung an einem Tool oder an `packages/ui`. Kleine Fixes: Branch, Gate, PR, fertig.

## Eingang
Wünsche und Fehler sind GitHub-Issues mit einem Label pro Tool, Übersicht auf dem Board https://github.com/users/bbzb-lu/projects/2 (Eingang, Geplant, In Arbeit, Erledigt). Rückmeldungen aus dem Forms-Formular «Feedback BBZB Tools» legt Claude als Issue an, ohne Namen oder Dateien der Meldenden. Neue Idee ohne Issue: zuerst Issue, dann planen.

## Ablauf
1. **Klären:** `superpowers:brainstorming`, offene Fragen als kurze Auswahlfragen. Entscheide in die Spezifikation (Suite: `docs/superpowers/specs/`, Tool: `apps/<id>/docs/`).
2. **Plan:** `superpowers:writing-plans` nach `docs/superpowers/plans/JJJJ-MM-TT-<thema>.md`, mit Global Constraints und Review Focus. Plan Alexej zeigen, erst nach Freigabe umsetzen.
3. **Branch** von `main`, nie auf `main` arbeiten.
4. **Umsetzen:** `superpowers:subagent-driven-development`. Regeln aus `docs/superpowers/sdd-templates/` in den Workspace kopieren und Platzhalter ersetzen. Pro Task Implementer, dann Reviewer, Fix-Runden, Abweichungen als `Ruling:` im Ledger.
5. **Gesamt-Review** mit dem stärksten Modell, eine Fix-Runde, ein Re-Review.
6. **Selbst prüfen:** Gate (unten), Screenshots in Edge ansehen, Exporte öffnen.
7. **PR** mit Link auf das Issue. Die CI postet die Vorschau `<branch>.bbzb-tools.pages.dev`. Alexej testet dort.
8. **Merge erst nach grüner CI und Rückfrage.** Der Merge deployt automatisch; danach live prüfen, Issue schliessen, Plan nach `docs/archiv/`.

## Gate
`npm run typecheck`, `npm run lint`, `npm test`, bei UI oder Export `npm run test:e2e` (nur das eigene Tool: `npx playwright test --project <id>`). Nie Tests abschwächen oder überspringen. Windows-Abweichungen nur nach Rückfrage als `test.fixme` mit Issue.

## Modellwahl
Implementer mittleres Modell, stärkstes für Leinwand-, Export- und Zoom-Logik. Reviewer mindestens mittleres, Gesamt-Review immer das stärkste.

## Immer geprüft
- Kein Request nach aussen ausser den Ausnahmen in `_headers` (Suite-Test).
- Werte nur in den Theme- und Token-Dateien, Dateien unter 400 Zeilen, Schweizer Rechtschreibung.
- Schwache Windows-Geräte: kein React-Render oder Store-Schreiben pro Mausbewegung, mit 4× CPU-Drosselung messen.
- Barrierefreiheit: Labels, sichtbarer Fokus, Tastatur.

## Nur von Hand (Schulgerät, Edge)
Mausrad, Touchpad, Schweizer Tastatur, 125 % Skalierung, iPhone-Medien, Schulnetz, Einbettung in SharePoint. Offenes als Issue (Studio: #28).
