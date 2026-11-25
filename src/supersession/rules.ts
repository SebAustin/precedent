/**
 * Supersession rules (GLOSSARY.md): Supersede drafts a *Proposed* Decision that
 * names the one it replaces. The old Decision only becomes Superseded when a
 * person sets the replacement to Accepted — Precedent never overrules a human.
 */
import type { Decision } from '../domain/decision';
import type { Proposal } from '../check/types';

export function draftSupersedingDecision(old: Decision, proposal: Proposal, today: string): Decision {
  return {
    title: `Revisit: ${old.title} (${proposal.issueKey})`,
    statement: `DRAFT — rewrite before accepting. Proposed change from ${proposal.issueKey}: ${proposal.summary}`,
    rationale: `Raised by ${proposal.issueKey}. ${proposal.description}`.trim(),
    deciders: [],
    decidedOn: today,
    status: 'Proposed',
    tags: old.tags,
    supersedes: old.title,
  };
}

/**
 * Given an edited Decision and the Decision it names in "Supersedes", returns
 * the old Decision marked Superseded — or null when nothing should change.
 */
export function completeSupersession(replacement: Decision, old: Decision): Decision | null {
  if (replacement.status !== 'Accepted') return null;
  if (replacement.supersedes !== old.title) return null;
  if (old.status !== 'Accepted') return null;
  return { ...old, status: 'Superseded' };
}
