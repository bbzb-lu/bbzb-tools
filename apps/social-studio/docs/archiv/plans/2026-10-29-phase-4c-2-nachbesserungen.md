# Phase 4c.2 Nachbesserungen und Animationen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Gate und Regeln: `docs/superpowers/workflow.md`.

**Goal:** Rückmeldungen von Alexej nach dem Deploy von 4c.1. Look-Quelle: `docs/design/editor.pen` (nur über Pencil lesen), `docs/design/export/*.png`.

**Spec:** Spezifikation Abschnitt 8 «Bedienung der Oberfläche» (nachführen). Constraints wie `docs/archiv/plans/2026-10-28-phase-4c-redesign.md`: nur transform/opacity animieren, Reduced Motion aus, kein React-Render pro Mausbewegung, Exporte unverändert, Gate grün.

## Review Focus
- Regler-Griff: Entwurf und App sind in einem echten Browser, auf Retina und 1x, deckungsgleich (Mass, Rand, Marke), und zwar an jedem Regler der App, nicht nur im Testlabor.
- Gleitende Auswahl und Zahlen-Animation: Tastatur und Bildschirmleser unverändert, nichts flackert beim schnellen Ziehen, Reduced Motion zeigt sofort den Endzustand.
- Video: alle Bildregler und Maske-Funktionen bleiben erreichbar.

## Pakete
### P1: Griff und Video
- Regler-Griff wirklich wie die Bauteile Fader, Fader kurz, Fader Mitte im Entwurf (Griff 20 x 28, Rand, Marke in Akzent, Schlitz, Teilstriche). Alexej sieht auf dem Mac noch den alten Griff: Ursache finden (alle Regler der App durchgehen, auch Reichweite, Deckkraft, Bildregler, Video, Pinsel), mit Screenshots der echten App neben dem Entwurf belegen.
- Beim Video: die Kategorie «Bild» wandert als eingerückter Unterabschnitt unter «Video».
### P2: Animationen
- Gleitende Auswahlfläche: wechselt die Auswahl in einer Gruppe (Umschalter, Reiter Bibliothek/Ebenen, Kategorie-Reiter, Ausrichtung, Segmente), gleitet die schwarze Fläche zum neuen Knopf statt sofort zu springen. Nur transform/opacity.
- Zahlenanzeige am Regler: beim Bewegen gleitet die Zahl kurz von unten ins Feld (Regler, Drehregler, Zahlenfelder mit Regler), ohne React-Render pro Bewegung.
