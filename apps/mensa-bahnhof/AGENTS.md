# apps/mensa-bahnhof

Mensa Bahnhof unter `/mensa-bahnhof/`. Ersetze diesen Absatz: wofür das Tool ist, wer es nutzt, was es nie tun darf.

## Erste Schritte
- In `apps/startseite/src/tools.ts` den Platzhalter-Satz ersetzen (höchstens 90 Zeichen) und `public/vorschau/mensa-bahnhof.png` durch ein echtes Bild ersetzen (960 × 540).
- `src/App.tsx` ausbauen, Bauteile aus `@bbzb/ui`, Werte nur aus `packages/ui/src/theme.ts` oder einer eigenen `src/tokens.ts`.
- Braucht das Tool eine fremde Adresse (z. B. KI-Modelle), eine eigene CSP-Regel in `_headers` und ein Satz auf der Seite «Datenschutz».
- Speichert das Tool etwas, beginnt jeder Schlüssel mit `mensa-bahnhof`.
- Fallen und Entscheide kurz hier festhalten, Pläne unter `docs/`.

Starten: `npm run dev -w apps/mensa-bahnhof`. Der e2e-Test in `e2e/` läuft automatisch mit, sobald das Tool in `tools.ts` steht.
