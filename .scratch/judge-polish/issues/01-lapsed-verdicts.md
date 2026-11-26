# A. Lapsed Verdicts
Status: ready-for-agent

A Verdict whose Decision is no longer a Precedent (Superseded, no longer labelled `decision`, outside every Decision Space) is a **Lapsed Verdict**.

- The panel shows it greyed: "This decision was superseded" (with the replacement's title when known) or "This decision is no longer accepted". It is never counted as open, in the panel or the lozenge, and cannot be resolved.
- Resolutions on it are kept. A Supersede Resolution shows positively: "Superseded by <draft title>".
- When a Supersession completes, re-check each issue that conflicted with the old Decision (JQL `precedentConflicts = <id>`, cap 20).
- Each Verdict records the Decision's page version. If the Decision is still Accepted but its version changed, the panel shows "This decision was edited since the last check · Check again".
- The cache key covers the Decisions in scope (ids and versions), so the next issue edit re-checks against current text.
