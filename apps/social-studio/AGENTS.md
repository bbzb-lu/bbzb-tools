# apps/social-studio

Browser-Editor für Instagram/LinkedIn-Carousels und Stories des BBZB Luzern im BBZB-Designsystem, unter `/social-studio/`. Nutzer:innen sind Lernende und Sekretariat ohne Bildbearbeitungswissen.

**Vor jeder Arbeit lesen:** `docs/2026-10-21-bbzb-social-studio-design.md` (verbindliche Spezifikation), `docs/research/` (Stack, Lehren aus ZeroSeams), `docs/reference/layouts/*.jpg` und `docs/reference/Anleitung-Social-Media-Vorlage-Entwurf.pdf` (so sollen Exporte aussehen). Alte Pläne und Entscheide: `docs/archiv/`.

## Unverhandelbar
- Kein Foto, kein Video und keine Projektdatei verlässt den Browser. Einzige fremde Requests: GET auf KI-Modelldateien von Hugging Face (CSP-Ausnahme in `_headers`). Ein Playwright-Test prüft das.
- Exporte halten das Designsystem ein (Farben, Schriften, keine abgerundeten Flächen, kein Logo). Slide-Werte nur in `src/tokens.ts`, Oberflächenwerte nur in `packages/ui/src/theme.ts` und `src/ui/theme.ts` (studio-eigene).
- Braveold liegt nie im Repo: `npm run fonts` holt sie nach `fonts-private/`. Ohne sie blockiert der Export.
- Speicher-Namensraum: Dexie `social-studio`, OPFS-Ordner `social-studio-assets`, localStorage `social-studio.*`.
- Der Test-Build (`--mode test`, mit Testhaken `src/testHook.ts`) wird nie deployt. Pixel-, Golden- und Exporttests nie aufweichen, Sollwerte nicht anpassen.

## Oberfläche
- `DESIGN.md` beschreibt die gebaute Oberfläche (aus dem Code erzeugt). Referenz bleibt der Pen-Entwurf `docs/design/editor.pen` (Einstieg `docs/design/README.md`).
- `editor.pen` ist verschlüsselt: nur über die Pencil-Werkzeuge lesen, nie mit Read oder Grep. Werte nie in `.md` abschreiben.
- Neue UI-Teile nutzen `@bbzb/ui` und `src/ui/kit/`. Schlicht und eckig, die Oberfläche konkurriert nicht mit den Slides.

## Architektur
- React 19, Konva/react-konva, zustand + immer + zundo, Mediabunny (Video lesen, MP4 schreiben), heic-to (eigener Chunk), transformers.js im Worker (Freistellen), Dexie + OPFS, fflate.
- Eine durchgehende Leinwand: Slide `i` liegt bei `x = i × Breite`, Elemente in globalen Koordinaten, der Export schneidet pro Slide aus.
- Dokumentmodell ist reines TypeScript ohne React. Medien als Blob in OPFS, im Dokument nur die Asset-ID.
- Erweiterung nur über Registries (`ElementType`, `LayoutPreset`, `AssetPack`, `Exporter`, `AiTool`, `Effect`, `FormatPreset`). Der Kern importiert keine Module direkt.
- `docs/reference/psd-geometry.json` ist die Quelle für die Layout-Presets. Brand-Assets unter `brand/`, Herkunft und Lizenz in `brand/fonts/README.md`, `brand/doodles/README.md`, `brand/tabler/LICENSE`.
- Test zuerst für Dokumentmodell, Zuschnitt, Slide-Zuordnung, Export und Manifest. Exporte selbst öffnen und mit `docs/reference/layouts/` vergleichen. Testvideos: `sh scripts/make-test-videos.sh` (braucht ffmpeg).

## Fallen
- Braveold bildet eine «st»-Ligatur. Canvas 2D hat keine Ligatur-Steuerung, ein Pixel-Test sichert die Lösung ab.
- iPhone-Fotos und -Videos sind oft HEIC/HEVC. HEIC wird im Browser konvertiert, in Edge mit echten Dateien testen.
- Schriften müssen geladen sein (`document.fonts.load`), bevor Konva Text misst oder exportiert.
- Browser-Speicher kann geräumt werden: `navigator.storage.persist()` anfordern, Projektdatei als Sicherung anbieten.
- Konva 10: `shiftBehavior="default"` gibt das Seitenverhältnis mit Shift nicht frei. Für «Ecke proportional, Shift frei» `keepRatio` + `shiftBehavior="inverted"`.
- React-`onWheel` ist passiv: für Ctrl/Alt + Rad einen nativen Listener mit `{ passive: false }`.
- Edge verwirft IndexedDB-Schreibvorgänge beim Neuladen, wenn die Transaktion in `pagehide` nicht sofort mit `commit()` endet (`src/storage/db.ts`).
- Alt + ← / → navigiert in Edge zurück/vor. Der Editor fängt das ab, Playwright kann es nicht auslösen: über `defaultPrevented` testen.
- Zielgeräte sind schwach: Fotos auf höchstens 4096 px begrenzen, Performance in Edge prüfen.
- Tests, die nicht scheitern können, wenn das Feature fehlt, zählen nicht als Beleg.
