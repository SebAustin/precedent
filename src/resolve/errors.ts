/**
 * Domain errors raised by the Resolution module. Each carries a stable `code`
 * (so an adapter can react to a specific case) and a message that is already
 * safe and friendly enough to show a Viewer as-is.
 */
export type ResolutionErrorCode =
  | 'CannotAccessIssue'
  | 'CannotAccessDecision'
  | 'NotAConflict'
  | 'AlreadyResolved'
  | 'ReasonRequired';

const MESSAGES: Readonly<Record<ResolutionErrorCode, string>> = {
  CannotAccessIssue: "You can't access this issue, so Precedent can't show or change its check.",
  CannotAccessDecision: "You can't access this decision, so you can't resolve it.",
  NotAConflict: 'Only a Conflicts verdict can be resolved.',
  AlreadyResolved: 'This conflict has already been resolved.',
  ReasonRequired: 'Dismissing needs a short reason.',
};

export class ResolutionError extends Error {
  constructor(readonly code: ResolutionErrorCode) {
    super(MESSAGES[code]);
    this.name = 'ResolutionError';
  }
}
