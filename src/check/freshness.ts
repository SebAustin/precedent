/**
 * When is a stored Check still right, and what happens to Verdicts whose
 * Decision stopped being a Precedent? Pure functions — the check pipeline
 * (service.ts) does the I/O. Vocabulary: GLOSSARY.md (Check, Lapsed Verdict).
 */
import { createHash } from 'node:crypto';
import type { CheckResult, CitedVerdict, DecisionRecord } from './types';

/**
 * A hash of everything about the Decision Spaces that a Check depends on:
 * which spaces are chosen, and each Decision's page id, version and status.
 * Sorted, so the order Confluence returns pages in doesn't matter.
 */
export function decisionsFingerprint(spaceKeys: readonly string[], records: readonly DecisionRecord[]): string {
  const spaces = [...spaceKeys].sort().join(',');
  const decisions = records
    .map((r) => `${r.pageId}:${r.version ?? 0}:${r.decision.status}`)
    .sort()
    .join(',');
  return createHash('sha256').update(`${spaces}|${decisions}`).digest('hex');
}

/** A stored Check can be reused only if neither the issue text nor the Decisions changed. */
export function isCurrent(previous: CheckResult | null, contentHash: string, fingerprint: string): boolean {
  return previous !== null && previous.contentHash === contentHash && previous.decisionsFingerprint === fingerprint;
}

export function acceptedInScope(records: readonly DecisionRecord[]): number {
  return records.filter((r) => r.decision.status === 'Accepted').length;
}

/**
 * The previous Check's Conflicts whose Decision is no longer a Precedent,
 * marked as Lapsed Verdicts. They are carried into the new Check so the
 * Resolution recorded on them (above all a Supersede) stays visible. Related
 * Verdicts simply drop: there is nothing to keep about them.
 */
export function carryLapsed(previous: readonly CitedVerdict[], records: readonly DecisionRecord[]): CitedVerdict[] {
  const byId = new Map(records.map((r) => [r.pageId, r]));

  return previous.flatMap((verdict): CitedVerdict[] => {
    if (verdict.verdict !== 'Conflicts') return [];

    const record = byId.get(verdict.pageId);
    // Accepted again (a reverted status change): no longer Lapsed, so it can be judged afresh.
    if (record?.decision.status === 'Accepted') return [];
    if (verdict.lapsed) return [verdict];
    if (record?.decision.status === 'Superseded') {
      const replacement = records.find(
        (r) => r.decision.status === 'Accepted' && r.decision.supersedes === record.decision.title
      );
      return [
        {
          ...verdict,
          lapsed: { reason: 'Superseded', ...(replacement ? { supersededBy: replacement.decision.title } : {}) },
        },
      ];
    }
    return [{ ...verdict, lapsed: { reason: 'NotAPrecedent' } }];
  });
}

/**
 * Confluence search is eventually consistent: right after a Supersession it
 * can still report the old Decision as Accepted. The Supersession trigger
 * knows better, so its re-checks pass the page id it just marked Superseded.
 */
export function withKnownSuperseded(records: DecisionRecord[], supersededPageId: string | undefined): DecisionRecord[] {
  if (!supersededPageId) return records;
  return records.map((r) =>
    r.pageId === supersededPageId && r.decision.status !== 'Superseded'
      ? { ...r, decision: { ...r.decision, status: 'Superseded' } }
      : r
  );
}
