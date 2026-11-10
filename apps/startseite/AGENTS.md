# apps/startseite

Startseite (`/`) mit den Kacheln aller Tools und Seite «Datenschutz» (`/datenschutz/`). Baut direkt in `../../dist`.

## Neues Tool eintragen
- Eintrag in `src/tools.ts`: `id` gleich Ordnername, `pfad` `/<id>/`, Satz höchstens 90 Zeichen, `beta` solange es neu ist.
- Vorschaubild 960 × 540 als PNG nach `public/vorschau/<id>.png`, am besten ein echter Export des Tools.
- `tools.ts` bleibt reine Daten ohne Importe, die e2e-Tests lesen die Datei in Node.
- Vite-Config der neuen App: `base: '/<id>/'`, `build.outDir: '../../dist/<id>'`, `emptyOutDir: false`, `test.exclude: ['e2e/**','node_modules/**']`.

## Datenschutz
Bekommt ein Tool eine Ausnahme (z. B. lädt es KI-Modelle von einer fremden Adresse), ersetzt du in `src/Datenschutz.tsx` den Satz unter «Ausnahmen» durch einen Satz zu diesem Tool.

## Gestaltung
Nur Variablen aus `packages/ui/src/theme.ts`, eckig, Fokusring aus `base.css`. Eigene Regeln in `src/start.css`.
