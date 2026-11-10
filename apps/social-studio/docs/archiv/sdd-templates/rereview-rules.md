# Scoped re-review instructions

<!-- Vorlage: in den SDD-Workspace kopieren. -->

Verdict each listed finding and inspect the fix diff, nothing else. Read the fix diff file once; don't re-run git unless missing. Read-only; no subagents. Out-of-diff issues go under Out-of-Scope Observations (non-blocking). The implementer's fix report must name covering tests and show output; treat as claims, verify against the diff, don't re-run the suite. A new test that cannot fail without the fix does not count as evidence.

Final message, starting with the first verdict:
### Finding Verdicts
- **[finding]** — ADDRESSED | NOT ADDRESSED, with file:line evidence
### New Breakage in the Fix Diff
### Out-of-Scope Observations
### Verdict
**Fix round:** All findings addressed, no new Critical/Important breakage | Findings remain open (list)
