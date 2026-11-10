---
name: BBZB Social Studio (Editor-Oberfläche)
description: Graue Werkbank mit Papierflächen, Tinte und hartem Schattenversatz; ein blauer Akzent, damit die Slides die Farbe tragen.
colors:
  accent: "#0077B6"
  on-accent: "#FFFFFF"
  ink: "#232323"
  ink-soft: "#454545"
  ink-disabled: "#646464"
  paper: "#F2F2F2"
  paper-shade: "#E3E3E3"
  table: "#B5B5B5"
  line: "#23232340"
  riso-mustard: "#E3A92B"
typography:
  title:
    fontFamily: "Host Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Host Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Host Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Host Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.25
  hint:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: "0"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "2.5rem"
  button-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  icon-button:
    rounded: "{rounded.none}"
    size: "2.5rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2.5rem"
  section-bar:
    backgroundColor: "{colors.paper-shade}"
    typography: "{typography.label}"
    height: "1.75rem"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "0.375rem 0.5rem"
---

# Design System: BBZB Social Studio

Beschreibt die gebaute Oberfläche nach Phase 4c. Quelle der Werte ist `src/ui/theme.ts` (aus den Variablen von `docs/design/editor.pen`), die Slide-Farben stehen getrennt in `src/tokens.ts`. Bei Widerspruch gilt der Code.

## Overview

**Creative North Star: "Die Riso-Werkbank"**

Der Editor ist ein grauer Arbeitstisch, auf dem Papierbögen liegen: Kopf, Fach links, Inspector und Slide-Leiste sind helle Papierflächen mit Tintenrand, die Slides liegen in der Mitte auf der Unterlage. Tasten sind gedruckte Blöcke mit hartem Schattenversatz, als lägen sie auf dem Tisch. Alles ist eckig, flach gefärbt und ohne Verläufe.

Die Oberfläche tritt hinter die Slides zurück. Farbe trägt Bedeutung, nie Stimmung: der Akzent markiert Auswahl, Aktives und die eine Primäraktion, Tinte invers zeigt «gewählt» und «an», Senf nur «Bitte prüfen». Orange gehört den Slides und den Hilfen auf der Leinwand.

**Key Characteristics:**
- Grau-Papier-Tinte, ein blauer Akzent, keine Rundungen.
- Harter Schattenversatz nur an Tasten in Ruhe und an Overlays.
- Grotesk für Bedienung, Serif nur für Hinweise.
- Dicht, für 1280 × 720 bis 1536 × 864 ohne Seitenscroll.

## Colors

Neutrale Grautöne aus Tisch, Papier und Tinte, dazu genau ein Akzent.

### Primary
- **Luzerner Blau** (`accent`): Exportieren, gewählte Kacheln und Layouts, Fokus auf dunklen Flächen, Reglerzeiger. Nie als Slide-Farbe angeboten. Text darauf in `on-accent`.

### Neutral
- **Tinte** (`ink`): Text, Ränder, Schattenversatz, Fokusring, «gewählt»-Fläche (Tinte invers).
- **Weiche Tinte** (`ink-soft`): Nebentexte, Legenden, Feldränder (3:1).
- **Gesperrte Tinte** (`ink-disabled`): Text und Rand gesperrter Bedienelemente.
- **Papier** (`paper`): Grundfläche aller Panels und Overlays.
- **Papierschatten** (`paper-shade`): Abschnittsleisten, Reiter, Umschalter-Grund, Hover.
- **Tisch** (`table`): Seitenhintergrund rund um die Panels; die Unterlage hinter den Slides wählt der Nutzer aus vier Ansichtstönen (`unterlage-*`), nie im Export.
- **Linie** (`line`): dünne Trenner in Abschnittsleisten und Listen, nur dekorativ.

### Named Rules
**The Eine-Rolle Rule.** Jede Farbe hat genau eine Bedeutung. `riso-mustard` steht nur für «Bitte prüfen»; `riso-pink` und `riso-green` sind im Entwurf definiert, aber ungenutzt.
**The Orange-gehört-den-Slides Rule.** Auswahlrahmen, Anker, Hilfslinien und Sicherheitszonen auf der Leinwand bleiben orange; die Oberfläche selbst nutzt kein Orange.

## Typography

**Bedienschrift:** Host Grotesk (400, 600, 700; Fallback Segoe UI, system-ui)
**Hinweisschrift:** Newsreader (400; Fallback Georgia)

**Character:** Eine sachliche Grotesk mit etwas Eigenart trägt alles, was man bedient; eine ruhige Zeitungs-Serif setzt erklärende Sätze ab. Beide liegen unter `public/fonts/` (OFL) und sind reine Oberflächenschriften: Segoe UI und Braveold bleiben den Exporten vorbehalten.

### Hierarchy
- **Title** (700, 1.75rem): h1 der Startseite.
- **Headline** (700, 1.125rem; Dialoge 1.5rem): Panel- und Dialogtitel.
- **Body** (400, 1rem, 1.45): Knöpfe, Felder, Menüs.
- **Label** (700, 0.8125rem): Abschnittsleisten; Reglerbeschriftungen 600.
- **Hint** (Serif 400, 0.875 bis 1rem): Hinweise im Inspector, Ausschnitt-Leiste, leere Zustände.

### Named Rules
**The Serif-erklärt Rule.** Serif nur für Sätze, die erklären; nie für Beschriftungen oder Werte. Zahlen in Reglern und Zoom mit `tabular-nums`.

## Layout

Raster aus Kopf (oben), Fach links (Hinzufügen-Kacheln, Reiter Bibliothek/Ebenen), Leinwand in der Mitte, Inspector rechts (scrollt in sich) und Slide-Leiste unten mit Kacheln, Zoomgruppe, Unterlage und Slide-Aktionen. Nichts liegt über der Leinwand ausser Meldungen und Overlays. Abstände in Schritten von 0.25 rem, Knopfhöhe 2.5 rem, Icons 18 px. Ziel 1280 × 720 bis 1536 × 864 bei 125 %; Wörter neben Slide-Aktionen erst ab 1536 px.

## Elevation & Depth

Flach, Tiefe nur durch harten Versatz in Tinte, nie weich oder farbig.

### Shadow Vocabulary
- **Taste in Ruhe** (`box-shadow: 3px 3px 0 var(--ink)`): alle eigenständigen Tasten.
- **Taste Hover** (`4px 4px 0`, um 1 px angehoben): sofort, ohne Übergang.
- **Gedrückt, gewählt, gesperrt**: kein Schatten, die Taste sitzt auf dem Versatz.
- **Overlay** (`4px 4px 0` bei Menü, Popover, Ausschnitt-Leiste, Meldung; `6px 6px 0` bei Dialog und Layout-Popover).

### Named Rules
**The Nur-Ruhe-Tasten Rule.** Reiter, Abschnittsleisten, Kacheln, Listenzeilen und Menüeinträge haben nie Schatten, auch nicht beim Hover.

## Shapes

Null Radius überall, auch an Feldern und Dialogen. Ränder 1 px in Tinte, Felder in weicher Tinte. Die einzige runde Form ist der Drehregler (Bauteil für eine künftige Korn-Stärke, noch nicht verbaut).

## Components

### Buttons
- **Standard:** transparent mit Tintenrand, Ruhe-Schatten; Hover Papierschatten.
- **Primär:** Akzentfläche, fett, nur «Exportieren» und die Hauptaktion eines Dialogs.
- **Gewählt / an:** Tinte invers (`aria-pressed`), ohne Schatten.
- **Gesperrt:** `aria-disabled` mit Tooltip-Grund, gesperrte Tinte auf Papierschatten.
- **Icon-Knopf:** 2.5 rem quadratisch, immer mit Namen und Tooltip.

### Umschalter, Schalter, Farbfelder
- **Umschalter:** graue Reihe mit Tintenrand, gewählt Tinte invers und fett; Fokusring um die ganze Reihe.
- **Schalter (Ja/Nein):** Block rechts in Tinte = an.
- **Farbfelder:** 2.5 rem, zuerst Akzent, dann Abstand, dann Markenfarben; gewählt mit 3-px-Ring in Tinte.

### Regler
Bahn mit Teilstrichen (Enden und Mitte lang), eckiger Griff mit Akzentstrich wie das Bauteil «Fader», Zahlenfeld mit Einheit rechts. Bildregler haben die Nullstelle in der Mitte und Beschriftungen an beiden Enden. Video kürzt mit einem Bereichsregler (Start- und End-Klammer). Keine +/−-Knöpfe.

### Inspector-Abschnitte
Graue Abschnittsleiste mit Chevron, fetter Beschriftung und Linie. Abschnitte sind einklappbar und starten zu, ausser «Ebene» und «Darstellung»; der Zustand bleibt pro Abschnitt über Auswahlwechsel. Unterabschnitte («Erweitert», Effekt-Einstellungen) sind mit einer Linie links eingerückt.

### Reiter, Menüs, Tooltips, Meldungen
- **Reiter links:** Bibliothek/Ebenen, aktiv Tinte invers; Bibliothek-Unterreiter mit Unterstrich.
- **Rechtsklickmenü und Effektmenü:** Papier, Tintenrand, Overlay-Schatten; Einträge ohne Schatten, Tastenkürzel als Kästchen.
- **Tooltip:** Papier auf Tinte, Kürzel als Taste rechts, 400 ms Verzögerung.
- **Meldung:** oben mittig über der Leinwand, Fehler mit 6-px-Rand und Symbol, Info mit 1-px-Rand.

## Do's and Don'ts

### Do:
- **Do** Werte nur über die `--…`-Variablen aus `src/ui/theme.ts` nutzen.
- **Do** den Fokus mit 2 px Tinte und 2 px Abstand zeigen, auf dunklen Flächen in Papier.
- **Do** gesperrte Bedienelemente mit `aria-disabled` und Grund im Tooltip lassen.
- **Do** Animationen nur auf Transform und Opazität, mit `prefers-reduced-motion` aus.

### Don't:
- **Don't** Radien, weiche Schatten, Verläufe oder Glas-Effekte in der Oberfläche.
- **Don't** Schatten an Reitern, Kacheln, Leisten oder Menüeinträgen.
- **Don't** Orange oder andere Slide-Farben als Oberflächenfarbe.
- **Don't** Segoe UI oder Braveold in der Oberfläche; Host Grotesk oder Newsreader nie in Exporten.
- **Don't** eine zweite Farbe für dieselbe Rolle oder eine Rolle ohne Farbe einführen.
