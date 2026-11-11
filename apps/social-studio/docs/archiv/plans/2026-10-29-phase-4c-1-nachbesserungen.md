# Phase 4c.1 Nachbesserungen nach dem ersten Test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Gate und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Rückmeldungen von Alexej nach dem Deploy von 4c umsetzen. Quelle für Look bleibt `docs/design/editor.pen` (nur über Pencil lesen) und `docs/design/export/*.png`.

**Spec:** Spezifikation Abschnitt 8 «Bedienung der Oberfläche» (nachführen, wo sich etwas ändert). Global Constraints wie im archivierten Plan 4c (`docs/archiv/plans/2026-10-28-phase-4c-redesign.md`): Tokens nur in Token-Dateien, keine Halbgeviertstriche, Schweizer Rechtschreibung, nur transform/opacity animieren, Reduced Motion, Exporte unverändert ausser bei Korn, Gate grün.

## Review Focus
- Korn-Stärke: alte Projekte (Korn an) sehen und exportieren exakt wie vorher; Stärke 0 heisst kein Korn.
- Eigene Scrollleiste: Tastatur und Mausrad bleiben, Leiste bleibt auch bei 125 % und klassischen Scrollbalken greifbar, Kontrast >= 3:1.
- Schreibmatte und Linien sind Ansicht, nie im Export und nie in Thumbnails.
- Favicon und Logo laden lokal, kein externer Request.

## Pakete
### A: Entwurf-Treue (Pencil lesen)
- Logo aus dem Pen-Entwurf (Kopf und Startseite) statt der Bilddatei; Favicon neu (Vorschlag: das «st»-Monogramm `brand/ui/logo-social-studio-small-v1.png`, in Git aufnehmen).
- Schreibmatte um die Leinwand wie im Entwurf (Lineal mit Teilstrichen oben, Eckkreuze), nur Ansicht.
- Regler-Griff exakt wie die Bauteile Fader, Fader kurz, Fader Mitte im Entwurf (Form, Rand, Schatten, Markierung). Prüfen, was von Task 1 abweicht.
- Spiegeln-Knöpfe: Symbole stimmen mit der Achse überein (waagrecht, senkrecht), auch im Rechtsklickmenü.
### B: Feinschliff
- Dünne Linie in Unterlagefarbe links und rechts am Rand der Leinwand entfernen (Ursache finden).
- Tasten weicher animieren (Hover, Gedrückt, Abschnitte), nur transform/opacity, ohne den Tooltip-Test zu brechen.
- Eigene Scrollleiste im Theme für den Hauptviewport (horizontal) und alle Scrollbereiche.
- Abschnitte im Inspector: mehr Abstand untereinander.
### C: Korn mit Regler
- Korn-Stärke als Zahl (Slide und Foto), Drehregler `Knob` im Slide-Panel und im Foto-Effekt «Korn» wie im Entwurf. Standard = bisheriger Wert (40 %). Modell, Projektdatei, Canvas, Export; alte Projekte laden unverändert.
