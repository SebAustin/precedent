/**
 * Plain-text answers for the Rovo agent. The agent rephrases them, so they are
 * written to be complete and unambiguous rather than pretty.
 */
import type { CitedVerdict, DecisionRecord } from '../check/types';
import type { AnnotatedVerdict, ResolutionView } from '../resolve/resolutions';

/** Absolute links where known: Rovo chat does not resolve site-relative ones. */
const pageLink = (pageId: string, url?: string): string => url ?? `/wiki/pages/viewpage.action?pageId=${pageId}`;

export function formatPrecedents(topic: string, records: readonly DecisionRecord[]): string {
  if (records.length === 0) return `No accepted decisions in the Decision Spaces match "${topic}".`;

  const lines = records.map(({ pageId, decision: d, url }, i) =>
    [
      `${i + 1}. "${d.title}" (${d.status}, decided ${d.decidedOn} by ${d.deciders.join(', ') || 'unknown'})`,
      `   Decision: ${d.statement}`,
      `   Why: ${d.rationale}`,
      `   Link: ${pageLink(pageId, url)}`,
    ].join('\n')
  );
  return `Accepted decisions relevant to "${topic}":\n${lines.join('\n')}`;
}

function describeVerdict(v: AnnotatedVerdict): string {
  const status = v.resolution
    ? ` [${v.resolution.kind === 'Acknowledge' ? 'acknowledged' : 'supersession proposed'}]`
    : '';
  return [
    `- "${v.title}"${status} — decided ${v.decidedOn} by ${v.deciders.join(', ')}`,
    `  Quote: "${v.citation}"`,
    `  ${v.explanation ?? v.reason}`,
    `  Link: ${pageLink(v.pageId, v.url)}`,
  ].join('\n');
}

function describeLapsed(v: AnnotatedVerdict): string {
  const why =
    v.lapsed?.reason === 'Superseded'
      ? `superseded${v.lapsed.supersededBy ? ` by "${v.lapsed.supersededBy}"` : ''}`
      : 'no longer an accepted decision';
  return `- "${v.title}" — ${why}. Link: ${pageLink(v.pageId, v.url)}`;
}

export function formatCheckForAgent(issueKey: string, view: ResolutionView): string {
  const conflicts = view.verdicts.filter((v) => v.verdict === 'Conflicts' && !v.lapsed);
  const related = view.verdicts.filter((v) => v.verdict === 'Related' && !v.lapsed);
  const lapsed = view.verdicts.filter((v) => v.lapsed);
  const hidden =
    view.counts.hidden > 0 ? `\n(${view.counts.hidden} more decision(s) are in spaces you cannot access.)` : '';

  if (conflicts.length === 0 && related.length === 0 && lapsed.length === 0) {
    return `${issueKey} does not conflict with or relate to any accepted decision you can access.${hidden}`;
  }

  const sections = [
    conflicts.length > 0 &&
      `CONFLICTS with accepted decisions:\n${conflicts.map(describeVerdict).join('\n')}\n` +
        'For each open conflict the user can acknowledge it (the work respects the decision), dismiss it (not really a conflict, needs a reason), or propose superseding the decision.',
    related.length > 0 && `RELATED decisions (consistent, useful context):\n${related.map(describeVerdict).join('\n')}`,
    lapsed.length > 0 &&
      `NO LONGER ACCEPTED (earlier conflicts whose decision is no longer a precedent; nothing to resolve):\n${lapsed.map(describeLapsed).join('\n')}`,
  ].filter(Boolean);

  return `Precedent check for ${issueKey}:\n${sections.join('\n\n')}${hidden}`;
}

/** Resolves a Decision title the user typed (or the agent paraphrased) to one Verdict. */
export function findVerdictByTitle<T extends CitedVerdict>(verdicts: readonly T[], title: string): T | undefined {
  const wanted = title.trim().toLowerCase();
  if (wanted.length === 0) return undefined;

  const exact = verdicts.find((v) => v.title.toLowerCase() === wanted);
  if (exact) return exact;

  const partial = verdicts.filter((v) => v.title.toLowerCase().includes(wanted));
  return partial.length === 1 ? partial[0] : undefined;
}
