# BBZB Tools: Entwurf der Suite

Stand 10.11.2026, aus dem Brainstorming mit Alexej. «Entscheid Alexej» = von ihm so gesagt, «Entscheid Claude» = von Alexej an Claude übergeben.

## Wozu

Am BBZB Luzern entstehen laufend kleine Webtools, die Mitarbeitenden und Lehrpersonen Arbeit abnehmen. Die ersten zwei (Social Studio, News-Banner) teilen schon Oberflächenbauteile, Schriften, Konfiguration und Regeln als Kopien, und diese Kopien laufen nach einer Woche auseinander (`theme.ts`, `kit.css`). `bbzb-tools` vereint alle Tools in einem öffentlichen Repo und einer Website. Eine Änderung an einem gemeinsamen Bauteil (zum Beispiel am Button) passiert an einer Stelle und kommt in allen Tools an. Neue Tools entstehen schnell, weil die Basis steht.

## Ziele
- Eine Website `bbzb-tools.pages.dev` (eigene Domain später) mit Startseite und allen Tools unter Unterpfaden.
- Startseite: Kacheln mit Name, einem Satz, Vorschaubild und Beta-Hinweis. Klick öffnet das Tool. Vorbild Creative Cloud oder Artcraft, aber ruhiger, im Look der bestehenden Tools (Papier, Tinte, eckig, harter Schatten). Gestaltung frei, mit Impeccable (Entscheid Alexej).
- Gemeinsamer Kopf in jedem Tool: oben links «BBZB Tools», darunter der Tool-Name, Klick führt zur Startseite. Ersetzt die heutigen Logos (Entscheid Alexej).
- Inhalt beim Start: Social Studio, News-Banner und die Kachel «SharePoint Interactives». Dahinter alle sechs Embeds (Radio-Player, Pomodoro-Timer, Suchspiel-Auswertung, Tic-Tac-Toe, Sudoku, Vier gewinnt; Entscheid Alexej) mit Vorschau in Originalgrösse, Knopf «Einbettungscode kopieren», sortierbar nach Datum und Name.
- Seite «Datenschutz» in einfachen Worten: was nicht gespeichert wird und wie die Dienststelle Informatik es selbst nachprüft (CSP-Header, Netzwerk-Test, Quellcode).
- Neue Tools aus einer Vorlage in wenigen Schritten, mit Test, Kachel und Deploy fertig verdrahtet.
- Ein Agent, der an einem Tool arbeitet, liest nur dessen Notizen und die kurzen gemeinsamen Regeln.

## Nicht in diesem Projekt
- Porträtfoto-Tool (heute `Identity-Card-Photo-Creator`, Python) und weitere Thumbnail-Tools. Die Basis soll sie nur einfach machen.
- Speichern im News-Banner. Es zieht unverändert um (Entscheid Alexej).
- Neubau der Embeds in React. Sie bleiben schlichtes HTML/CSS/JS ohne Build (Entscheid Alexej).
- Übernahme der gespeicherten Studio-Projekte aus dem Browser.

## Was ein Fehlschlag wäre
- Eine Schrift- oder Bilddatei, die nicht öffentlich sein darf, landet im öffentlichen Repo oder in dessen Git-Verlauf.
- Ein Tool sendet Daten nach aussen oder bekommt ein Backend.
- Eine Änderung in einem gemeinsamen Paket macht ein anderes Tool kaputt, ohne dass ein Test scheitert.
- Ein Tool löscht beim Aufräumen den Browser-Speicher eines anderen.
- Die Exporte von Studio und Banner sehen nach dem Umzug anders aus als vorher.

## Feste Rahmenbedingungen
- Öffentliches, quelloffenes Repo `bbzb-lu/bbzb-tools`, damit jede:r (auch die Dienststelle Informatik) den Code prüfen kann (Entscheid Alexej).
- Alle Regeln aus den bisherigen Repos gelten weiter: nichts verlässt den Browser, keine Laufzeit-CDNs, einzige Ausnahme GET auf KI-Modelle im Studio. Schweizer Rechtschreibung, Du-Form, keine Halbgeviertstriche. Zielgeräte Windows 11 mit Edge, oft schwach.
- Schriften (Entscheid Alexej):
  - Segoe UI (Regular, Bold, Black) ist von der Schule lizenziert und darf ins öffentliche Repo. Der alte Microsoft-Lizenztext `Segoe_EULA.txt` wird durch einen Hinweis auf die Schullizenz ersetzt.
  - Braveold bleibt für die Posts im Studio (Envato-Lizenz). Die Datei darf nicht öffentlich herunterladbar sein: privates Repo `bbzb-lu/bbzb-tools-fonts`, im öffentlichen Repo per `.gitignore` ausgeschlossen, `npm run fonts` holt sie bei Zugriff, der Deploy holt sie mit einem Zugangsschlüssel. Ohne Schrift blockiert das Studio wie heute den Export (Entscheid Claude). Dass die Live-Seite die Schrift an den Browser ausliefert, deckt die Web-Lizenz ab (Entscheid Alexej vom 21.10.2026), es geht nur um die Datei im Repo.
  - Oberflächenschriften sind frei: Host Grotesk und Newsreader (OFL), wie heute.
- Jede Datei, die öffentlich wird, wird vor dem Umzug einzeln geprüft. Besonders: Fotos in `docs/reference/layouts/`, `e2e/fixtures/`, `e2e/golden/`, `docs/ideen screenshots/` (erkennbare Lernende?), PSD- und PDF-Vorlagen, `docs/design/editor.pen`. Was nicht öffentlich darf, wird ersetzt oder wandert ins private Repo.
- Umzug ohne Git-Verlauf: Dateien kommen frisch ins neue Repo, im alten Verlauf steckt Braveold (Entscheid Claude). Die alten Repos bleiben mit Verlauf bestehen.
- Alle Tools teilen sich eine Herkunft und damit IndexedDB, OPFS und localStorage. Jedes Tool speichert in einem eigenen Namensraum (Datenbankname und OPFS-Ordner = Tool-Name). Künftig speichern alle Tools laufend und bieten eine Projektdatei als Sicherung (Entscheid Alexej).

## Aufbau (Entscheid Claude)
- npm-Workspaces, keine Zusatzwerkzeuge (kein Turborepo, kein Nx).
- `apps/<tool>/` je ein Vite-Projekt mit eigenem `base` (`/social-studio/`, `/news-banner/`). Die Startseite ist ebenfalls eine App unter `/`.
- `embeds/<name>/` die sechs Embeds als statische Ordner unter `/sharepoint/<name>/`. Snake und Gruppengenerator sind nicht eingebunden und ziehen nicht um. `bbzb-hub-template` wird `embeds/_vorlage/` für neue Embeds (Entscheid Claude). RawPixel ist lizenziert und liegt schon heute in öffentlichen Repos, sie bleibt öffentlich. Gemeinsame Schrift RawPixel, Icons und Grundstile liegen einmal in `embeds/_shared/` statt sechsfach kopiert. Jedes Embed hat eine kleine Beschreibung (Name, Datum, Art) für die Übersicht.
- `packages/` für Gemeinsames. Zu Beginn nur `ui`: Bauteile aus `src/ui/kit/`, Oberflächenfarben (`theme.ts`), `base.css`, `fonts.css`, UI-Schriften, gemeinsamer Kopf. `brand` (CI-Farben, Segoe UI) entsteht erst, wenn ein zweites Tool es braucht. Bis dahin liegt beides im Studio (Entscheid Claude, Plan 2). Konfiguration (TypeScript, ESLint, Vitest, Playwright, Netzwerk-Test) liegt im Hauptordner statt in einem Paket (Entscheid Claude, beim Planen geändert).
- Regel für später: Etwas wandert erst nach `packages/`, wenn ein zweites Tool es wirklich braucht. Das Speichern (Dexie, OPFS, Edge-Kniff aus `src/storage/db.ts`) wird deshalb erst dann ein Paket `storage`, wenn das Banner speichern lernt.
- Die heute auseinandergelaufenen Stände von `theme.ts` und `kit.css` werden zusammengeführt: Grundlage ist der Stand des Studio, studio-eigene Regeln (Bibliothek, Zahlenrolle, Farbfelder) bleiben im Studio.
- Build: jede App baut sich selbst, ein Skript legt alle Ergebnisse und die Embeds in einen Ordner `dist/`. Ein Cloudflare-Pages-Projekt `bbzb-tools`.
- Sudoku lädt Rätsel von `sudoku-api.vercel.app`, der Radio-Player einen Stream von `stream.streambase.ch`. Beide bleiben so (Entscheid Alexej). Sie bekommen eine Ausnahme nur für ihren Pfad in CSP und Netzwerk-Test, einen kleinen Hinweis in der Embed-Übersicht und einen Eintrag auf der Seite «Datenschutz»: es wird nur geladen, nichts von den Nutzenden gesendet.
- Header: eine `_headers`-Datei mit CSP pro Pfad. Grundregel streng wie beim Banner, das Studio zusätzlich mit `wasm-unsafe-eval`, Blob-Workern und `connect-src` auf Hugging Face. Embeds müssen in SharePoint-iframes laufen dürfen (`frame-ancestors https://sluz.sharepoint.com` statt `'none'`, eingebunden vor allem auf `sluz.sharepoint.com/sites/BBZB`), Editoren nicht.

## Tests und Deploy (Entscheid Alexej: automatisch)
- GitHub Actions bei jedem Pull Request und Push: Typecheck, Lint, Vitest und Live-Build auf Linux, Playwright (Edge) aller Apps auf Windows. Ändert sich etwas in `packages/`, laufen die Tests aller Tools.
- Der Test-Build (`--mode test`, mit Testhaken) wird nie deployt. `scripts/check-live-build.mjs` prüft den Live-Build vor dem Deploy und in jedem Pull Request.
- Nach Merge auf `main` und grünen Tests geht die Seite automatisch live. Das Schulnetz, das wrangler blockiert, spielt keine Rolle mehr. Claude fragt Alexej vor dem Merge, nicht mehr vor dem Deploy.
- Beitragende sind Mitglieder von `bbzb-lu` und pushen Branches ins Repo, keine Forks. So hat jeder Pull Request Zugriff auf Braveold und alle Pixel-Tests laufen. Pull Requests aus Forks scheitern in der CI (kein Zugriff auf Braveold) und werden nur nach einem Lauf auf einem Branch im Repo gemergt. Kein `pull_request_target` (Entscheid Claude).
- Die Embeds bekommen ihre bestehenden Prüfskripte (`verify.js`, beide SharePoint-Grössen) im selben Lauf.

## Arbeitsweise für Mitarbeitende und Agenten
- Beitragende: Alexej, andere Mediamatik-Lernende, beim Banner auch IT- und Kommunikationsmitarbeitende. Alle intern (Entscheid Alexej).
- Werkzeuge: vor allem Claude Code, künftig auch Codex. Anweisungen stehen in `AGENTS.md`, jede `CLAUDE.md` enthält nur `@AGENTS.md`. Eine kurze `AGENTS.md` im Hauptordner (Karte, gemeinsame Regeln, Ablauf), je eine pro App und eine für `embeds/`. So liest ein Agent nur, was zum Ordner gehört.
- Notizen bleiben kurz (Regel aus dem Studio: ab etwa 100 Zeilen aufräumen, Erledigtes nach `docs/archiv/` im jeweiligen Tool).
- Ideen und Planung über GitHub Issues mit Label pro Bereich (`social-studio`, `news-banner`, `embeds`, `startseite`, `alle`) und ein GitHub Project als Board (Eingang, Geplant, In Arbeit, Erledigt). Öffentlich ist in Ordnung (Entscheid Alexej). Regel: keine echten Fotos, Namen oder Projektdateien in Issues. `roadmap.md` und `ideen.md` fallen weg, offene Punkte daraus und aus `windows-checkliste.md` werden Issues.
- Spezifikation und Pläne als `.md` beim Tool: `apps/<tool>/docs/`. Übergreifendes unter `docs/` im Hauptordner.
- Verbindlich sind Tests, Lint und die Regeln in `AGENTS.md`. Superpowers, Impeccable und Ponytail sind im Repo als Plugins eingetragen und werden angeboten, nicht verlangt (Entscheid Alexej).
- Ein neues Tool: `npm run neues-tool -- <id> "<Name>"` kopiert `apps/_vorlage/` und trägt eine Beta-Kachel ein. Danach Satz und Vorschaubild ersetzen. Test (`e2e/`), Build und Deploy laufen ohne weitere Verdrahtung mit.

## Reihenfolge
1. Fundament: Workspaces, Paket `ui`, CI, automatischer Deploy, Labels und Board. Das private Schriften-Repo kommt mit dem Studio.
2. Startseite mit Kacheln, gemeinsamer Kopf, Seite «Datenschutz».
3. News-Banner umziehen (klein, prüft das Fundament).
4. Social Studio umziehen, inklusive Dateiprüfung und Braveold-Einbindung.
5. Embeds und ihre Übersicht.
6. Abschluss: im alten Studio ein Hinweis «umgezogen, lade offene Projekte als Datei herunter», es bleibt etwa einen Monat online. Die alten Repos der umgezogenen Tools und Embeds bekommen einen Hinweis im README und werden archiviert, nicht gelöscht. Danach stellt Alexej die SharePoint-Einbettungen auf die neuen Adressen um.

Während des Umzugs ruht die Entwicklung in den alten Repos (Entscheid Alexej).

## Dem Builder überlassen
- Gestaltung der Startseite, der Embed-Übersicht und des Kopfs (mit Impeccable, Bauteile aus `ui`).
- Name und Form des Befehls für neue Tools, Form der Embed-Beschreibung, genaue Ordnernamen innerhalb der Apps.
- Wie die Pixel- und Export-Tests nach dem Umzug belegen, dass die Exporte gleich aussehen.
- Aufteilung in einen oder mehrere Pläne.
