# apps/startseite

Startseite (`/`) mit den Kacheln aller Tools und Seite «Datenschutz» (`/datenschutz/`). Baut direkt in `../../dist`.

## Neues Tool eintragen
- `npm run neues-tool -- <id> "<Name>"` legt `apps/<id>` aus `apps/_vorlage` an und trägt die Kachel (Beta) in `src/tools.ts` ein.
- Danach den Platzhalter-Satz ersetzen (höchstens 90 Zeichen) und `public/vorschau/<id>.png` durch ein echtes Bild 960 × 540, am besten einen Export des Tools.
- Favicon: Kürzel in `scripts/favicons.mjs` (`KUERZEL`) eintragen und `node scripts/favicons.mjs` laufen lassen, sonst scheitert der Favicon-Test der Suite.
- `tools.ts` bleibt reine Daten ohne Importe, die e2e-Tests lesen die Datei in Node. Das Skript sucht das Ende der Liste `tools`, ihre Form also beibehalten.

## Datenschutz
Bekommt ein Tool eine Ausnahme (z. B. lädt es KI-Modelle von einer fremden Adresse), ergänzt du in `src/Datenschutz.tsx` unter «Ausnahmen» einen Satz zu diesem Tool und passt den Absatz «Nachprüfen» an.

## Gestaltung
Nur Variablen aus `packages/ui/src/theme.ts`, eckig, Fokusring aus `base.css`. Eigene Regeln in `src/start.css`.
