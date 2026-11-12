# Precedent — design brief (Codegeist 2026)

Agreed in the grilling session on 2026-11-12. Vocabulary: see [GLOSSARY.md](../GLOSSARY.md). Key architecture: [ADR 0001](adr/0001-verdicts-via-forge-llm-agent-is-conversational.md), [ADR 0002](adr/0002-teamwork-graph-is-optional-enrichment.md).

## Entry
- Solo, ~10–15 h/week. Category: **Apps for Software Teams**. Primary bonus: **Best Agents (Rovo)**. TWG = optional enrichment. Marketplace go/no-go **Dec 10** (listing kills share links). Submit by **Dec 21**.
- Built clean enough to publish later; MIT, public repo at submission.

## Product
- Precedent checks each **Proposal** (Jira issue summary + description) against **Accepted Decisions** (Confluence pages labelled `decision` in admin-selected **Decision Spaces**) and produces a **Verdict** per pair: Conflicts / Related / None, each shown Verdict carrying a **Citation**.
- Runs automatically on issue create/edit (Forge trigger) plus an on-demand button.
- Pipeline: CQL candidate search + tag/keyword ranking (top ~5) → Haiku Verdict → Sonnet explanation on Conflicts only; content-hash cache.
- Jira: issue context panel (status, Citations, Resolution buttons, "Ask Precedent" opening the Rovo agent); one comment per Conflict.
- Resolutions on Conflicts: **Acknowledge** / **Supersede** / **Dismiss** (stored on the issue with who/when; dismissed pairs never re-raised).
- Supersession: drafts a Proposed Decision linked to the old one, mentions the old decider(s); old becomes Superseded only when a human Accepts the new one.
- Permissions: only Decision Spaces are read; Precedents the viewer can't read are hidden at render (asUser re-check).
- Confluence: "Referenced by" byline on Decision pages (after Jira flow works).
- Rovo agent "Precedent" with actions `findPrecedents`, `checkProposal`, `acknowledgeConflict`, `draftSupersession`; stretch: `rovo:mcp` exposing the two read-only actions.
- **Sample Workspace** ("Lumen Pay"): 6 Decisions (incl. one Superseded) + 10 issues with known expected Verdicts (3 Conflicts, 4 Related, 3 None); one-click, idempotent, removable.

## Stack
- TypeScript, Forge UI Kit (Custom UI only if a screen demands it), runtime `nodejs24.x`, project-local Node 24 (`.nvmrc`) and local `@forge/cli` via `npx forge` (global `forge` is Foundry — don't touch).

## Quality
- TDD + 80% coverage on pure logic (ranking, Decision parsing, Verdict/Citation validation, Resolution state, cache, permission filter).
- Verdict eval over the Sample Workspace: ≥ 8/10 by Nov 26, ≥ 9/10 before recording.
- Manual smoke checklist on a second site via share link; no E2E.

## Milestones
| Week | Done means |
|---|---|
| Nov 13–19 | Toolchain, `forge login`, site provisioned, hello-world deployed, build session, Sample Workspace seeder |
| Nov 20–26 | Trigger → Verdict pipeline (eval ≥ 8/10), issue panel |
| Nov 27–Dec 3 | Resolutions, Conflict comment, Decision Spaces admin, permission filter |
| Dec 4–10 | Rovo agent + actions, Confluence byline, optional TWG enrichment; Marketplace go/no-go |
| Dec 11–16 | Polish, eval ≥ 9/10, share-link test on second site, `rovo:mcp` stretch |
| Dec 17–21 | Video (< 5 min), Devpost write-up, submit |
