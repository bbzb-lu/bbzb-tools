# Deployment: Cloudflare Pages

Projekt `bbzb-tools` (Production-Branch `main`), öffentlich, ohne Cloudflare Access. Live: https://bbzb-tools.pages.dev

- Deployt wird nur aus GitHub Actions (`.github/workflows/ci.yml`): Push auf `main`, nachdem die Jobs `test` und `windows` grün sind. Nie von Hand.
- Secrets im Repo `bbzb-lu/bbzb-tools`: `CLOUDFLARE_API_TOKEN` (Berechtigung «Cloudflare Pages: Edit») und `CLOUDFLARE_ACCOUNT_ID` (Konto des Projekts, steht in `npx wrangler whoami`).
- Das Projekt einmalig per API anlegen: `POST /accounts/<id>/pages/projects` mit `{"name":"bbzb-tools","production_branch":"main"}`.
- **Nie `wrangler pages project create` ausführen:** wrangler startet dann eine Autokonfiguration, ändert Projektdateien, legt `wrangler.jsonc` an und veröffentlicht einen Worker statt Pages. Bleibt `.wrangler/deploy/config.json` übrig, scheitert jedes Deploy: Ordner `.wrangler` löschen. Den Hinweis auf `wrangler deploy` nicht befolgen.
- Header stehen in `_headers` (strenge CSP, keine fremden Hosts). Prüfung nach jedem Deploy: `curl -sI https://bbzb-tools.pages.dev/news-banner/` muss genau eine `content-security-policy` zeigen.
- Das Schulnetz kann wrangler blockieren: lokale Deploys von daheim oder per Hotspot, aber nur im Notfall.
