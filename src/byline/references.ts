/**
 * The reverse view: from a Decision page, which issues conflicted with it,
 * how each conflict was resolved, and which issues merely relate to it.
 */
import type { ShownVerdict } from '../check/types';
import type { ResolutionKind } from '../resolve/resolutions';

export interface IssueReference {
  readonly key: string;
  readonly summary: string;
  readonly status: string;
  readonly kind: ShownVerdict;
  readonly resolution?: ResolutionKind;
}

export interface ReferenceGroups {
  readonly open: readonly IssueReference[];
  readonly acknowledged: readonly IssueReference[];
  readonly superseding: readonly IssueReference[];
  readonly dismissed: readonly IssueReference[];
  readonly related: readonly IssueReference[];
}

export function groupReferences(refs: readonly IssueReference[]): ReferenceGroups {
  const conflicts = refs.filter((r) => r.kind === 'Conflicts');
  return {
    open: conflicts.filter((r) => !r.resolution),
    acknowledged: conflicts.filter((r) => r.resolution === 'Acknowledge'),
    superseding: conflicts.filter((r) => r.resolution === 'Supersede'),
    dismissed: conflicts.filter((r) => r.resolution === 'Dismiss'),
    related: refs.filter((r) => r.kind === 'Related'),
  };
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Byline title: a Decision that keeps being challenged is worth noticing. */
export function referencesTitle(conflictCount: number, relatedCount: number): string {
  if (conflictCount > 0) return `Precedent · challenged by ${plural(conflictCount, 'issue')}`;
  if (relatedCount > 0) return `Precedent · ${plural(relatedCount, 'related issue')}`;
  return 'Precedent';
}
