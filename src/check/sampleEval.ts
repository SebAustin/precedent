/**
 * Runs the real pipeline on one Sample Workspace Proposal and scores it.
 * One Proposal per call keeps each resolver invocation well under the timeout.
 */
import { SAMPLE_DECISIONS, SAMPLE_PROJECT, SAMPLE_PROPOSALS } from '../sample/lumenPay';
import { type ProposalScore, scoreProposal } from './evaluation';
import { checkProposal } from './service';
import { findIssueKeyBySummary } from './site';
import type { CitedVerdict } from './types';

export interface ProposalEvalResult extends ProposalScore {
  readonly proposalKey: string;
  readonly summary: string;
  readonly issueKey: string | null;
  readonly verdicts: readonly Pick<CitedVerdict, 'title' | 'verdict' | 'citation'>[];
}

const KEY_BY_TITLE = new Map(SAMPLE_DECISIONS.map((d) => [d.title, d.key] as const));

export const SAMPLE_PROPOSAL_KEYS: readonly string[] = SAMPLE_PROPOSALS.map((p) => p.key);

export async function evaluateSampleProposal(proposalKey: string): Promise<ProposalEvalResult> {
  const proposal = SAMPLE_PROPOSALS.find((p) => p.key === proposalKey);
  if (!proposal) throw new Error(`Unknown sample Proposal "${proposalKey}"`);

  const issueKey = await findIssueKeyBySummary(SAMPLE_PROJECT.key, proposal.summary);
  if (!issueKey) {
    return {
      proposalKey,
      summary: proposal.summary,
      issueKey: null,
      verdicts: [],
      passed: false,
      missing: ['Sample issue not found — load the Sample Workspace first'],
      unexpected: [],
    };
  }

  const result = await checkProposal(issueKey, { force: true });
  const actual = result.verdicts.map((v) => ({ decisionKey: KEY_BY_TITLE.get(v.title) ?? v.title, verdict: v.verdict }));

  return {
    proposalKey,
    summary: proposal.summary,
    issueKey,
    verdicts: result.verdicts.map(({ title, verdict, citation }) => ({ title, verdict, citation })),
    ...scoreProposal(proposal.expected, actual),
  };
}
