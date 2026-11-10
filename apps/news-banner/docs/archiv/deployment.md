# Deployment: Cloudflare Pages

Nur `dist/` wird hochgeladen. Projekt `bbzb-news-banner` (Production-Branch `main`), öffentlich, ohne Cloudflare Access. Konto wie beim Social Studio (`npx wrangler whoami`, Account-ID in `../bbzb-social-studio/docs/deployment.md`).

- Deploy: `npm run deploy` (Typecheck, Lint, Unit, e2e, Build, wrangler). Das Schulnetz blockiert wrangler: von daheim oder per Hotspot.
- **Live seit 04.11.2026:** https://bbzb-news-banner.pages.dev. Das Projekt wurde per API angelegt (`POST /accounts/<id>/pages/projects` mit `{"name":"bbzb-news-banner","production_branch":"main"}`).
- **Nie `wrangler pages project create` ausführen:** wrangler 4.157 startet dann eine Autokonfiguration, ändert `package.json`, `vite.config.ts`, `.gitignore`, legt `wrangler.jsonc` an und veröffentlicht einen Worker statt Pages. Bleibt `.wrangler/deploy/config.json` übrig, scheitert jedes Deploy: Ordner `.wrangler` löschen. Die Ausgabe ruft dazu auf, künftig `wrangler deploy` zu nutzen: nicht befolgen, hier gilt `npm run deploy`.
- Header stehen in `public/_headers` (strenge CSP, keine fremden Hosts). Nach jedem Deploy: `curl -sI https://bbzb-news-banner.pages.dev/` und `content-security-policy` prüfen.
- Lizenztexte liegen in `public/licenses/`. Bei neuer Version von lucide oder @tabler/icons die Texte aus `node_modules/<paket>/LICENSE` neu kopieren.
