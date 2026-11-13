/**
 * Applies Resolutions chosen in the issue panel, and completes Supersessions
 * when a replacement Decision is Accepted in Confluence.
 */
import api, { route } from '@forge/api';
import { fetchProposal, readCheckResult } from '../check/site';
import type { CheckResult } from '../check/types';
import {
  commentOnPage,
  createDecisionPage,
  expectOk,
  findDecisionPageIdByTitle,
  readDecisionPage,
  setDecisionStatus,
} from '../confluence/decisionPages';
import { readResolutions, writeResolutions } from './store';
import {
  type Resolution,
  type ResolutionKind,
  type ResolutionState,
  type VerdictView,
  annotateVerdicts,
  recordResolution,
} from './resolutions';
import { completeSupersession, draftSupersedingDecision } from './supersession';

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export interface PanelState {
  readonly check: CheckResult | null;
  readonly view: VerdictView;
  readonly drafts: Readonly<Record<string, string | undefined>>;
}

export interface ResolveRequest {
  readonly kind: ResolutionKind;
  readonly pageId: string;
  readonly note?: string;
}

/** Adds a link on the issue to a Confluence page (idempotent per globalId). */
async function linkIssueToPage(issueKey: string, pageId: string, title: string, url: string | undefined) {
  if (!url) return;
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/remotelink`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      globalId: `precedent-decision-${pageId}`,
      relationship: 'Precedent decision',
      object: { url, title },
    }),
  });
  await expectOk(res, `Link ${issueKey} to "${title}"`);
}

function draftUrls(state: ResolutionState): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.values(state.resolutions)
      .filter((r) => r.draftPageId)
      .map((r) => [r.pageId, `/wiki/pages/viewpage.action?pageId=${r.draftPageId}`])
  );
}

/**
 * Which of these Decision pages can the *viewer* read? Checks run as the user,
 * so Confluence's own permissions decide. Any failure counts as unreadable
 * (fail closed): a Precedent is never shown to someone who can't open it.
 */
export async function readablePageIds(pageIds: readonly string[]): Promise<Set<string>> {
  const checks = await Promise.all(
    pageIds.map(async (id) => {
      try {
        const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${id}`);
        return res.ok ? id : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(checks.filter((id): id is string => id !== null));
}

export async function getPanelState(issueKey: string): Promise<PanelState> {
  const [check, state] = await Promise.all([readCheckResult(issueKey), readResolutions(issueKey)]);
  const verdicts = check?.verdicts ?? [];
  const readable = await readablePageIds([...new Set(verdicts.map((v) => v.pageId))]);
  return { check, view: annotateVerdicts(verdicts, state, readable), drafts: draftUrls(state) };
}

async function supersede(issueKey: string, pageId: string): Promise<string> {
  const old = await readDecisionPage('user', pageId);
  if (!old.parsed.ok) throw new Error(`"${old.title}" is not a well-formed Decision page.`);

  const proposal = await fetchProposal(issueKey);
  const draft = draftSupersedingDecision(old.parsed.decision, proposal, new Date().toISOString().slice(0, 10));
  const draftPageId = await createDecisionPage('user', old.spaceId, draft);

  await commentOnPage(
    'user',
    pageId,
    `<p><strong>Precedent:</strong> ${issueKey} proposes superseding this decision. A Proposed replacement was drafted: ` +
      `<ac:link><ri:page ri:content-title="${draft.title.replace(/"/g, '&quot;')}" /></ac:link>. ` +
      'This decision stays Accepted until the replacement is set to Accepted.</p>'
  );
  const created = await readDecisionPage('user', draftPageId);
  await linkIssueToPage(issueKey, draftPageId, draft.title, created.url);
  return draftPageId;
}

export async function resolveConflict(issueKey: string, accountId: string, request: ResolveRequest): Promise<PanelState> {
  const [check, state] = await Promise.all([readCheckResult(issueKey), readResolutions(issueKey)]);
  const base: Resolution = { kind: request.kind, pageId: request.pageId, accountId, at: new Date().toISOString() };
  const withNote: Resolution = request.note ? { ...base, note: request.note } : base;

  // Validate before any side effect, so a rejected request changes nothing.
  recordResolution(state, check?.verdicts ?? [], withNote);

  let resolution = withNote;
  if (request.kind === 'Acknowledge') {
    const page = await readDecisionPage('user', request.pageId);
    await linkIssueToPage(issueKey, page.id, page.title, page.url);
  } else if (request.kind === 'Supersede') {
    resolution = { ...withNote, draftPageId: await supersede(issueKey, request.pageId) };
  }

  await writeResolutions(issueKey, recordResolution(state, check?.verdicts ?? [], resolution));
  return getPanelState(issueKey);
}

/** Confluence trigger: when a replacement is Accepted, mark the Decision it supersedes as Superseded. */
export async function onDecisionPageUpdated(event: { content?: { id?: string | number } }): Promise<void> {
  const pageId = event.content?.id;
  if (pageId === undefined) return;

  try {
    const replacement = await readDecisionPage('app', String(pageId));
    if (!replacement.parsed.ok || !replacement.parsed.decision.supersedes) return;

    const oldId = await findDecisionPageIdByTitle('app', replacement.spaceId, replacement.parsed.decision.supersedes);
    if (!oldId) return;

    const old = await readDecisionPage('app', oldId);
    if (!old.parsed.ok) return;
    if (!completeSupersession(replacement.parsed.decision, old.parsed.decision)) return;

    await setDecisionStatus('app', old, 'Superseded', `Superseded by "${replacement.title}" (Precedent)`);
    console.info(`Precedent: "${old.title}" is now Superseded by "${replacement.title}"`);
  } catch (error: unknown) {
    console.error('Precedent: supersession completion failed', error instanceof Error ? error.message : error);
  }
}
