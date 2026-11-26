/**
 * The check pipeline (one Check, GLOSSARY.md):
 *   read issue and Decisions → skip if neither changed → candidate Decisions (no AI)
 *   → Haiku Verdicts with Citations → Sonnet explanation for Conflicts only
 *   → carry forward Lapsed Verdicts → store on the issue.
 *
 * A failed Check leaves the last completed one in place and records only the
 * failure, so the panel can say so and the next event retries.
 */
import { readResolutions } from '../resolve/store';
import { buildConflictComment, conflictsToAnnounce } from './announce';
import { classify, explainConflict } from './llm';
import { acceptedInScope, carryLapsed, decisionsFingerprint, isCurrent, withKnownSuperseded } from './freshness';
import { contentHash } from './proposal';
import { rankCandidates } from './rank';
import {
  announceConflicts,
  clearCheckFailure,
  fetchDecisionRecords,
  fetchProposal,
  getDecisionSpaces,
  readCheckFailure,
  readAnnounced,
  readCheckResult,
  writeCheckFailure,
  writeCheckResult,
} from './site';
import type { CheckResult, CitedVerdict, DecisionRecord, Proposal } from './types';

export interface CheckOptions {
  /** Re-run even if neither the issue text nor the Decisions changed since the last Check. */
  readonly force?: boolean;
  /** A Decision page just marked Superseded, which search may not reflect yet (see withKnownSuperseded). */
  readonly supersededPageId?: string;
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

/** Records which Decision page version each Verdict was judged against. */
function withVersions(verdicts: readonly CitedVerdict[], candidates: readonly DecisionRecord[]): CitedVerdict[] {
  const versions = new Map(candidates.map((c) => [c.pageId, c.version]));
  return verdicts.map((v) => {
    const version = versions.get(v.pageId);
    return version === undefined ? v : { ...v, decisionVersion: version };
  });
}

export async function checkProposal(issueKey: string, options: CheckOptions = {}): Promise<CheckResult> {
  try {
    return await runCheck(issueKey, options);
  } catch (error: unknown) {
    await recordFailure(issueKey);
    throw error;
  }
}

async function runCheck(issueKey: string, options: CheckOptions): Promise<CheckResult> {
  const proposal = await fetchProposal(issueKey);
  const hash = contentHash(proposal);
  const spaces = await getDecisionSpaces();
  const [previous, failure, fetched] = await Promise.all([
    readCheckResult(issueKey),
    readCheckFailure(issueKey),
    fetchDecisionRecords(spaces),
  ]);
  const records = withKnownSuperseded(fetched, options.supersededPageId);
  const fingerprint = decisionsFingerprint(spaces, records);
  // A failure newer than the stored Check means the next event must retry, not reuse the cache.
  const failedSince = failure !== null && (!previous || failure.failedAt > previous.checkedAt);
  if (previous && !options.force && !failedSince && isCurrent(previous, hash, fingerprint)) return previous;

  const candidates = rankCandidates(proposal, records);
  const classified = candidates.length > 0 ? await classify(proposal, candidates) : [];
  const verdicts = withVersions(await withExplanations(proposal, classified, candidates), candidates);

  const judged = new Set(verdicts.map((v) => v.pageId));
  const lapsed = carryLapsed(previous?.verdicts ?? [], records).filter((v) => !judged.has(v.pageId));
  const result: CheckResult = {
    version: 1,
    contentHash: hash,
    checkedAt: new Date().toISOString(),
    candidatesConsidered: candidates.length,
    verdicts: [...verdicts.sort(byImportance), ...lapsed],
    decisionsInScope: acceptedInScope(records),
    decisionsFingerprint: fingerprint,
  };
  await writeCheckResult(issueKey, result);
  await bestEffort(`clearing the failure marker on ${issueKey}`, () => clearCheckFailure(issueKey));
  await announceNewConflicts(issueKey, result);
  return result;
}

/** Marks the latest Check as failed without touching the last completed one. */
async function recordFailure(issueKey: string): Promise<void> {
  await bestEffort(`recording the failed Check on ${issueKey}`, () =>
    writeCheckFailure(issueKey, { failedAt: new Date().toISOString() })
  );
}

async function bestEffort(what: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error: unknown) {
    console.warn(`Precedent: ${what} failed`, error instanceof Error ? error.message : error);
  }
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
