# apps/sharepoint

Übersicht der SharePoint Embeds unter `/sharepoint/`: Vorschau in Originalgrösse, Einbettungscode, Sortierung. Die Embeds selbst liegen statisch in `embeds/` (eigene `AGENTS.md`), diese App liest nur deren `embed.json` beim Build (`src/embeds.ts`).

- Einbettungscode nimmt `location.origin`, stimmt also auch nach einem Domainwechsel und in der PR-Vorschau.
- Braucht ein Embed eine Erlaubnis im iframe (z. B. Zwischenablage), steht sie in `ERLAUBNIS` in `src/embeds.ts`.
- Die Übersicht selbst ist nicht einbettbar (`_headers`), die Embeds schon (nur SharePoint und diese Seite).
- Tests: `npx playwright test --project sharepoint` (Übersicht und alle Embeds), `npx vitest --project sharepoint run`.
