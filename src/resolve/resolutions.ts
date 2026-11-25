/**
 * Resolutions: a person's recorded response to a Conflicts Verdict
 * (Acknowledge, Dismiss or Supersede — see GLOSSARY.md). Stored on the issue,
 * keyed by the Decision's page id, so they survive re-checks of the issue.
 */
import type { CheckResult, CitedVerdict } from '../check/types';
import { ResolutionError } from './errors';

export type ResolutionKind = 'Acknowledge' | 'Dismiss' | 'Supersede';

export interface Resolution {
  readonly kind: ResolutionKind;
  readonly pageId: string;
  readonly accountId: string;
  readonly at: string;
  /** Why a Conflict was dismissed (required for Dismiss). */
  readonly note?: string;
  /** The Proposed Decision page drafted by a Supersede. */
  readonly draftPageId?: string;
}

export interface ResolutionState {
  readonly version: 1;
  readonly resolutions: Readonly<Record<string, Resolution>>;
}

export const EMPTY_RESOLUTIONS: ResolutionState = { version: 1, resolutions: {} };

/**
 * Validates and records one Resolution, returning a new state (the input is
 * never mutated). Rules: only a Conflicts Verdict of the current check can be
 * resolved; a Resolution is final; Dismiss needs a reason (stored trimmed).
 */
export function recordResolution(
  state: ResolutionState,
  currentVerdicts: readonly CitedVerdict[],
  resolution: Resolution
): ResolutionState {
  const verdict = currentVerdicts.find((v) => v.pageId === resolution.pageId);
  if (verdict?.verdict !== 'Conflicts') throw new ResolutionError('NotAConflict');
  if (state.resolutions[resolution.pageId]) throw new ResolutionError('AlreadyResolved');
  if (resolution.kind === 'Dismiss' && !resolution.note?.trim()) throw new ResolutionError('ReasonRequired');

  const stored: Resolution = resolution.note ? { ...resolution, note: resolution.note.trim() } : resolution;
  return { ...state, resolutions: { ...state.resolutions, [resolution.pageId]: stored } };
}

export interface AnnotatedVerdict extends CitedVerdict {
  readonly resolution?: Resolution;
}

export interface VerdictCounts {
  readonly open: number;
  readonly resolved: number;
  readonly related: number;
  readonly dismissed: number;
}

/**
 * The one counting rule, shared by the issue panel and the sidebar lozenge:
 * a Conflict with no Resolution is open; Acknowledge/Supersede make it
 * resolved; a dismissed Conflict is neither (only counted as dismissed).
 */
export function countVerdicts(verdicts: readonly CitedVerdict[], state: ResolutionState): VerdictCounts {
  const kindOf = (v: CitedVerdict) => state.resolutions[v.pageId]?.kind;
  const conflicts = verdicts.filter((v) => v.verdict === 'Conflicts');
  return {
    open: conflicts.filter((v) => !kindOf(v)).length,
    resolved: conflicts.filter((v) => kindOf(v) && kindOf(v) !== 'Dismiss').length,
    related: verdicts.filter((v) => v.verdict === 'Related').length,
    dismissed: conflicts.filter((v) => kindOf(v) === 'Dismiss').length,
  };
}

/** What a Viewer may see of an issue's check. Never contains Decisions they can't read. */
export interface ResolutionView {
  readonly isChecked: boolean;
  readonly checkedAt: string | null;
  /** Readable, non-dismissed Verdicts, each with its Resolution if any. */
  readonly verdicts: readonly AnnotatedVerdict[];
  readonly counts: VerdictCounts & { readonly hidden: number };
  /** Draft replacement Decision links, by the superseded Decision's page id. */
  readonly drafts: Readonly<Record<string, string>>;
}

export function buildView(check: CheckResult | null, state: ResolutionState, readable: ReadonlySet<string>): ResolutionView {
  const all = check?.verdicts ?? [];
  const visible = all.filter((v) => readable.has(v.pageId));
  const annotated = visible.map((v): AnnotatedVerdict => {
    const resolution = state.resolutions[v.pageId];
    return resolution ? { ...v, resolution } : v;
  });
  const drafts = Object.fromEntries(
    annotated
      .filter((v) => v.resolution?.draftPageId)
      .map((v) => [v.pageId, `/wiki/pages/viewpage.action?pageId=${v.resolution?.draftPageId}`])
  );
  return {
    isChecked: check !== null,
    checkedAt: check?.checkedAt ?? null,
    verdicts: annotated.filter((v) => v.resolution?.kind !== 'Dismiss'),
    counts: { ...countVerdicts(visible, state), hidden: all.length - visible.length },
    drafts,
  };
}
