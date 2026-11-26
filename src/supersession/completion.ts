/**
 * Confluence trigger that completes a Supersession: when a replacement Decision
 * is set to Accepted, the Decision it names in "Supersedes" is marked
 * Superseded. Runs as the app (a trigger has no Viewer). The rules themselves
 * are pure (`completeSupersession`, `isDecisionInScope` in rules.ts); this
 * module only does the I/O.
 *
 * Afterwards it re-checks the issues that conflicted with the old Decision, so
 * they are judged against the replacement instead of keeping a Lapsed Verdict.
 *
 * Every page edit on the site fires this trigger, so most runs stop early. The
 * stops that concern a Decision are logged, so a Supersession that didn't
 * complete can be explained from `forge logs`.
 */
import { checkProposal } from '../check/service';
import { findIssuesConflictingWith } from '../check/site';
import { findDecisionPageIdByTitle, readDecisionPage, readSpaceKey, setDecisionStatus } from '../confluence/decisionPages';
import { getDecisionSpaces } from '../settings/store';
import { completeSupersession, isDecisionInScope } from './rules';

/**
 * Re-checks are LLM calls inside one trigger invocation, and product triggers
 * can't raise Forge's default time limit, so only this many run, in parallel.
 * Any others still show the Lapsed Verdict in the panel (derived from the live
 * page) until their next edit. A queue consumer would lift this (backlog 11).
 */
const MAX_RECHECKS = 3;

const skip = (title: string, why: string): void => console.info(`Precedent: "${title}" did not complete a Supersession: ${why}`);

export async function onDecisionPageUpdated(event: { content?: { id?: string | number } }): Promise<void> {
  const pageId = event.content?.id;
  if (pageId === undefined) return;

  try {
    const replacement = await readDecisionPage('app', String(pageId));
    // Not a Decision page, or not part of a Supersession: the common case, not worth a log line.
    if (!replacement.parsed.ok || !replacement.parsed.decision.supersedes) return;
    const { title } = replacement;

    // Any Confluence page edit fires this trigger: act only on Decisions in a Decision Space.
    const [spaceKey, decisionSpaces] = await Promise.all([readSpaceKey('app', replacement.spaceId), getDecisionSpaces()]);
    if (!isDecisionInScope(replacement.labels, spaceKey, decisionSpaces)) {
      return skip(title, `not a labelled Decision in a Decision Space (space ${spaceKey})`);
    }

    const oldId = await findDecisionPageIdByTitle('app', replacement.spaceId, replacement.parsed.decision.supersedes);
    if (!oldId) return skip(title, `no page titled "${replacement.parsed.decision.supersedes}" in its space`);

    const old = await readDecisionPage('app', oldId);
    if (!old.parsed.ok) return skip(title, `"${old.title}" is not a well-formed Decision`);
    if (!completeSupersession(replacement.parsed.decision, old.parsed.decision)) {
      return skip(title, 'not Accepted yet, still a DRAFT, or the original is no longer Accepted');
    }

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
