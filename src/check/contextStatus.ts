/**
 * The lozenge Jira shows next to the "Precedent" label on every issue, so a
 * Conflict is visible without expanding the section.
 */
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

export function contextStatus(counts: StatusCounts): ContextStatus {
  if (!counts.isChecked) return {};
  if (counts.openConflicts > 0) {
    return lozenge(`${counts.openConflicts} conflict${counts.openConflicts > 1 ? 's' : ''}`, 'removed');
  }
  if (counts.resolvedConflicts > 0) return lozenge('Resolved', 'success');
  if (counts.related > 0) return lozenge(`${counts.related} related`, 'inprogress');
  return lozenge('Clear', 'default');
}
