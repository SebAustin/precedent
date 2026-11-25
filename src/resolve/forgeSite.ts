/**
 * Forge adapter for the ResolutionSite seam: real Jira and Confluence calls.
 * Anything that decides what the Viewer may see or do runs `asUser()`, so
 * Jira's and Confluence's own permissions decide. Those checks fail closed —
 * except NeedsAuthenticationError (the Viewer hasn't clicked "Allow access"
 * yet), which always propagates so Forge can show the consent prompt.
 */
import api, { NeedsAuthenticationError, route } from '@forge/api';
import { fetchProposal, readCheckResult } from '../check/site';
import { commentOnPage, createDecisionPage, expectOk, readDecisionPage } from '../confluence/decisionPages';
import { createResolution } from './resolution';
import type { DecisionRef, IssueLink, ResolutionSite } from './site';
import { readResolutions, writeResolutions } from './store';

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

/** Runs an access probe; any failure means "no access", except the consent error. */
async function failClosed<T>(probe: () => Promise<T>, denied: T): Promise<T> {
  try {
    return await probe();
  } catch (error: unknown) {
    if (error instanceof NeedsAuthenticationError) throw error;
    return denied;
  }
}

/** Which of these Decision pages can the Viewer read? Also used by the Rovo "find precedents" action. */
export async function readableDecisionIds(pageIds: readonly string[]): Promise<ReadonlySet<string>> {
  const checks = await Promise.all(
    pageIds.map((id) =>
      failClosed(async () => {
        const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${id}`);
        return res.ok ? id : null;
      }, null)
    )
  );
  return new Set(checks.filter((id): id is string => id !== null));
}

async function readDecisionAsViewer(pageId: string): Promise<DecisionRef | null> {
  return failClosed(async (): Promise<DecisionRef> => {
    const page = await readDecisionPage('user', pageId);
    return {
      id: page.id,
      title: page.title,
      spaceId: page.spaceId,
      url: page.url,
      decision: page.parsed.ok ? page.parsed.decision : null,
    };
  }, null);
}

/** Adds a link on the issue to a Confluence page (idempotent per globalId). */
async function linkIssue(issueKey: string, link: IssueLink): Promise<void> {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/remotelink`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      globalId: `precedent-decision-${link.pageId}`,
      relationship: 'Precedent decision',
      object: { url: link.url, title: link.title },
    }),
  });
  await expectOk(res, `Link ${issueKey} to "${link.title}"`);
}

export const forgeSite: ResolutionSite = {
  canViewIssue: (issueKey) =>
    failClosed(async () => {
      const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary`);
      return res.ok;
    }, false),
  readRecord: async (issueKey) => {
    const [check, resolutions] = await Promise.all([readCheckResult(issueKey), readResolutions(issueKey)]);
    return { check, resolutions };
  },
  saveResolutions: writeResolutions,
  readableDecisionIds,
  readDecision: readDecisionAsViewer,
  readProposal: fetchProposal,
  createDraft: async (spaceId, decision) => {
    const id = await createDecisionPage('user', spaceId, decision);
    const created = await readDecisionPage('user', id);
    return { id, url: created.url };
  },
  commentOnDecision: (pageId, html) => commentOnPage('user', pageId, html),
  linkIssue,
  now: () => new Date(),
};

/** The Resolution module wired to the real site — what the entry points use. */
export const forgeResolution = createResolution(forgeSite);
