# apps/news-banner

Browser-Editor für die SharePoint-News-Thumbnails (1920×1080 PNG) des IT-Supports am BBZB Luzern, unter `/news-banner/`. Nutzer:innen sind das IT-Team ohne Photoshop-Kenntnisse. Ziel: Banner in unter einer Minute statt zehn.

**Vor jeder Arbeit lesen:** `docs/reference/` (die zwei PSD-Vorlagen sind die Wahrheit für Look und Masse). Plan und Entscheide der ersten Version: `docs/archiv/2026-11-04-news-banner.md`.

## Unverhandelbar
- Kein Speichern von Eingaben. Hochgeladene Bilder leben nur im Arbeitsspeicher. Ein Playwright-Test prüft, dass nichts Fremdes angefragt wird.
- Masse, Farben, Effektwerte des Banners stehen nur in `src/tokens.ts`. Oberfläche nur aus `@bbzb/ui`.
- Der Export ist 1920×1080 PNG und sieht aus wie die PSD-Vorlage. Sperrzonen und Banner-Rahmen erscheinen nur in der Vorschau, nie im Export.
- Feste Slots statt freiem Verschieben, kein Ebenen-System.
- Pfade zu `public/` immer mit `import.meta.env.BASE_URL`, nie mit `/` am Anfang.

## Prüfen
Test zuerst für Logik (Icon zu SVG, Layout-Slots, Dateiname). Vor jedem Commit zusätzlich den Export selbst öffnen und mit der PSD-Vorschau vergleichen.

## Architektur
Eine reine Funktion `renderBanner(ctx, state)` zeichnet Vorschau und Export auf Canvas 2D. State ist ein kleines Objekt in `useState`: Zielgruppe, Art, Icon links, rechts, optional unten. Icons: `lucide` (ISC) für alle Symbole, `@tabler/icons` (MIT) **nur** für Markenicons, eigene Bilder per Datei. Lizenztexte unter `public/licenses/`.

**Icon-Suche:** nutzt `src/icons/lucide-meta.json` (Namen, Stichwörter, Kategorien und Aliase von lucide.dev). Nach einem Update von `lucide` und `lucide-static` (gleiche Version) `npm run build:lucide-meta -w apps/news-banner` ausführen, das braucht Internet. Nur englisch, keine deutschen Synonyme (Entscheid Alexej). Markenicons: handgewählte Liste im Glob in `src/icons/catalog.ts`.

## Fallen
- Lucide-Icons haben viewBox 24 und Strichbreite 2 als Vorgabe. Hier immer 1.5 (PSD-Vorgabe: «WIDTH 1.5px, SIZE 256px»), Linienenden und -ecken rund.
- Tabler hat kein Authenticator, Outlook, SharePoint, Excel, Word. Dafür Lucide-Symbole nehmen (Schlüssel, Schild, Mail). Keine eigenen Microsoft-Logos einbauen.
- Effekte (Glow, Relief) per Canvas-Filter prüfen, in Edge gegenprüfen.
- npm-Workspaces legen Pakete in den Hauptordner: Tabler-Icons kommen über den Alias `@tabler-outline` aus `vite.config.ts`, nie über `/node_modules/…`.
