/**
 * The lozenge Jira shows next to the "Precedent" label on every issue, so a
 * Conflict is visible without expanding the section.
 */
import type { ResolutionState } from '../resolve/resolutions';
import type { CheckResult } from './types';

export interface StatusCounts {
  readonly openConflicts: number;
  readonly resolvedConflicts: number;
  readonly related: number;
  readonly isChecked: boolean;
}

type LozengeType = 'default' | 'inprogress' | 'moved' | 'new' | 'removed' | 'success';

export interface ContextStatus {
  readonly status?: { readonly type: 'lozenge'; readonly value: { readonly label: string; readonly type: LozengeType } };
}

const lozenge = (label: string, type: LozengeType): ContextStatus => ({ status: { type: 'lozenge', value: { label, type } } });

/**
 * Turns the stored check and its Resolutions into lozenge counts.
 * - A Conflict with no Resolution is open; Acknowledge/Supersede make it resolved.
 * - A dismissed Conflict ("Not a conflict") counts as neither, so it can't turn
 *   the lozenge red or green.
 * - Resolutions are only consulted for Conflicts in the latest check; stale ones
 *   for Decisions no longer flagged are ignored.
 */
export function statusCounts(check: CheckResult | null, state: ResolutionState): StatusCounts {
  const verdicts = check?.verdicts ?? [];
  const conflicts = verdicts.filter((v) => v.verdict === 'Conflicts' && state.resolutions[v.pageId]?.kind !== 'Dismiss');
  const resolvedConflicts = conflicts.filter((v) => state.resolutions[v.pageId] !== undefined).length;
  return {
    isChecked: check !== null,
    openConflicts: conflicts.length - resolvedConflicts,
    resolvedConflicts,
    related: verdicts.filter((v) => v.verdict === 'Related').length,
  };
}

export function contextStatus(counts: StatusCounts): ContextStatus {
  if (!counts.isChecked) return {};
  if (counts.openConflicts > 0) {
    return lozenge(`${counts.openConflicts} conflict${counts.openConflicts > 1 ? 's' : ''}`, 'removed');
  }
  if (counts.resolvedConflicts > 0) return lozenge('Resolved', 'success');
  if (counts.related > 0) return lozenge(`${counts.related} related`, 'inprogress');
  return lozenge('Clear', 'default');
}
