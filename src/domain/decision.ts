/**
 * Domain vocabulary for Decisions. See GLOSSARY.md — names here must match it.
 */

export const DECISION_STATUSES = ['Proposed', 'Accepted', 'Superseded'] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** The Confluence label that marks a page as a Decision. */
export const DECISION_LABEL = 'decision';

/** The structured content of a Decision, as written on its Confluence page. */
export interface Decision {
  readonly title: string;
  readonly statement: string;
  readonly rationale: string;
  readonly deciders: readonly string[];
  /** ISO calendar date, YYYY-MM-DD. */
  readonly decidedOn: string;
  readonly status: DecisionStatus;
  readonly tags: readonly string[];
  /** Title of the Decision this one replaces, when it is part of a Supersession. */
  readonly supersedes?: string;
}

export function isDecisionStatus(value: string): value is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(value);
}
