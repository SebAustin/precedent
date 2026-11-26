/**
 * Confluence trigger that completes a Supersession: when a replacement Decision
 * is set to Accepted, the Decision it names in "Supersedes" is marked
 * Superseded. Runs as the app (a trigger has no Viewer). The rules themselves
 * are pure (`completeSupersession`, `isDecisionInScope` in rules.ts); this
 * module only does the I/O.
 *
 * Afterwards it re-checks the issues that conflicted with the old Decision, so
 * they are judged against the replacement instead of keeping a Lapsed Verdict.
 */
import { checkProposal } from '../check/service';
import { findIssuesConflictingWith } from '../check/site';
import { findDecisionPageIdByTitle, readDecisionPage, readPageScope, setDecisionStatus } from '../confluence/decisionPages';
import { getDecisionSpaces } from '../settings/store';
import { completeSupersession, isDecisionInScope } from './rules';

/**
 * Re-checks are LLM calls inside one trigger invocation, and product triggers
 * can't raise Forge's default time limit, so only this many run, in parallel.
 * Any others still show the Lapsed Verdict in the panel (derived from the live
 * page) until their next edit. A queue consumer would lift this (backlog 11).
 */
const MAX_RECHECKS = 3;

export async function onDecisionPageUpdated(event: { content?: { id?: string | number } }): Promise<void> {
  const pageId = event.content?.id;
  if (pageId === undefined) return;

  try {
    const replacement = await readDecisionPage('app', String(pageId));
    if (!replacement.parsed.ok || !replacement.parsed.decision.supersedes) return;

    // Any Confluence page edit fires this trigger: act only on Decisions in a Decision Space.
    const [scope, decisionSpaces] = await Promise.all([
      readPageScope('app', replacement.id),
      getDecisionSpaces(),
    ]);
    if (!isDecisionInScope(scope.labels, scope.spaceKey, decisionSpaces)) return;

    const oldId = await findDecisionPageIdByTitle('app', replacement.spaceId, replacement.parsed.decision.supersedes);
    if (!oldId) return;

    const old = await readDecisionPage('app', oldId);
    if (!old.parsed.ok) return;
    if (!completeSupersession(replacement.parsed.decision, old.parsed.decision)) return;

    await setDecisionStatus('app', old, 'Superseded', `Superseded by "${replacement.title}" (Precedent)`);
    console.info(`Precedent: "${old.title}" is now Superseded by "${replacement.title}"`);
    await recheckIssuesConflictingWith(oldId);
  } catch (error: unknown) {
    console.error('Precedent: supersession completion failed', error instanceof Error ? error.message : error);
  }
}

/** Best effort: a failed re-check is recorded on that issue as a failed Check and retried on its next edit. */
async function recheckIssuesConflictingWith(oldId: string): Promise<void> {
  const issueKeys = await findIssuesConflictingWith(oldId, MAX_RECHECKS);
  const results = await Promise.allSettled(issueKeys.map((key) => checkProposal(key, { supersededPageId: oldId })));
  const failed = results.filter((r) => r.status === 'rejected').length;
  console.info(`Precedent: re-checked ${issueKeys.length - failed}/${issueKeys.length} issue(s) after the Supersession`);
}
