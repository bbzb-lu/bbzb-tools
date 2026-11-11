# Deployment: Cloudflare Pages

Projekt `bbzb-tools` (Production-Branch `main`), öffentlich, ohne Cloudflare Access. Live: https://bbzb-tools.pages.dev

- Deployt wird nur aus GitHub Actions (`.github/workflows/ci.yml`): Push auf `main`, nachdem die Jobs `test` und `e2e` (Windows, Edge, 3 Runner) grün sind. Nie von Hand.
- e2e läuft auf Windows (Zielplattform), verteilt auf 3 Runner; im PR nur für geänderte Tools (`scripts/e2e-projects.mjs`), bei gemeinsamen Teilen und auf `main` für alle. Auf Windows bekannte Abweichungen sind `test.fixme` mit Issue-Link.
- Secrets im Repo `bbzb-lu/bbzb-tools`: `CLOUDFLARE_API_TOKEN` (Berechtigung «Cloudflare Pages: Edit») und `CLOUDFLARE_ACCOUNT_ID` (Konto des Projekts, steht in `npx wrangler whoami`).
- Das Projekt einmalig per API anlegen: `POST /accounts/<id>/pages/projects` mit `{"name":"bbzb-tools","production_branch":"main"}`.
- **Nie `wrangler pages project create` ausführen:** wrangler startet dann eine Autokonfiguration, ändert Projektdateien, legt `wrangler.jsonc` an und veröffentlicht einen Worker statt Pages. Bleibt `.wrangler/deploy/config.json` übrig, scheitert jedes Deploy: Ordner `.wrangler` löschen. Den Hinweis auf `wrangler deploy` nicht befolgen.
- Header stehen in `_headers` (strenge CSP, keine fremden Hosts). Prüfung nach jedem Deploy: `curl -sI https://bbzb-tools.pages.dev/news-banner/` muss genau eine `content-security-policy` zeigen.
- Das Schulnetz kann wrangler blockieren: lokale Deploys von daheim oder per Hotspot, aber nur im Notfall.

## Schriften

Braveold liegt im privaten Repo `bbzb-lu/bbzb-tools-fonts`. Die CI holt es per `actions/checkout` mit dem Deploy-Key im Secret `FONTS_DEPLOY_KEY` nach `fonts-private/`. Einrichten (Alexej, einmalig):

```sh
ssh-keygen -t ed25519 -N "" -f /tmp/fonts-key -C bbzb-tools-ci
gh repo deploy-key add /tmp/fonts-key.pub --repo bbzb-lu/bbzb-tools-fonts --title bbzb-tools-ci
gh secret set FONTS_DEPLOY_KEY --repo bbzb-lu/bbzb-tools < /tmp/fonts-key
rm /tmp/fonts-key /tmp/fonts-key.pub
```

- Ohne Key oder Zugriff scheitert der Checkout, damit scheitern `test`, `e2e` und `deploy`. Pull Requests aus Forks sehen das Secret nicht und scheitern ebenso.
- Vor dem Build prüft `node scripts/fonts.mjs --check`, dass `Braveold-Light.otf` da ist, sonst wird nicht deployt. Nach dem Build prüft `node scripts/check-live-build.mjs`, dass kein Testhaken im Build steckt.
- Lokal holt `npm run fonts` die Schrift. Ohne Zugriff läuft das Studio, exportiert aber ohne Braveold nicht.
- Vorschau: Jeder PR aus diesem Repo bekommt eine eigene Adresse (`<branch>.bbzb-tools.pages.dev`), der Link steht als Kommentar im PR. Die Live-Seite ändert sich erst mit dem Merge. Lokal: `npm run build && npx wrangler pages dev dist`, dann http://localhost:8788.
