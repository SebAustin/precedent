/**
 * In-memory adapter for the ResolutionSite seam, used by tests. It keeps every
 * write so tests can assert on observable outcomes (what was saved, created,
 * commented, linked), and can be told to fail a named operation.
 */
import type { CheckResult, Proposal } from '../check/types';
import type { Decision } from '../domain/decision';
import { EMPTY_RESOLUTIONS, type ResolutionState } from './resolutions';
import type { DecisionRef, IssueLink, ResolutionSite } from './site';

export interface MemoryDecision {
  readonly ref: DecisionRef;
  /** Whether the Viewer can read it. */
  readonly readable: boolean;
}

export interface MemorySiteSeed {
  readonly viewableIssues?: readonly string[];
  readonly checks?: Readonly<Record<string, CheckResult>>;
  readonly resolutions?: Readonly<Record<string, ResolutionState>>;
  readonly decisions?: readonly MemoryDecision[];
  readonly proposals?: Readonly<Record<string, Proposal>>;
  readonly now?: Date;
}

export type FailableOperation = 'commentOnDecision' | 'linkIssue' | 'createDraft' | 'saveResolutions';

export interface MemorySite extends ResolutionSite {
  readonly saved: Map<string, ResolutionState>;
  readonly drafts: { readonly spaceId: string; readonly decision: Decision; readonly id: string }[];
  readonly comments: { readonly pageId: string; readonly html: string }[];
  readonly links: { readonly issueKey: string; readonly link: IssueLink }[];
  failOn(operation: FailableOperation, error?: Error): void;
}

export function memorySite(seed: MemorySiteSeed = {}): MemorySite {
  const viewable = new Set(seed.viewableIssues ?? []);
  const saved = new Map<string, ResolutionState>(Object.entries(seed.resolutions ?? {}));
  const decisions = new Map((seed.decisions ?? []).map((d) => [d.ref.id, d]));
  const failures = new Map<FailableOperation, Error>();
  const drafts: MemorySite['drafts'] = [];
  const comments: MemorySite['comments'] = [];
  const links: MemorySite['links'] = [];

  const maybeFail = (operation: FailableOperation) => {
    const error = failures.get(operation);
    if (error) throw error;
  };

  return {
    saved,
    drafts,
    comments,
    links,
    failOn: (operation, error = new Error(`${operation} failed`)) => failures.set(operation, error),

    canViewIssue: async (issueKey) => viewable.has(issueKey),
    readRecord: async (issueKey) => ({
      check: seed.checks?.[issueKey] ?? null,
      resolutions: saved.get(issueKey) ?? EMPTY_RESOLUTIONS,
    }),
    saveResolutions: async (issueKey, state) => {
      maybeFail('saveResolutions');
      saved.set(issueKey, state);
    },
    readableDecisionIds: async (pageIds) => new Set(pageIds.filter((id) => decisions.get(id)?.readable)),
    readDecision: async (pageId) => {
      const found = decisions.get(pageId);
      return found?.readable ? found.ref : null;
    },
    readProposal: async (issueKey) => {
      const proposal = seed.proposals?.[issueKey];
      if (!proposal) throw new Error(`No proposal for ${issueKey}`);
      return proposal;
    },
    createDraft: async (spaceId, decision) => {
      maybeFail('createDraft');
      const id = String(9000 + drafts.length);
      drafts.push({ spaceId, decision, id });
      return { id, url: `https://site/wiki/pages/${id}` };
    },
    commentOnDecision: async (pageId, html) => {
      maybeFail('commentOnDecision');
      comments.push({ pageId, html });
    },
    linkIssue: async (issueKey, link) => {
      maybeFail('linkIssue');
      links.push({ issueKey, link });
    },
    now: () => seed.now ?? new Date('2026-11-25T10:00:00.000Z'),
  };
}
