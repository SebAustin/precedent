import Resolver from '@forge/resolver';
import { type ProposalEvalResult, SAMPLE_PROPOSAL_KEYS, evaluateSampleProposal } from '../check/sampleEval';
import { checkProposal } from '../check/service';
import { forgeResolution } from '../resolve/forgeSite';
import type { ResolveRequest, Viewer } from '../resolve/resolution';
import type { ResolutionView } from '../resolve/resolutions';
import { assertAdminCall } from '../security/admin';
import { type BylineState, getBylineState } from '../byline/service';
import { type DecisionPeople, getDecisionPeople } from '../graph/service';
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

/** The signed-in person using the issue panel. */
function viewerFrom(context: IssueContext): Viewer {
  if (!context.accountId) throw new Error('You need to be signed in to use Precedent.');
  return { accountId: context.accountId };
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

// Thin adapter over the Resolution module: turn the resolver context and
// payload into viewFor / resolve calls. The rules live in the module.
resolver.define('getPanel', ({ context }): Promise<ResolverResult<ResolutionView>> =>
  attempt(() => {
    const ctx = context as IssueContext;
    return forgeResolution.viewFor(issueKeyFrom(ctx), viewerFrom(ctx));
  })
);
resolver.define('checkNow', ({ context }): Promise<ResolverResult<ResolutionView>> =>
  attempt(async () => {
    // The panel only renders for Viewers who can open the issue, so no extra access check before the LLM call.
    const ctx = context as IssueContext;
    const issueKey = issueKeyFrom(ctx);
    await checkProposal(issueKey, { force: true });
    return forgeResolution.viewFor(issueKey, viewerFrom(ctx));
  })
);
resolver.define('resolveConflict', ({ context, payload }): Promise<ResolverResult<ResolutionView>> =>
  attempt(() => {
    const ctx = context as IssueContext;
    return forgeResolution.resolve(issueKeyFrom(ctx), viewerFrom(ctx), toResolveRequest(payload));
  })
);

/* ---------- Teamwork Graph: who knows about a Decision (issue panel) ---------- */

resolver.define('getDecisionPeople', ({ context, payload }): Promise<ResolverResult<DecisionPeople>> =>
  attempt(() => {
    const cloudId = (context as { cloudId?: unknown }).cloudId;
    const pageId = (payload as { pageId?: unknown }).pageId;
    if (typeof cloudId !== 'string' || typeof pageId !== 'string' || !/^\d+$/.test(pageId)) {
      throw new Error('Missing site or decision reference.');
    }
    return getDecisionPeople(cloudId, pageId);
  })
);

/* ---------- Confluence byline on Decision pages ---------- */

resolver.define('getByline', ({ context }): Promise<ResolverResult<BylineState>> =>
  attempt(() => getBylineState((context as { extension?: { content?: { id?: unknown } } }).extension?.content?.id))
);

export const handler = resolver.getDefinitions();
