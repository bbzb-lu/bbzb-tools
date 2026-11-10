# Phase 2.8 Oberfläche aufräumen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kleine UI-Änderungen von Alexej: Icons, Bibliotheksnamen, Kanal in den CTA-Inspector, Layout einklappbar, Verlauf auf dem Slide-Hintergrund, Einstellungen-Dialog, Tabler-Hinweis.

**Architecture:** Fast nur UI. Einzige Modelländerung: `Slide.scrims` (optional). Der Verlauf-Effekt (`scrim`) und `ScrimPicker` werden für Foto und Slide geteilt.

**Tech Stack:** React 19, `@tabler/icons-react`, Konva, zod, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md`, Abschnitt «Entscheide Phase 2.8»

## Global Constraints
- Werte nur in `src/tokens.ts`, kein Hex sonst. Texte Deutsch, Schweizer Schreibweise, Du-Form, «…», keine Halbgeviertstriche.
- Kern importiert keine Plugins. Dateien unter 400 Zeilen. Altprojekte laden unverändert (neue Felder optional).
- Test zuerst, Gate vor jedem Commit (typecheck, lint, vitest, e2e), Ergebnis in Edge ansehen.

## Review Focus
- Altes Projekt ohne `scrims` öffnet und exportiert pixelgleich wie vorher.
- Slide-Verlauf im Export identisch zum Editor, mit und ohne Korn, auch bei verknüpften Slides (Panorama: je Slide eigene Verläufe).
- Slide-Verlauf überlebt Undo/Redo, Projektdatei sichern und öffnen, «Als anderes Format kopieren».
- Kanalwechsel im CTA-Inspector: ein Undo-Schritt, ohne CTA im Projekt Hinweis wie bisher.
- Dialog: Fokus rein und zurück auf den Knopf, Esc schliesst, Akzentwechsel ein Undo-Schritt.

### Task 1: Icons und Bibliotheksnamen
**Files:** Modify `src/plugins/elements/brand/BrandInspector.tsx`, `src/plugins/elements/photo/PhotoInspector.tsx`, `src/ui/Inspector.tsx`, `src/ui/BrandLibrary.tsx`, `src/plugins/elements/tag/index.tsx`; Test: `e2e/library.spec.ts` (bestehend anpassen), Vitest für Labels.
**Interfaces:** Produces: `libraryLabels: Record<TagVariant,string>` in `tag/insert.ts` (schul «Standort», fach «Fachbereich», frei «Frei», ort «Ort», cta «CTA»); `variantNames` bleibt für Ebenennamen.
- [ ] Test: Bibliothek Tab «Tags» listet genau diese fünf Namen; Ort-Chip enthält ein `svg` (Pin); Foto- und Brand-Inspector «Spiegeln» zeigen `IconFlipHorizontal` (Klasse `tabler-icon-flip-horizontal`), «Korn» `tabler-icon-grain` an Foto und Slide. Rot sehen.
- [ ] `variants` in `tag/index.tsx` nutzen `libraryLabels`; `TagList` setzt vor den Ort-Text `IconMapPin` (aria-hidden); Icons tauschen. Grün, Gate, Commit.

### Task 2: Kanal in den CTA-Inspector
**Files:** Modify `src/ui/Header.tsx` (Gruppe «Kanal» und `switchChannel` entfernen, nach `src/ui/layoutActions.ts`-nahem Ort verschieben), `src/plugins/elements/tag/TagInspector.tsx`; Test: bestehende e2e mit «Kanal» anpassen, neu `e2e/channel.spec.ts`.
**Interfaces:** Consumes: `setChannel(c: Channel): Promise<number | null>` aus `layoutActions.ts`, `channels`, `channelLabels`. Produces: gleiche Meldung wie bisher (Notice «n Link-Hinweise angepasst»).
- [ ] Test: Kopfzeile hat keine Gruppe «Kanal»; Auswahl eines CTA zeigt Gruppe «Kanal» mit zwei Knöpfen (`aria-pressed`); Wechsel auf LinkedIn ändert Text aller CTA mit Standardtext, ein Ctrl+Z stellt Instagram wieder her; andere Tag-Varianten zeigen keinen Schalter. Rot sehen.
- [ ] Umsetzen (Knöpfe wie bisher `aria-describedby`-Hinweis, Style `.channel` aus Header-CSS in den Inspector übernehmen oder `Choice` nutzen). Grün, Gate, Commit.

### Task 3: «Layout ändern» einklappbar
**Files:** Modify `src/ui/Inspector.tsx` (SlidePanel); Test: `e2e/layout.spec.ts`/bestehende Layout-Tests anpassen.
- [ ] Test: Slide-Inspector zeigt Abschnitt «Layout» mit Knopf «Layout ändern» (`aria-expanded=false`), Kacheln unsichtbar; Klick öffnet sie, Layoutwahl wendet an und klappt wieder zu; Slidewechsel klappt zu. Rot sehen.
- [ ] Umsetzen mit `useState` in SlidePanel und `key={i}` für den Zustand je Slide; bestehende e2e-Tests, die Kacheln direkt klicken, öffnen zuerst. Grün, Gate, Commit.

### Task 4: Verlauf auf dem Slide-Hintergrund
**Files:** Modify `src/model/types.ts` (`Slide.scrims?: Scrim[]`), `src/model/parse.ts` (zod), `src/canvas/SlideBackground.tsx`, `src/ui/Inspector.tsx`, `src/model/formatCopy.ts`/`layout.ts` falls Slides kopiert werden; Move `Scrim`-Schema/Typ und Konstanten aus `plugins/elements/photo/schema.ts` in `src/model/scrim.ts` (Foto importiert von dort), `ScrimPicker.tsx` nach `src/ui/ScrimPicker.tsx`; Test: `src/model/parse` Test, `src/canvas`-Pixeltest, `e2e/slide-scrim.spec.ts`.
**Interfaces:** Produces: `scrimsOf(slide|photoProps)`-Muster bleibt; `ScrimPicker` Props unverändert (`scrims, canAdd, advanced, onChange`); Slide-Effektschritte `scrimSteps` ohne Spiegelung (neue Hilfe `slideScrimSteps(slide)` im Effects-Ordner).
- [ ] Test (Vitest): Projekt ohne `scrims` parst; mit `scrims` parst und round-trippt; ungültige Seite wird abgelehnt (wie am Foto). Rot sehen.
- [ ] Test (e2e): Slide ohne Auswahl, «Verlauf hinzufügen» → «Unten» → Export: untere Pixelzeile dunkler als Hintergrund (Schwarzanteil), oberste unverändert; mit Korn gleiches Ergebnis plus Rauschen; Undo entfernt ihn; Projektdatei sichern und neu öffnen behält ihn. Rot sehen.
- [ ] Umsetzen: `useGrainCanvas` wird `useBackgroundCanvas(color, scrims, grain, …)`, Schlüssel enthält die Verläufe, Effektliste `[...scrim steps, grain]`; Inspector: Korn und `ScrimPicker` unter «Hintergrund» (`tool-grid`, danach Picker wie am Foto). Slide-Duplikate und Format-Kopie nehmen `scrims` mit. Grün, Gate, Commit.

### Task 5: Einstellungen-Dialog
**Files:** Create `src/ui/SettingsDialog.tsx`; Modify `src/ui/Header.tsx`, `src/ui/Inspector.tsx` (Abschnitt «Projekt» fällt weg), `src/ui/AccentMode.tsx` (Hinweistext «Schul-Tag» bleibt); Test: `e2e/settings.spec.ts`, bestehende Akzent-e2e anpassen.
- [ ] Test: Knopf «Einstellungen» (`IconSettings`, `data-tip`) in der Kopfzeile öffnet `role=dialog` «Projekteinstellungen» mit der Gruppe «Akzentfarbe»; Wechsel ändert `accentMode` (ein Undo-Schritt); Esc schliesst, Fokus zurück auf den Knopf; im Einfach-Modus sichtbar; der Slide-Inspector hat keinen Abschnitt «Projekt» mehr. Rot sehen.
- [ ] Umsetzen wie `ExportDialog` (natives `<dialog>`, gleiches Muster). Grün, Gate, Commit.

### Task 6: Tabler-Hinweis mit Logo
**Files:** Modify `src/ui/IconSearch.tsx`, `src/ui/app.css`; Asset `brand/ui/tabler-icons.png` (liegt schon im Repo, 306 × 104); `docs/` Brand-Tabelle in CLAUDE.md, DESIGN.md ein Satz; Test: `e2e/icon-search.spec.ts`, `src/architecture.test.ts` (kein externer Request bleibt).
- [ ] Test: Tab «Icons» zeigt `a` «Icons von Tabler» (`href=https://tabler.io/icons`, `target=_blank`, `rel="noopener noreferrer"`) mit `img` (alt «Tabler Icons», natürliche Breite > 0) unter Suche und Liste; der bestehende Playwright-Test gegen externe Requests bleibt grün (Link wird nicht geladen). Rot sehen.
- [ ] Umsetzen: Bild als Vite-Import (Muster wie `logo` in Header), Höhe 20 px, `muted`-Zeile am Ende von `IconSearch`. Grün, Gate, Commit.

### Abschluss
- [ ] Gesamt-Review, in Edge ansehen (Screenshots: Bibliothek, CTA-Inspector, Slide-Inspector, Dialog, Verlauf-Export), Roadmap «2.8 erledigt», Plan nach `docs/archiv/plans/`, `naechste-session.md` neu, Spezifikations-Entscheide bleiben.
