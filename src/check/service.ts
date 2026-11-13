/**
 * The check pipeline:
 *   read issue → skip if text unchanged → candidate Decisions (no AI)
 *   → Haiku Verdicts with Citations → Sonnet explanation for Conflicts only
 *   → store on the issue.
 */
import { readResolutions } from '../resolve/store';
import { buildConflictComment, conflictsToAnnounce } from './announce';
import { classify, explainConflict } from './llm';
import { contentHash } from './proposal';
import { rankCandidates } from './rank';
import {
  announceConflicts,
  fetchDecisionRecords,
  fetchProposal,
  getDecisionSpaces,
  readAnnounced,
  readCheckResult,
  writeCheckResult,
} from './site';
import type { CheckResult, CitedVerdict, DecisionRecord, Proposal } from './types';

export interface CheckOptions {
  /** Re-run even if the issue text has not changed since the last check. */
  readonly force?: boolean;
}

async function withExplanations(
  proposal: Proposal,
  verdicts: readonly CitedVerdict[],
  candidates: readonly DecisionRecord[]
): Promise<CitedVerdict[]> {
  return Promise.all(
    verdicts.map(async (verdict) => {
      if (verdict.verdict !== 'Conflicts') return verdict;
      const record = candidates.find((c) => c.pageId === verdict.pageId);
      const explanation = record ? await explainConflict(proposal, record, verdict) : undefined;
      return explanation ? { ...verdict, explanation } : verdict;
    })
  );
}

/** Conflicts first, then Related; stable within each group. */
function byImportance(a: CitedVerdict, b: CitedVerdict): number {
  return Number(b.verdict === 'Conflicts') - Number(a.verdict === 'Conflicts');
}

export async function checkProposal(issueKey: string, options: CheckOptions = {}): Promise<CheckResult> {
  const proposal = await fetchProposal(issueKey);
  const hash = contentHash(proposal);

  const previous = await readCheckResult(issueKey);
  if (!options.force && previous?.contentHash === hash) return previous;

  const records = await fetchDecisionRecords(await getDecisionSpaces());
  const candidates = rankCandidates(proposal, records);
  const verdicts = candidates.length > 0 ? await classify(proposal, candidates) : [];
  const explained = await withExplanations(proposal, verdicts, candidates);

  const result: CheckResult = {
    version: 1,
    contentHash: hash,
    checkedAt: new Date().toISOString(),
    candidatesConsidered: candidates.length,
    verdicts: [...explained].sort(byImportance),
  };
  await writeCheckResult(issueKey, result);
  await announceNewConflicts(issueKey, result);
  return result;
}

/** One comment per newly found Conflict; failures here never lose the stored Verdicts. */
async function announceNewConflicts(issueKey: string, result: CheckResult): Promise<void> {
  try {
    const [announced, resolutions] = await Promise.all([readAnnounced(issueKey), readResolutions(issueKey)]);
    const fresh = conflictsToAnnounce(result.verdicts, announced, resolutions);
    if (fresh.length > 0) await announceConflicts(issueKey, buildConflictComment(fresh.length), fresh, announced);
  } catch (error: unknown) {
    console.warn(`Precedent: could not announce conflicts on ${issueKey}`, error instanceof Error ? error.message : error);
  }
}
