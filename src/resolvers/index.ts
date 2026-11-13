import Resolver from '@forge/resolver';
import { type ProposalEvalResult, SAMPLE_PROPOSAL_KEYS, evaluateSampleProposal } from '../check/sampleEval';
import { checkProposal } from '../check/service';
import { type PanelState, type ResolveRequest, getPanelState, resolveConflict } from '../resolve/service';
import { assertAdminCall } from '../security/admin';
import { type DecisionSpaceSettings, getDecisionSpaceSettings, saveDecisionSpaces } from '../settings/store';
import type { WorkspaceSummary } from '../sample/plan';
import { getSampleWorkspace, removeSampleWorkspace, seedNextItem } from '../sample/service';
import { type ResolverResult, attempt } from './result';

export type { ResolverResult } from './result';

interface IssueContext {
  readonly moduleKey?: string;
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

/** Runs admin-page work only for Jira admins calling from the admin page. */
function adminOnly<T>(context: unknown, work: () => Promise<T>): Promise<ResolverResult<T>> {
  return attempt(async () => {
    await assertAdminCall(context as IssueContext);
    return work();
  });
}

/* ---------- Sample Workspace (admin page) ---------- */

resolver.define('getSampleWorkspace', ({ context }): Promise<ResolverResult<WorkspaceSummary>> =>
  adminOnly(context, getSampleWorkspace)
);
resolver.define('seedSampleStep', ({ context }): Promise<ResolverResult<WorkspaceSummary>> =>
  adminOnly(context, seedNextItem)
);
resolver.define('removeSampleWorkspace', ({ context }): Promise<ResolverResult<WorkspaceSummary>> =>
  adminOnly(context, removeSampleWorkspace)
);

/* ---------- Verdict eval (admin page) ---------- */

resolver.define('listEvalProposals', ({ context }): Promise<ResolverResult<readonly string[]>> =>
  adminOnly(context, async () => SAMPLE_PROPOSAL_KEYS)
);
resolver.define('evalSampleProposal', ({ context, payload }): Promise<ResolverResult<ProposalEvalResult>> =>
  adminOnly(context, () => evaluateSampleProposal(String((payload as { proposalKey?: unknown }).proposalKey)))
);

/* ---------- Decision Spaces settings (admin page) ---------- */

resolver.define('getDecisionSpaceSettings', ({ context }): Promise<ResolverResult<DecisionSpaceSettings>> =>
  adminOnly(context, getDecisionSpaceSettings)
);
resolver.define('saveDecisionSpaces', ({ context, payload }): Promise<ResolverResult<DecisionSpaceSettings>> =>
  adminOnly(context, async () => {
    await saveDecisionSpaces((payload as { spaceKeys?: unknown }).spaceKeys);
    return getDecisionSpaceSettings();
  })
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
