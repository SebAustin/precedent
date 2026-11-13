import Resolver from '@forge/resolver';
import { type ProposalEvalResult, SAMPLE_PROPOSAL_KEYS, evaluateSampleProposal } from '../check/sampleEval';
import { checkProposal } from '../check/service';
import { type PanelState, type ResolveRequest, getPanelState, resolveConflict } from '../resolve/service';
import type { WorkspaceSummary } from '../sample/plan';
import { getSampleWorkspace, removeSampleWorkspace, seedNextItem } from '../sample/service';
import { type ResolverResult, attempt } from './result';

export type { ResolverResult } from './result';

interface IssueContext {
  readonly accountId?: string;
  readonly extension?: { readonly issue?: { readonly key?: string } };
}

const RESOLUTION_KINDS: readonly string[] = ['Acknowledge', 'Dismiss', 'Supersede'];

/** Validates the untrusted resolver payload at the boundary. */
function toResolveRequest(payload: unknown): ResolveRequest {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (typeof p.kind !== 'string' || !RESOLUTION_KINDS.includes(p.kind)) throw new Error('Unknown resolution.');
  if (typeof p.pageId !== 'string' || !/^\d+$/.test(p.pageId)) throw new Error('Invalid decision reference.');
  const note = typeof p.note === 'string' ? p.note.slice(0, 500) : undefined;
  return { kind: p.kind as ResolveRequest['kind'], pageId: p.pageId, ...(note ? { note } : {}) };
}

function issueKeyFrom(context: IssueContext): string {
  const key = context.extension?.issue?.key;
  if (!key) throw new Error('This view is not attached to an issue.');
  return key;
}

const resolver = new Resolver();

/* ---------- Sample Workspace (admin page) ---------- */

resolver.define('getSampleWorkspace', (): Promise<ResolverResult<WorkspaceSummary>> => attempt(getSampleWorkspace));
resolver.define('seedSampleStep', (): Promise<ResolverResult<WorkspaceSummary>> => attempt(seedNextItem));
resolver.define('removeSampleWorkspace', (): Promise<ResolverResult<WorkspaceSummary>> =>
  attempt(removeSampleWorkspace)
);

/* ---------- Verdict eval (admin page) ---------- */

resolver.define('listEvalProposals', (): Promise<ResolverResult<readonly string[]>> =>
  attempt(async () => SAMPLE_PROPOSAL_KEYS)
);
resolver.define('evalSampleProposal', ({ payload }): Promise<ResolverResult<ProposalEvalResult>> =>
  attempt(() => evaluateSampleProposal(String((payload as { proposalKey?: unknown }).proposalKey)))
);

/* ---------- Issue context panel ---------- */

resolver.define('getPanel', ({ context }): Promise<ResolverResult<PanelState>> =>
  attempt(() => getPanelState(issueKeyFrom(context as IssueContext)))
);
resolver.define('checkNow', ({ context }): Promise<ResolverResult<PanelState>> =>
  attempt(async () => {
    const issueKey = issueKeyFrom(context as IssueContext);
    await checkProposal(issueKey, { force: true });
    return getPanelState(issueKey);
  })
);
resolver.define('resolveConflict', ({ context, payload }): Promise<ResolverResult<PanelState>> =>
  attempt(() => {
    const ctx = context as IssueContext;
    if (!ctx.accountId) throw new Error('You need to be signed in to resolve a conflict.');
    return resolveConflict(issueKeyFrom(ctx), ctx.accountId, toResolveRequest(payload));
  })
);

export const handler = resolver.getDefinitions();
