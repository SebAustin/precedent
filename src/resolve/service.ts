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
import {
  EMPTY_RESOLUTIONS,
  type Resolution,
  type ResolutionKind,
  type ResolutionState,
  type VerdictView,
  annotateVerdicts,
  recordResolution,
} from './resolutions';
import { completeSupersession, draftSupersedingDecision } from './supersession';

export const RESOLUTIONS_PROPERTY = 'precedent-resolutions';
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

async function readResolutions(issueKey: string): Promise<ResolutionState> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${RESOLUTIONS_PROPERTY}`);
  if (res.status === 404) return EMPTY_RESOLUTIONS;
  await expectOk(res, `Read resolutions for ${issueKey}`);
  const { value } = (await res.json()) as { value: ResolutionState };
  return value?.version === 1 ? value : EMPTY_RESOLUTIONS;
}

async function writeResolutions(issueKey: string, state: ResolutionState): Promise<void> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${RESOLUTIONS_PROPERTY}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(state),
  });
  await expectOk(res, `Store resolution for ${issueKey}`);
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

export async function getPanelState(issueKey: string): Promise<PanelState> {
  const [check, state] = await Promise.all([readCheckResult(issueKey), readResolutions(issueKey)]);
  return { check, view: annotateVerdicts(check?.verdicts ?? [], state), drafts: draftUrls(state) };
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
