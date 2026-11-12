/**
 * Pure planning for the Sample Workspace. Given a snapshot of what already
 * exists on the site, decide what to create (or delete) next.
 *
 * Safety rule: Precedent only ever writes into, or deletes, a space/project it
 * created itself (marked with the `precedent-sample` property). A same-key
 * space or project that a human created blocks seeding and is never removed.
 */
import { type DecisionKey, SAMPLE_DECISIONS, SAMPLE_PROJECT, SAMPLE_PROPOSALS, SAMPLE_SPACE } from './lumenPay';

/** Property key that marks a space or project as created by Precedent. */
export const SAMPLE_MARKER = 'precedent-sample';

export interface Container {
  /** True when the container carries the SAMPLE_MARKER property. */
  readonly isSample: boolean;
}

export interface WorkspaceState {
  readonly space: Container | null;
  readonly decisionTitles: readonly string[];
  readonly project: Container | null;
  readonly proposalSummaries: readonly string[];
}

export type SeedAction =
  | { readonly kind: 'createSpace' }
  | { readonly kind: 'createDecision'; readonly decisionKey: DecisionKey }
  | { readonly kind: 'createProject' }
  | { readonly kind: 'createProposal'; readonly proposalKey: string };

export type RemoveAction = { readonly kind: 'deleteProject' } | { readonly kind: 'deleteSpace' };

export type Plan<A> =
  | { readonly status: 'ready'; readonly actions: readonly A[] }
  | { readonly status: 'blocked'; readonly reason: string };

export type WorkspaceStatus = 'empty' | 'partial' | 'complete' | 'blocked';

export interface WorkspaceSummary {
  readonly status: WorkspaceStatus;
  readonly created: number;
  readonly total: number;
  readonly reason?: string;
}

const TOTAL_ITEMS = 2 + SAMPLE_DECISIONS.length + SAMPLE_PROPOSALS.length;

function foreignContainerReason(state: WorkspaceState): string | undefined {
  if (state.space && !state.space.isSample) {
    return `A Confluence space with key ${SAMPLE_SPACE.key} already exists and was not created by Precedent.`;
  }
  if (state.project && !state.project.isSample) {
    return `A Jira project with key ${SAMPLE_PROJECT.key} already exists and was not created by Precedent.`;
  }
  return undefined;
}

export function computeSeedPlan(state: WorkspaceState): Plan<SeedAction> {
  const reason = foreignContainerReason(state);
  if (reason) return { status: 'blocked', reason };

  const existingTitles = new Set(state.decisionTitles);
  const existingSummaries = new Set(state.proposalSummaries);

  const actions: SeedAction[] = [
    ...(state.space ? [] : [{ kind: 'createSpace' } as const]),
    ...SAMPLE_DECISIONS.filter((d) => !existingTitles.has(d.title)).map(
      (d) => ({ kind: 'createDecision', decisionKey: d.key }) as const
    ),
    ...(state.project ? [] : [{ kind: 'createProject' } as const]),
    ...SAMPLE_PROPOSALS.filter((p) => !existingSummaries.has(p.summary)).map(
      (p) => ({ kind: 'createProposal', proposalKey: p.key }) as const
    ),
  ];

  return { status: 'ready', actions };
}

export function computeRemovePlan(state: WorkspaceState): Plan<RemoveAction> {
  const actions: RemoveAction[] = [
    ...(state.project?.isSample ? [{ kind: 'deleteProject' } as const] : []),
    ...(state.space?.isSample ? [{ kind: 'deleteSpace' } as const] : []),
  ];
  return { status: 'ready', actions };
}

export function summarizeWorkspace(state: WorkspaceState): WorkspaceSummary {
  const plan = computeSeedPlan(state);
  if (plan.status === 'blocked') {
    return { status: 'blocked', created: 0, total: TOTAL_ITEMS, reason: plan.reason };
  }

  const created = TOTAL_ITEMS - plan.actions.length;
  const status: WorkspaceStatus = created === 0 ? 'empty' : created === TOTAL_ITEMS ? 'complete' : 'partial';
  return { status, created, total: TOTAL_ITEMS };
}
