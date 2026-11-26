# Judge polish (Codegeist 2026, before Dec 22)

Agreed in the grilling session on 2026-11-26. Vocabulary: GLOSSARY.md (new terms: **Check**, **Lapsed Verdict**).

## Goal
Raise the judging score with changes a judge can reach on a fresh install, in ~6–8 h. The demo video is frozen: UI changes are additive only.

## Scope
- A. Lapsed Verdicts, re-check on Supersession, edited-Decision notice — `issues/01-lapsed-verdicts.md`
- B. A failed Check never replaces the last completed one — `issues/02-failed-checks.md`
- C. Rovo `check-proposal` can re-check; absolute links — `issues/03-rovo-recheck.md`
- D. Supersession needs a rewritten draft and a real Decision — `issues/04-supersession-guards.md`
- E. Decisions-in-scope count and the no-Decisions state — `issues/05-empty-states.md`
- Copy fixes — `issues/06-copy-fixes.md`

## Out of scope
Everything in `.scratch/post-hackathon/`, `rovo:mcp`, a video re-render.

## Release
TDD for each issue. Deploy to development, smoke test on the Sample Workspace, then one production deploy confirmed by the user.
