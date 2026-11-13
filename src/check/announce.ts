/**
 * The one Jira comment Precedent posts when an issue gains a new Conflict.
 *
 * The comment is deliberately vague: anyone who can see the issue sees the
 * comment, but not everyone can read the Decision's Confluence space. Titles
 * and citations stay in the panel, which filters by the viewer's permissions.
 */
import type { ResolutionState } from '../resolve/resolutions';
import type { CitedVerdict } from './types';

export function conflictsToAnnounce(
  verdicts: readonly CitedVerdict[],
  alreadyAnnounced: readonly string[],
  resolutions: ResolutionState
): string[] {
  const announced = new Set(alreadyAnnounced);
  return verdicts
    .filter((v) => v.verdict === 'Conflicts' && !announced.has(v.pageId) && !resolutions.resolutions[v.pageId])
    .map((v) => v.pageId);
}

/** Atlassian Document Format body for the conflict comment. */
export function buildConflictComment(count: number) {
  const what = count === 1 ? 'an accepted decision' : `${count} accepted decisions`;
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'panel',
        attrs: { panelType: 'warning' },
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Precedent: ', marks: [{ type: 'strong' }] },
              {
                type: 'text',
                text: `this work appears to conflict with ${what}. Open the Precedent section of this issue to see the decision and acknowledge it, dismiss the alert, or propose superseding it.`,
              },
            ],
          },
        ],
      },
    ],
  };
}
