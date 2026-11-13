/**
 * Resolutions: a person's recorded response to a Conflicts Verdict
 * (Acknowledge, Dismiss or Supersede — see GLOSSARY.md). Stored on the issue,
 * keyed by the Decision's page id, so they survive re-checks of the issue.
 */
import type { CitedVerdict } from '../check/types';

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

export function recordResolution(
  state: ResolutionState,
  currentVerdicts: readonly CitedVerdict[],
  resolution: Resolution
): ResolutionState {
  const verdict = currentVerdicts.find((v) => v.pageId === resolution.pageId);
  if (verdict?.verdict !== 'Conflicts') {
    throw new Error('Only a Conflicts verdict can be resolved.');
  }
  if (resolution.kind === 'Dismiss' && !resolution.note?.trim()) {
    throw new Error('Dismissing needs a short reason.');
  }

  const stored: Resolution = resolution.note ? { ...resolution, note: resolution.note.trim() } : resolution;
  return { ...state, resolutions: { ...state.resolutions, [resolution.pageId]: stored } };
}

export interface AnnotatedVerdict extends CitedVerdict {
  readonly resolution?: Resolution;
}

export interface VerdictView {
  readonly verdicts: readonly AnnotatedVerdict[];
  readonly openConflicts: number;
  readonly dismissedCount: number;
}

/** Joins Verdicts with their Resolutions; dismissed pairs are never shown again. */
export function annotateVerdicts(verdicts: readonly CitedVerdict[], state: ResolutionState): VerdictView {
  const annotated = verdicts.map((v): AnnotatedVerdict => {
    const resolution = state.resolutions[v.pageId];
    return resolution ? { ...v, resolution } : v;
  });

  const visible = annotated.filter((v) => v.resolution?.kind !== 'Dismiss');
  return {
    verdicts: visible,
    openConflicts: visible.filter((v) => v.verdict === 'Conflicts' && !v.resolution).length,
    dismissedCount: annotated.length - visible.length,
  };
}
