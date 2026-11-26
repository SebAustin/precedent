/**
 * Resolutions: a person's recorded response to a Conflicts Verdict
 * (Acknowledge, Dismiss or Supersede — see GLOSSARY.md). Stored on the issue,
 * keyed by the Decision's page id, so they survive re-checks of the issue.
 */
import type { CheckFailure } from '../check/site';
import type { CheckResult, CitedVerdict, Lapse } from '../check/types';
import { ResolutionError } from './errors';
import type { DecisionStanding } from './site';

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
 * resolved, and not once it has Lapsed; a Resolution is final; Dismiss needs a
 * reason (stored trimmed).
 */
export function recordResolution(
  state: ResolutionState,
  currentVerdicts: readonly CitedVerdict[],
  resolution: Resolution
): ResolutionState {
  const verdict = currentVerdicts.find((v) => v.pageId === resolution.pageId);
  if (verdict?.verdict !== 'Conflicts') throw new ResolutionError('NotAConflict');
  if (verdict.lapsed) throw new ResolutionError('DecisionLapsed');
  if (state.resolutions[resolution.pageId]) throw new ResolutionError('AlreadyResolved');
  if (resolution.kind === 'Dismiss' && !resolution.note?.trim()) throw new ResolutionError('ReasonRequired');

  const stored: Resolution = resolution.note ? { ...resolution, note: resolution.note.trim() } : resolution;
  return { ...state, resolutions: { ...state.resolutions, [resolution.pageId]: stored } };
}

export interface AnnotatedVerdict extends CitedVerdict {
  readonly resolution?: Resolution;
  /** The Decision is still a Precedent but was edited after this Verdict was judged. */
  readonly isEdited?: boolean;
  /** Absolute link to the Decision page, when known. */
  readonly url?: string;
}

export interface VerdictCounts {
  readonly open: number;
  readonly resolved: number;
  readonly related: number;
  readonly dismissed: number;
  readonly lapsed: number;
}

/**
 * The one counting rule, shared by the issue panel and the sidebar lozenge:
 * a Conflict with no Resolution is open; Acknowledge/Supersede make it
 * resolved; a dismissed Conflict is neither (only counted as dismissed). A
 * Lapsed Verdict is none of these: its Decision is no longer a Precedent.
 */
export function countVerdicts(verdicts: readonly CitedVerdict[], state: ResolutionState): VerdictCounts {
  const kindOf = (v: CitedVerdict) => state.resolutions[v.pageId]?.kind;
  const live = verdicts.filter((v) => !v.lapsed);
  const conflicts = live.filter((v) => v.verdict === 'Conflicts');
  return {
    open: conflicts.filter((v) => !kindOf(v)).length,
    resolved: conflicts.filter((v) => kindOf(v) && kindOf(v) !== 'Dismiss').length,
    related: live.filter((v) => v.verdict === 'Related').length,
    dismissed: conflicts.filter((v) => kindOf(v) === 'Dismiss').length,
    lapsed: verdicts.filter((v) => v.lapsed).length,
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
  /** When the latest Check failed, if that is newer than the last completed one. */
  readonly failedAt: string | null;
  /** Accepted Decisions in the Decision Spaces at the last Check (null for older Checks). */
  readonly decisionsInScope: number | null;
}

/** A Decision that stopped being Accepted since the Check makes its Verdict Lapsed right away. */
function lapseOf(verdict: CitedVerdict, standing: DecisionStanding): Lapse | undefined {
  // The Decision's current status wins: Accepted again means not Lapsed, whatever the Check stored.
  if (standing.status === 'Accepted') return undefined;
  if (verdict.lapsed) return verdict.lapsed;
  return { reason: standing.status === 'Superseded' ? 'Superseded' : 'NotAPrecedent' };
}

function annotate(verdict: CitedVerdict, standing: DecisionStanding, resolution: Resolution | undefined): AnnotatedVerdict {
  const lapsed = lapseOf(verdict, standing);
  const isEdited = !lapsed && verdict.decisionVersion !== undefined && verdict.decisionVersion !== standing.version;
  const { lapsed: _stored, ...rest } = verdict; // the live standing decides; drop any stored lapse first
  return {
    ...rest,
    ...(lapsed ? { lapsed } : {}),
    ...(verdict.verdict === 'Conflicts' && !lapsed ? { isEdited } : {}),
    ...(standing.url ? { url: standing.url } : {}),
    ...(resolution ? { resolution } : {}),
  };
}

function newerFailure(check: CheckResult | null, failure: CheckFailure | null): string | null {
  if (!failure) return null;
  return !check || failure.failedAt > check.checkedAt ? failure.failedAt : null;
}

export function buildView(
  check: CheckResult | null,
  state: ResolutionState,
  standings: ReadonlyMap<string, DecisionStanding>,
  failure: CheckFailure | null = null
): ResolutionView {
  const all = check?.verdicts ?? [];
  const annotated = all.flatMap((v): AnnotatedVerdict[] => {
    const standing = standings.get(v.pageId);
    return standing ? [annotate(v, standing, state.resolutions[v.pageId])] : [];
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
    counts: { ...countVerdicts(annotated, state), hidden: all.length - annotated.length },
    drafts,
    failedAt: newerFailure(check, failure),
    decisionsInScope: check?.decisionsInScope ?? null,
  };
}
