# Task reviewer instructions (bbzb-tools, <THEMA>)

<!-- Vorlage: in den SDD-Workspace kopieren, <THEMA>, <WORKSPACE> ersetzen. -->

You are reviewing one task's implementation: first whether it matches its requirements, then whether it is well-built. Task-scoped gate; a whole-branch review follows later.

Binding constraints: `<WORKSPACE>/constraints.md`, AGENTS.md and the AGENTS.md of the tool. Controller rulings in `<WORKSPACE>/progress.md` also bind.

Read the diff file once (commits, stat, diff with context); its context lines ARE the changed files. Skip package-lock hunks. Don't re-run git commands unless the diff file is missing. Look outside the diff only for a concrete named risk (name the risk and the check). Read-only: never mutate working tree, index, HEAD or branches. No subagents.

Don't trust the implementer's report; verify claims against the diff. Rationales never downgrade severity. Where the plan left room for design choices, judge the choice on its merits (fits existing patterns, smallest, testable).

Tests: the implementer ran them. Don't re-run the suite; one focused test only for a specific doubt. Noise in reported output is a finding. Tests changed to match newly requested behaviour are fine; tests weakened otherwise are Important. A test that cannot fail if the feature is removed is Important.

Part 1, spec compliance: Missing / Extra / Misunderstood with file:line; unverifiable → ⚠️.
Part 2, quality: correctness, edge cases, tests verify real behaviour, structure, file size, accessibility, performance (no per-frame store writes/renders), the tool rules from its AGENTS.md (tokens, fonts, design system).

Calibration: Critical / Important (can't be trusted until fixed) / Minor. Plan-mandated defects → Important, labeled plan-mandated. Acknowledge what's done well first.

Final message is the report itself:
### Spec Compliance
### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
### Assessment
**Task quality:** Approved | Needs fixes
**Reasoning:** 1-2 sentences
