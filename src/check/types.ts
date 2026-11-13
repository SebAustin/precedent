/**
 * Types for checking a Proposal against Precedents. Vocabulary: GLOSSARY.md.
 */
import type { Decision } from '../domain/decision';

/** The text of planned work that Precedent checks (v1: a Jira issue). */
export interface Proposal {
  readonly issueKey: string;
  readonly summary: string;
  readonly description: string;
}

/** A Decision together with the Confluence page it lives on. */
export interface DecisionRecord {
  readonly pageId: string;
  readonly decision: Decision;
}

export type ShownVerdict = 'Conflicts' | 'Related';
export type Verdict = ShownVerdict | 'None';

/** A Verdict that passed validation, with its mandatory Citation. */
export interface CitedVerdict {
  readonly pageId: string;
  readonly title: string;
  readonly verdict: ShownVerdict;
  /** Exact words from the Decision statement. */
  readonly citation: string;
  /** One-sentence reason the Verdict applies. */
  readonly reason: string;
  readonly decidedOn: string;
  readonly deciders: readonly string[];
  /** Longer explanation, only written for Conflicts. */
  readonly explanation?: string;
}

/** What Precedent stores on the issue after a check. */
export interface CheckResult {
  readonly version: 1;
  readonly contentHash: string;
  readonly checkedAt: string;
  readonly candidatesConsidered: number;
  readonly verdicts: readonly CitedVerdict[];
}
