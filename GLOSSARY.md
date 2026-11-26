# Precedent

Precedent catches work that contradicts or reopens decisions a team has already made, and shows the decision, its rationale and its decider at the moment the work is proposed.

## Decisions

**Decision**:
A Confluence page labelled `decision` that records one choice a team has made: its statement, rationale, decider(s), date, status and topic tags.
_Avoid_: Decision Record (as a separate term), ADR, ruling, agreement

**Decision Status**:
The lifecycle stage of a Decision: exactly one of Proposed, Accepted or Superseded. Only Accepted Decisions are Precedents.
_Avoid_: Rejected, Draft, Deprecated

**Precedent**:
An Accepted Decision that is relevant to a given Proposal.
_Avoid_: Prior art, history

**Negative Decision**:
An Accepted Decision whose statement is a choice *not* to do something (e.g. "We will not adopt MongoDB"). It is an ordinary Accepted Decision, not a separate status.
_Avoid_: Rejected decision

## Checking

**Proposal**:
A piece of planned work that Precedent checks against Precedents. In v1, a Jira issue's summary and description.
_Avoid_: Request, ticket (when meaning the checked content)

**Check**:
One run of Precedent over a Proposal that produces its Verdicts against the current Precedents. A Check either completes or fails; a failed Check never replaces the last completed one.
_Avoid_: Scan, analysis, run

**Verdict**:
Precedent's judgement about one Proposal–Decision pair: exactly one of Conflicts, Related or None.
_Avoid_: Score, match, result

**Conflicts**:
A Verdict meaning the Proposal contradicts or reopens an Accepted Decision.
_Avoid_: Violation, clash

**Related**:
A Verdict meaning the Proposal concerns the same topic as a Decision and is consistent with it.
_Avoid_: Similar, aligned

**Citation**:
The specific Decision statement and one-sentence reason attached to every Conflicts or Related Verdict. A Verdict without a Citation is never shown.
_Avoid_: Evidence, source

**Lapsed Verdict**:
A Verdict whose Decision is no longer a Precedent (Superseded, no longer labelled `decision`, or outside every Decision Space). It is never counted as an open Conflict and cannot be resolved; any Resolution already recorded on it is kept.
_Avoid_: Stale, expired, outdated

**Decision Space**:
A Confluence space an admin has chosen as a source of Decisions. Precedent ignores Decisions outside Decision Spaces.
_Avoid_: Source, repository

**Viewer**:
The person using Precedent at a given moment, in the issue panel or through the Rovo agent. A Viewer only ever sees, and can only resolve, Decisions and issues they themselves can access.
_Avoid_: user, caller, requester

## Resolving

**Resolution**:
A person's recorded response to a Conflicts Verdict: exactly one of Acknowledge, Supersede or Dismiss, with who chose it and when.
_Avoid_: Override, outcome

**Acknowledge**:
The Resolution stating the Proposal respects the Decision (as written or after changes); it links the Proposal to the Decision.
_Avoid_: Accept (reserved for Decision Status), approve

**Dismiss**:
The Resolution stating a Conflicts Verdict was wrong; that Proposal–Decision pair is never raised again.
_Avoid_: Ignore, reject

**Supersede**:
The Resolution stating the team intends to deliberately reverse a Decision; it starts a Supersession.
_Avoid_: Override, replace

**Supersession**:
The link between an existing Decision and a new Proposed Decision meant to replace it. The old Decision becomes Superseded only when a person sets the new one to Accepted.
_Avoid_: Revision, amendment

## Demo

**Sample Workspace**:
A small fictional company's Decisions and Proposals that Precedent can create in an empty site so it can be evaluated without existing data.
_Avoid_: Seed data, demo data, fixtures
