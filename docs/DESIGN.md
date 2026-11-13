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
  - The comment is posted by the app and is **deliberately vague** ("conflicts with an accepted decision — open the Precedent section"): every issue viewer sees comments, but not everyone can read the Decision's space. Titles and Citations live only in the permission-filtered panel. Each Conflict is announced once (`precedent-announced` issue property); resolved Conflicts are never announced.
  - Admin-page resolvers (seed, remove, evaluation, settings) share a function with the issue panel, so each one requires the admin-page module context **and** a live Jira-admin permission check.
- Resolutions on Conflicts: **Acknowledge** / **Supersede** / **Dismiss** (stored on the issue with who/when; dismissed pairs never re-raised).
- Supersession: drafts a Proposed Decision linked to the old one, mentions the old decider(s); old becomes Superseded only when a human Accepts the new one.
- Permissions: only Decision Spaces are read; Precedents the viewer can't read are hidden at render (asUser re-check).
- Confluence: "Referenced by" byline on Decision pages. Dynamic title ("Precedent · challenged by N issues"); popup groups issues into open / superseding / acknowledged / dismissed conflicts and related work. Powered by a flat `precedent-index` issue property indexed for JQL (`precedentConflicts`, `precedentRelated` via `jira:entityProperty`); the JQL runs as the viewer.
- Rovo agent: an issue the user *names* always wins over the issue the chat was opened on (Rovo's context is the opening page). Write actions are guarded three times: the agent prompt (explicit request only), Rovo's own "Please review" confirmation, and the same validation as the panel.
- Rovo agent "Precedent" with actions `findPrecedents`, `checkProposal`, `acknowledgeConflict`, `draftSupersession`; stretch: `rovo:mcp` exposing the two read-only actions.
- **Sample Workspace** ("Lumen Pay"): 7 Decisions (6 Accepted, 1 Superseded + its replacement) in Confluence space `LUMENPAY`, 10 Proposals in Jira project `LUMENPAY` with known expected Verdicts (3 Conflicts, 5 Related, 2 None; one trap Proposal must not Conflict with the Superseded Decision). Jira admin page → Precedent: one-click, resumable/idempotent, removable (to trash). Never touches a same-key space/project it didn't create (`precedent-sample` marker property).
  - Judges' first Load shows Forge's "Allow access" consent prompt — mention in testing instructions.
  - Jira project create/delete run `asApp` (needs `manage:jira-configuration`, unavailable to `asUser`) behind an explicit "caller is Jira admin" check; everything else runs `asUser`.

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
