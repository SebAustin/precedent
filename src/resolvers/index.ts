import Resolver from '@forge/resolver';
import { type ProposalEvalResult, SAMPLE_PROPOSAL_KEYS, evaluateSampleProposal } from '../check/sampleEval';
import { checkProposal } from '../check/service';
import { readCheckResult } from '../check/site';
import type { CheckResult } from '../check/types';
import type { WorkspaceSummary } from '../sample/plan';
import { getSampleWorkspace, removeSampleWorkspace, seedNextItem } from '../sample/service';
import { type ResolverResult, attempt } from './result';

export type { ResolverResult } from './result';

interface IssueContext {
  readonly extension?: { readonly issue?: { readonly key?: string } };
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

resolver.define('getCheck', ({ context }): Promise<ResolverResult<CheckResult | null>> =>
  attempt(() => readCheckResult(issueKeyFrom(context as IssueContext)))
);
resolver.define('checkNow', ({ context }): Promise<ResolverResult<CheckResult>> =>
  attempt(() => checkProposal(issueKeyFrom(context as IssueContext), { force: true }))
);

export const handler = resolver.getDefinitions();
