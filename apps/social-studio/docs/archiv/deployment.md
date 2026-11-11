# Deployment: Cloudflare Pages

Nur die gebaute App (`dist/`) wird hochgeladen. Projekte, Fotos und Videos bleiben im Browser der Nutzer:innen.

## Stand 21.10.2026
- `wrangler` ist auf dem Mac von Alexej mit seinem Cloudflare-Konto angemeldet (`npx wrangler whoami`).
- Account-ID: im Cloudflare-Dashboard (hier entfernt, das Repo ist öffentlich)
- Pages-Projekt `bbzb-social-studio` (Production-Branch `main`), URL `https://bbzb-social-studio.pages.dev`. **Erstes Deploy: 21.10.2026**, Phase 1.
- **Öffentlich, ohne Cloudflare Access** (Entscheid Alexej, 21.10.2026). Die Schriften sind über eine Web-Lizenz abgedeckt, siehe `brand/fonts/README.md`. Die Daten der Nutzer:innen liegen ohnehin nur im Browser.

**Netzwerk:** Das Schulnetz blockiert wrangler (Verbindung zu Cloudflare). Deploys von einem Schulrechner aus über Hotspot machen oder später per GitHub Actions.

## Schritte (Phase 1)
1. **Projekt anlegen** (erledigt am 21.10.2026, nur zur Info). Neuere wrangler-Versionen versuchen beim `project create` eine Autokonfiguration, die hier scheitert. Zuverlässig ist das direkte Deploy, das das Projekt bei Bedarf anlegt:
   ```
   npm run build
   npx wrangler pages deploy dist --project-name bbzb-social-studio --branch main
   ```
   Alternativ per API: `POST /accounts/<id>/pages/projects` mit `{"name":"bbzb-social-studio","production_branch":"main"}`.
   Reguläre Deploys laufen mit `npm run deploy` (führt vorher alle Prüfungen aus).
2. **Header** über `public/_headers` (landet in `dist/`):
   ```
   /*
     Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self' https://huggingface.co https://*.hf.co; frame-ancestors 'none'
     X-Content-Type-Options: nosniff
     Referrer-Policy: no-referrer
     Permissions-Policy: camera=(), microphone=(), geolocation=()
   ```
   Einzige Hosts ausserhalb der eigenen Herkunft sind die des KI-Modells (Phase 4b, nur GET): `huggingface.co` und die Weiterleitung auf den Dateispeicher. Gemessen am 28.10.2026: `us.aws.cdn.hf.co`; der Name hängt von Region und Speicher ab, deshalb `*.hf.co` (nur Hugging Face). Wechselt die Modellquelle (`tokens.cutout.model.host`), hier nachziehen. Die Laufzeit von onnxruntime (WASM) liegt in `dist/assets/`, kein CDN; der Build bricht ab, wenn eine Bibliothek wieder eine CDN-Adresse enthält (`vite.config.ts`). Die Header nach jedem Deploy prüfen (`curl -I`).
   Das Modell ist auf einen Commit gepinnt (`tokens.cutout.model.revision`). Für ein neues Modell: SHA unter `https://huggingface.co/api/models/<id>` (Feld `sha`) eintragen, Grösse (`downloadMB`) und Ergebnis in Edge neu prüfen.
   Die ORT-WASM-Datei ist ca. 21,6 MB, Cloudflare Pages erlaubt 25 MiB je Datei. Der Build bricht über 24 MiB ab (`vite.config.ts`).
   Ohne COOP/COEP-Header ist die Seite nicht cross-origin-isolated, onnxruntime rechnet im WASM-Fallback dann einfädig (Mac ca. 7 s statt 4 s). Die Header würden alle Ressourcen und Downloads betreffen: Entscheid Alexej, erst nach dem Windows-Test.
   Ein `e2e/network.spec.ts`-Test prüft, dass der Modell-Download nur GET auf diese Hosts und nur die gepinnte Revision anfragt.
3. **Prüfen** (21.10.2026 erledigt): `curl -sI https://bbzb-social-studio.pages.dev/` liefert `200` mit `content-security-policy` (`connect-src 'self'`), `x-content-type-options: nosniff`, `referrer-policy: no-referrer` und `permissions-policy`. Schriftdateien aus `dist/assets/` liefern `200` mit `font/ttf` bzw. `font/otf`. Im Live-Test in Edge (Projekt, Foto, Text, ZIP-Export) gingen nur GET-Requests an die eigene Herkunft raus.

## Deploy später
Vorerst manuell mit `npm run deploy` (Typecheck, Lint, Tests, e2e, Build, wrangler). Der Build läuft im Production-Modus, also ohne Test-Hook. Ein automatisches Deploy per GitHub Actions braucht ein API-Token als Repo-Secret (`CLOUDFLARE_API_TOKEN`, Rechte «Pages: Edit»). Das richtet Alexej ein, wenn es gewünscht ist.

## Lizenzen gebündelter Bibliotheken
Der Build entfernt Lizenzkommentare. Deshalb liegen die Texte unter `public/licenses/` (ausgeliefert als `/licenses/*.txt`): Tabler (MIT), heic-to mit libheif und libde265 (LGPL-3.0, dazu der GPL-3.0-Text), mediabunny (MPL-2.0), transformers.js (Apache-2.0), onnxruntime-web (MIT, Text aus dem Repo microsoft/onnxruntime, das npm-Paket hat keinen) und das Modell ISNet (Hinweise und Apache-2.0-Text von xuebinqin/DIS). Der Dialog «Lizenzen» (Startseite und Projekteinstellungen, `src/ui/LicensesDialog.tsx`) nennt Lizenz, Quelle und Copyright. Bei einem Versionswechsel von heic-to, mediabunny oder transformers.js: Texte aus `node_modules/<paket>/LICENSE` neu kopieren, Versionen und die libheif/libde265-Version (README von heic-to) im Dialog nachziehen. heic-to bleibt unverändert als eigener Chunk, so genügt der Quellhinweis.
