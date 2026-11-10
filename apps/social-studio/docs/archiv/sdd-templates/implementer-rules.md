# Rules for every implementer (BBZB Social Studio, <PHASE>)

<!-- Vorlage: in den SDD-Workspace kopieren, <PHASE>, <BRANCH>, <WORKSPACE> ersetzen. -->

- Repo: the BBZB Social Studio checkout, branch `<BRANCH>` (already checked out). Never switch branches, never push, never deploy.
- Read CLAUDE.md, docs/superpowers/workflow.md and `<WORKSPACE>/constraints.md` (binding).
- Your brief is your requirements; exact values in it are verbatim. Never read the whole plan file. Controller rulings are in `<WORKSPACE>/progress.md`.
- The plan leaves room on purpose: where the brief names a goal and acceptance tests but no exact interface, choose the smallest design that fits the existing registries and patterns, and explain the choice in your report.
- TDD: write the failing test, run it and see it fail for the expected reason, implement, see it pass.
- Before committing, all green: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`. Never weaken or skip a test; adapting a test to newly requested behaviour is allowed and must be named in the report.
- UI: Playwright screenshot in Edge of the changed screen into `<WORKSPACE>/screens/task-N-*.png`, look at it (Read the PNG), describe it. Use `/impeccable` for new UI surfaces. Target devices are weak Windows laptops: no React render or store write per mouse move/scroll frame.
- Exports: open the exported files and compare with docs/reference/layouts/ when the task touches rendering.
- UI text: German, Swiss spelling (ss, never ß), guillemets «…», Du-form, short, never the en dash.
- No hex colour outside src/tokens.ts. Core/store/ui never import from src/plugins/. Files < 400 lines (split e2e specs if needed).
- Code style: single quotes, 2-space indent, as existing files. Don't reformat code you didn't change.
- Smallest complete change; never cut validation, data-loss error handling or accessibility.
- Commit (English message) ending with a blank line and the Co-Authored-By/Claude-Session trailer lines the controller gives you. Never amend.
- You do not dispatch subagents or reviewers.
- If unclear or stuck: report NEEDS_CONTEXT / BLOCKED with specifics.
- Self-review your diff before reporting.
- Write the full report to the report file named in your dispatch: what you built, design choices, tests and results, TDD evidence (RED and GREEN command + verbatim key output), files changed, tests adapted and why, self-review, concerns. Then reply with ONLY (<15 lines): Status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT), commits, one-line test summary, concerns, report path.
- If resumed with review findings: fix, re-run covering tests, append a fix report, new commit, same short reply.
