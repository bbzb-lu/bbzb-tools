# Glücksrad Wahnsinn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox syntax.

**Goal:** Vorlagen aus `presets/*.txt` und ein Wahnsinn-Modus mit Effekten und Ton beim Drehen.

**Architecture:** Reine Logik (Vorlagenname, Zeigerindex, Partikel) getestet in Vitest. `Fx.tsx` ist eine feste Ebene ausserhalb von `main` mit Canvas, Hitmarker, Schriftzügen und Ton. `main` bekommt `wm-dreht` oder `wm-sieg` für CSS-Effekte.

**Tech Stack:** React, Vite (`import.meta.glob`), Canvas 2D, Web Audio API, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-gluecksrad-wahnsinn-design.md`

## Global Constraints
- Nichts verlässt den Browser, keine neuen Abhängigkeiten, keine Audiodateien, keine fremden Bilder.
- Effektfarben nur als `fx-*`-Tokens in `packages/ui/src/theme.ts`.
- Höchstens 3 Blitze pro Sekunde, Vollbild-Blitz einmal pro Gewinn, keine rote Vollfläche.
- Partikel höchstens `MAX = 360`, Pixeldichte höchstens 1,5.
- Texte Deutsch, Schweizer Rechtschreibung, Du-Form, keine Halbgeviertstriche, auch in `.md`.
- Keine absoluten Pfade. Dateien unter 400 Zeilen. `localStorage`-Schlüssel mit `gluecksrad`.
- Gate vor Commit: `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test --project suite --project gluecksrad`.

## Review Focus
- Mehrmals hintereinander drehen mit Modus an: Klassen und Ebene verschwinden jedes Mal, nichts bleibt hängen.
- Modus ausschalten oder Karte schliessen mitten im Effekt: Canvas wird leer, keine Timer laufen weiter.
- `AudioContext` fehlt oder ist blockiert: kein Fehler in der Konsole, Drehen funktioniert.
- «Weniger Bewegung» im System: Schalter gesperrt, nie Effekte.
- Presets-Ordner leer oder Datei mit über 100 Zeilen, Doppelten, Leerzeilen: Vorlagenliste und Rad bleiben heil.
- Sehr schmales Handy: Ebene erzeugt kein horizontales Scrollen.

---

### Task 1: Vorlagen
**Files:** Create `apps/gluecksrad/presets/*.txt` (mindestens `entscheide-schnell.txt`, `mittagessen.txt`, `wuerfel.txt`, `klasse-beispiel.txt`, `ja-nein.txt`), `apps/gluecksrad/src/presets.ts`, `apps/gluecksrad/src/vite-env.d.ts`, Test `apps/gluecksrad/src/presets.test.ts`; Modify `App.tsx`, `app.css`.
**Interfaces:** Produces `presetName(datei: string): string` (Dateipfad zu Beschriftung: ohne Ordner und `.txt`, `-` und `_` zu Leerzeichen, erster Buchstabe gross), `presets: { name: string; text: string }[]` (nach Name sortiert).
- [ ] Test zuerst: `presetName('../presets/klasse-beispiel.txt') === 'Klasse beispiel'`, `presetName('x/ja_nein.txt') === 'Ja nein'`; jede echte Vorlage ergibt mit `parseOptionen` 2 bis 100 Optionen ohne `gekuerzt`; `presets.length > 0`. Laufen lassen, muss scheitern.
- [ ] `presets.ts` mit `import.meta.glob('../presets/*.txt', { query: '?raw', import: 'default', eager: true })`, Dateien anlegen (erfundene Namen, kein Personenbezug).
- [ ] UI: über dem Textfeld Zeile «Vorlagen» mit je einem Knopf pro Vorlage, Klick ruft `aendern(text)` und setzt `gekuerzt` zurück; `aria-pressed` wenn die aktuelle Liste gleich ist; während der Drehung gesperrt.
- [ ] e2e: Klick auf «Mittagessen» füllt die Liste, die Optionenzahl stimmt. Gate, Commit.

### Task 2: Effekt-Kern (rein und getestet) und Tokens
**Files:** Create `apps/gluecksrad/src/fx/partikel.ts`, `apps/gluecksrad/src/fx/zeiger.ts`, `apps/gluecksrad/src/fx/ton.ts`, Tests `partikel.test.ts`, `zeiger.test.ts`; Modify `packages/ui/src/theme.ts`.
**Interfaces:**
- `theme.ts`: Tokens `fx-rot`, `fx-orange`, `fx-gelb`, `fx-gruen`, `fx-cyan`, `fx-magenta`.
- `zeiger.ts`: `indexUnterZeiger(drehungGrad: number, n: number): number` (Segment unter dem Zeiger oben; Segment i belegt `[i*w,(i+1)*w)` im Uhrzeigersinn ab oben, `w = 360/n`), `winkelAusMatrix(transform: string): number` (CSS-`matrix(a,b,…)` oder `none` zu Grad).
- `partikel.ts`: `type Partikel = { x; y; vx; vy; g: number; reibung: number; leben: number; alter: number; art: 'rect' | 'linie' | 'kreis' | 'ring'; farbe: string; groesse: number; wachs: number; rot: number; vrot: number }`; `MAX = 360`; `hinzufuegen(liste, neue): Partikel[]` (wirft die ältesten raus, wenn über `MAX`); `schritt(liste, dt: number): Partikel[]` (Sekunden, bewegt, entfernt Abgelaufene); Erzeuger `konfetti(x, y, richtungGrad, farben, rnd?)`, `feuerwerk(x, y, farbe, rnd?)`, `explosion(x, y, farben, rnd?)`; `zeichne(ctx: CanvasRenderingContext2D, liste)`.
- `ton.ts`: `export const ton = { frei(), tick(i: number), sweep(), airhorn(), explosion(), fanfare() }`, alles in `try/catch`, ein `AudioContext` lazy, Master: `DynamicsCompressor` plus Gain 0,3; `frei()` ruft `resume()` (im Klick aufgerufen).
- [ ] Tests zuerst: `indexUnterZeiger(0, 4) === 0`; `indexUnterZeiger(-90, 4) === 1` (Rad dreht links, Segment 1 kommt oben an); gleiche Formel wie die Landung: für `i` und `n` zwischen 1 und 12 liefert `indexUnterZeiger(Math.ceil(d/360)*360 + 1440 + 360 - (i + 0.5) * 360/n, n) === i`. `winkelAusMatrix('none') === 0`, `winkelAusMatrix('matrix(0, 1, -1, 0, 0, 0)')` ist 90. Partikel: `hinzufuegen` hält höchstens `MAX`; `schritt` entfernt Partikel mit `alter >= leben`, bewegt mit Schwerkraft nach unten; `explosion` erzeugt mindestens einen `ring` und mehr als 30 Teile. Rot sehen.
- [ ] Implementieren, `ton.ts` ohne Test (Browser-API), aber mit `try/catch` um alles. Gate, Commit.

### Task 3: Ebene, Schalter, CSS, e2e, Doku
**Files:** Create `apps/gluecksrad/src/fx/Fx.tsx`, `apps/gluecksrad/src/fx/fx.css`; Modify `App.tsx`, `Rad.tsx` (nur `--dauer`), `Gewinner.tsx` (Sonnenbrille), `app.css`, `AGENTS.md`, `e2e/start.spec.ts`.
**Interfaces:** Consumes Task 2. `Fx({ phase: 'aus' | 'dreht' | 'sieg'; mitTon: boolean; box: HTMLElement | null; runde: number })`.
- [ ] e2e zuerst (rot): Schalter «Wahnsinn» an, `main` hat während der Drehung die Klasse `wm-dreht` und es gibt ein `canvas.fx-canvas`; nach dem Stillstand `wm-sieg` und die Gewinnerkarte; nach dem Schliessen weder `wm-dreht` noch `wm-sieg`; keine fremden Requests, keine `pageerror`. Mit «weniger Bewegung» ist der Schalter gesperrt (`aria-disabled`). Zweimal hintereinander drehen: Klassen kommen und gehen beide Male.
- [ ] `App.tsx`: Zustände `wahnsinn`, `mitTon` (Standard an), `box` per Callback-Ref auf `.rad-box`, `runde` zählt Gewinne. Schalter «Wahnsinn» nur im Rad-Modus, gesperrt bei `dreht` und bei `reducedMotion()`, Hinweis darunter; bei an der Schalter «Ton» und der Hinweis «Wackelt, blitzt einmal und kann laut sein.». `drehen`: bei an `ton.frei()`, 8 statt 4 Umdrehungen, `--dauer` 6,5 s statt 4 s auf `.rad-box`. `main` bekommt `wm-dreht` während `dreht`, `wm-sieg` solange die Karte offen ist, nur bei an.
- [ ] `Fx.tsx`: feste Ebene ausserhalb von `main`: Canvas (Pixeldichte höchstens 1,5, Schleife nur mit Partikeln), Vignette, Scanlines, Lens-Flare, Hitmarker, Schriftzüge. Phase `dreht`: Winkel des Rads je Frame aus `.rad-dreh` lesen, bei neuem Segment `ton.tick`, Marker höchstens alle 350 ms, Funken am Zeiger, alle 600 ms ein Schriftzug (höchstens 5 gleichzeitig). Phase `sieg` (je `runde` einmal): Explosion in der Radmitte, Blitz, Boom, Kanonen links und rechts, drei Feuerwerke gestaffelt, `ton.explosion`, `ton.airhorn`, später `ton.fanfare`. Aufräumen: Timer, Schleife und Partikel bei Phasenwechsel und Unmount.
- [ ] `fx.css` und `app.css`: `wm-dreht` wackelt (`steps`), `wm-sieg` Boom-Wackeln einmalig, Regenbogen per `hue-rotate` auf `.rad-box`, RGB-Split per `drop-shadow` mit `fx-cyan` und `fx-magenta` auf `.rad`, Ebene ohne horizontales Scrollen (`overflow: clip`). Sonnenbrille als eigenes SVG in `Gewinner.tsx`, fällt mit Nachfedern auf die Karte, darunter «DEAL WITH IT».
- [ ] `AGENTS.md`: Ordner `presets/` (Regeln für Dateien), Ordner `fx/`, harte Grenzen. Gate, Impeccable-Detektor, Commit.
