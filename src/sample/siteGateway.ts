/**
 * Thin adapter between the Sample Workspace plan and the Jira/Confluence REST
 * APIs. All calls run as the clicking user (asUser), so product permissions —
 * e.g. only admins can create projects — are enforced by Atlassian, not us.
 */
import api, { route } from '@forge/api';
import { createDecisionPage } from '../confluence/decisionPages';
import { assertCurrentUserIsJiraAdmin } from '../security/admin';
import { SAMPLE_DECISIONS, SAMPLE_PROJECT, SAMPLE_PROPOSALS, SAMPLE_SPACE } from './lumenPay';
import { type RemoveAction, SAMPLE_MARKER, type SeedAction, type WorkspaceState } from './plan';

export interface SiteSnapshot {
  readonly state: WorkspaceState;
  readonly spaceId?: string;
}

const KANBAN_TEMPLATE = 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic';
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };
const MAX_ERROR_BODY = 300;

interface ForgeResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

async function expectOk(response: ForgeResponse, what: string): Promise<void> {
  if (response.ok) return;
  const body = (await response.text()).slice(0, MAX_ERROR_BODY);
  throw new Error(`${what} failed (HTTP ${response.status}): ${body}`);
}

async function readJson<T>(response: ForgeResponse, what: string): Promise<T> {
  await expectOk(response, what);
  return (await response.json()) as T;
}

/* ---------- reads ---------- */

async function findSpace(): Promise<{ id: string; isSample: boolean } | null> {
  const res = await api.asUser().requestConfluence(route`/wiki/api/v2/spaces?keys=${SAMPLE_SPACE.key}`);
  const { results } = await readJson<{ results: { id: string }[] }>(res, 'Look up sample space');
  const space = results[0];
  if (!space) return null;

  const props = await api
    .asUser()
    .requestConfluence(route`/wiki/api/v2/spaces/${space.id}/properties?key=${SAMPLE_MARKER}`);
  const marker = await readJson<{ results: unknown[] }>(props, 'Read sample space marker');
  return { id: space.id, isSample: marker.results.length > 0 };
}

async function listPageTitles(spaceId: string): Promise<string[]> {
  const res = await api.asUser().requestConfluence(route`/wiki/api/v2/spaces/${spaceId}/pages?limit=100`);
  const { results } = await readJson<{ results: { title: string }[] }>(res, 'List sample pages');
  return results.map((page) => page.title);
}

async function findProject(): Promise<{ isSample: boolean } | null> {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${SAMPLE_PROJECT.key}`);
  if (res.status === 404) return null;
  await expectOk(res, 'Look up sample project');

  const marker = await api
    .asUser()
    .requestJira(route`/rest/api/3/project/${SAMPLE_PROJECT.key}/properties/${SAMPLE_MARKER}`);
  if (marker.status !== 404) await expectOk(marker, 'Read sample project marker');
  return { isSample: marker.ok };
}

async function listIssueSummaries(): Promise<string[]> {
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ jql: `project = ${SAMPLE_PROJECT.key}`, fields: ['summary'], maxResults: 100 }),
  });
  const { issues } = await readJson<{ issues: { fields: { summary: string } }[] }>(res, 'List sample issues');
  return issues.map((issue) => issue.fields.summary);
}

export async function readSnapshot(): Promise<SiteSnapshot> {
  const [space, project] = await Promise.all([findSpace(), findProject()]);
  const [decisionTitles, proposalSummaries] = await Promise.all([
    space?.isSample ? listPageTitles(space.id) : Promise.resolve([]),
    project?.isSample ? listIssueSummaries() : Promise.resolve([]),
  ]);

  return {
    spaceId: space?.id,
    state: {
      space: space && { isSample: space.isSample },
      decisionTitles,
      project,
      proposalSummaries,
    },
  };
}

/* ---------- seed writes ---------- */

async function createSpace(): Promise<void> {
  const res = await api.asUser().requestConfluence(route`/wiki/api/v2/spaces`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      key: SAMPLE_SPACE.key,
      name: SAMPLE_SPACE.name,
      description: { value: 'Sample Decisions created by Precedent. Safe to delete.', representation: 'plain' },
    }),
  });
  const { id } = await readJson<{ id: string }>(res, 'Create sample space');

  const marker = await api.asUser().requestConfluence(route`/wiki/api/v2/spaces/${id}/properties`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ key: SAMPLE_MARKER, value: { createdBy: 'precedent' } }),
  });
  await expectOk(marker, 'Mark sample space');
}

async function createDecision(spaceId: string, key: string): Promise<void> {
  const decision = SAMPLE_DECISIONS.find((d) => d.key === key);
  if (!decision) throw new Error(`Unknown sample Decision "${key}"`);
  const { key: _key, ...content } = decision;
  await createDecisionPage('user', spaceId, content);
}

/**
 * Project creation needs `manage:jira-configuration`, which Forge does not
 * grant to user-impersonated (asUser) calls, so it runs asApp — only after
 * confirming the clicking user is a Jira administrator.
 */
async function createProject(): Promise<void> {
  await assertCurrentUserIsJiraAdmin();
  const me = await readJson<{ accountId: string }>(
    await api.asUser().requestJira(route`/rest/api/3/myself`),
    'Read current user'
  );

  const res = await api.asApp().requestJira(route`/rest/api/3/project`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      key: SAMPLE_PROJECT.key,
      name: SAMPLE_PROJECT.name,
      projectTypeKey: 'software',
      projectTemplateKey: KANBAN_TEMPLATE,
      leadAccountId: me.accountId,
      description: 'Sample Proposals created by Precedent. Safe to delete.',
    }),
  });
  await expectOk(res, 'Create sample project');

  const marker = await api
    .asApp()
    .requestJira(route`/rest/api/3/project/${SAMPLE_PROJECT.key}/properties/${SAMPLE_MARKER}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ createdBy: 'precedent' }),
    });
  await expectOk(marker, 'Mark sample project');
}

async function pickIssueTypeId(): Promise<string> {
  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/createmeta/${SAMPLE_PROJECT.key}/issuetypes`);
  const { issueTypes } = await readJson<{ issueTypes: { id: string; name: string; subtask: boolean }[] }>(
    res,
    'Read sample issue types'
  );
  const standard = issueTypes.filter((t) => !t.subtask);
  const chosen = standard.find((t) => t.name === 'Task') ?? standard[0];
  if (!chosen) throw new Error('Sample project has no usable issue type');
  return chosen.id;
}

async function createProposal(key: string): Promise<void> {
  const proposal = SAMPLE_PROPOSALS.find((p) => p.key === key);
  if (!proposal) throw new Error(`Unknown sample Proposal "${key}"`);

  const res = await api.asUser().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      fields: {
        project: { key: SAMPLE_PROJECT.key },
        issuetype: { id: await pickIssueTypeId() },
        summary: proposal.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: proposal.description }] }],
        },
      },
    }),
  });
  await expectOk(res, `Create Proposal "${proposal.summary}"`);
}

export async function executeSeedAction(action: SeedAction, snapshot: SiteSnapshot): Promise<void> {
  switch (action.kind) {
    case 'createSpace':
      return createSpace();
    case 'createDecision':
      if (!snapshot.spaceId) throw new Error('Sample space must exist before Decisions');
      return createDecision(snapshot.spaceId, action.decisionKey);
    case 'createProject':
      return createProject();
    case 'createProposal':
      return createProposal(action.proposalKey);
  }
}

/* ---------- remove writes ---------- */

export async function executeRemoveAction(action: RemoveAction): Promise<void> {
  if (action.kind === 'deleteProject') {
    // Same asApp constraint as createProject; same admin guard.
    await assertCurrentUserIsJiraAdmin();
    // enableUndo moves the project to the Jira trash instead of deleting it outright.
    const res = await api
      .asApp()
      .requestJira(route`/rest/api/3/project/${SAMPLE_PROJECT.key}?enableUndo=true`, { method: 'DELETE' });
    return expectOk(res, 'Delete sample project');
  }
  // Moves the space to the Confluence trash (asynchronous on Atlassian's side).
  const res = await api
    .asUser()
    .requestConfluence(route`/wiki/rest/api/space/${SAMPLE_SPACE.key}`, { method: 'DELETE' });
  return expectOk(res, 'Delete sample space');
}
