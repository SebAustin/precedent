/**
 * The seam behind the Resolution module: every outside operation Resolution
 * needs, and nothing else. Two adapters satisfy it — `forgeSite.ts` (real Jira
 * and Confluence calls, made as the Viewer wherever access matters) and
 * `memorySite.ts` (in-memory, for tests).
 *
 * Contract every adapter must honour:
 * - "As the Viewer" operations fail closed: no access means false / null / not
 *   in the set, never an exception — except Forge's consent error, which must
 *   always propagate so the "Allow access" prompt can appear.
 */
import type { CheckFailure } from '../check/site';
import type { CheckResult, Proposal } from '../check/types';
import type { Decision, DecisionStatus } from '../domain/decision';
import type { ResolutionState } from './resolutions';

/** A Decision page as the Viewer can see it. `decision` is null when the page isn't well-formed. */
export interface DecisionRef {
  readonly id: string;
  readonly title: string;
  readonly spaceId: string;
  readonly url?: string;
  readonly decision: Decision | null;
}

/** What the Viewer can see of a Decision page now: enough to tell a Lapsed or edited Verdict. */
export interface DecisionStanding {
  /** null when the page is no longer a well-formed Decision. */
  readonly status: DecisionStatus | null;
  readonly version: number;
  readonly url?: string;
}

export interface IssueLink {
  readonly pageId: string;
  readonly title: string;
  readonly url: string;
}

export interface ResolutionSite {
  /** Can the Viewer open this issue? */
  canViewIssue(issueKey: string): Promise<boolean>;
  /** The stored Check, its Resolutions and any newer failed Check for an issue (each may be empty). */
  readRecord(issueKey: string): Promise<{
    readonly check: CheckResult | null;
    readonly resolutions: ResolutionState;
    readonly failure: CheckFailure | null;
  }>;
  saveResolutions(issueKey: string, state: ResolutionState): Promise<void>;
  /** The standing of each of these Decision pages the Viewer can read; unreadable ones are absent. */
  readDecisionStandings(pageIds: readonly string[]): Promise<ReadonlyMap<string, DecisionStanding>>;
  /** Reads a Decision page as the Viewer; null when they can't. */
  readDecision(pageId: string): Promise<DecisionRef | null>;
  readProposal(issueKey: string): Promise<Proposal>;
  /** Creates a Decision page as the Viewer. */
  createDraft(spaceId: string, decision: Decision): Promise<{ readonly id: string; readonly url?: string }>;
  commentOnDecision(pageId: string, storageHtml: string): Promise<void>;
  linkIssue(issueKey: string, link: IssueLink): Promise<void>;
  now(): Date;
}
