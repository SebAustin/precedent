/**
 * Site access for checking. Runs asApp because the check also runs from a
 * background trigger with no user. Display-time permission filtering (only
 * show Precedents the viewer can read) is a separate, later concern.
 */
import api, { route } from '@forge/api';
import { DECISION_LABEL } from '../domain/decision';
import { parseDecisionPage } from '../domain/decisionPage';
import { adfToText } from './proposal';
import type { CheckResult, DecisionRecord, Proposal } from './types';

export const CHECK_PROPERTY = 'precedent-check';
const MAX_DECISIONS = 100;
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

async function failIfNotOk(response: { ok: boolean; status: number; text(): Promise<string> }, what: string) {
  if (!response.ok) throw new Error(`${what} failed (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`);
}

export { getDecisionSpaces } from '../settings/store';

export async function fetchProposal(issueKey: string): Promise<Proposal> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary,description`);
  await failIfNotOk(res, `Read issue ${issueKey}`);
  const issue = (await res.json()) as { key: string; fields: { summary?: string; description?: unknown } };
  return { issueKey: issue.key, summary: issue.fields.summary ?? '', description: adfToText(issue.fields.description) };
}

/** Escapes a value for use inside a double-quoted CQL string. */
function cqlString(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

export async function fetchDecisionRecords(spaceKeys: readonly string[]): Promise<DecisionRecord[]> {
  const cql = `type = page AND label = ${cqlString(DECISION_LABEL)} AND space in (${spaceKeys.map(cqlString).join(', ')})`;
  const res = await api
    .asApp()
    .requestConfluence(route`/wiki/rest/api/content/search?cql=${cql}&expand=body.storage&limit=${MAX_DECISIONS}`);
  await failIfNotOk(res, 'Search Decisions');

  const { results } = (await res.json()) as {
    results: { id: string; title: string; body?: { storage?: { value?: string } } }[];
  };

  return results.flatMap((page) => {
    const parsed = parseDecisionPage(page.title, page.body?.storage?.value ?? '');
    if (!parsed.ok) {
      console.warn(`Precedent: skipping malformed Decision "${page.title}": ${parsed.errors.join('; ')}`);
      return [];
    }
    return [{ pageId: page.id, decision: parsed.decision }];
  });
}

export async function readCheckResult(issueKey: string): Promise<CheckResult | null> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${CHECK_PROPERTY}`);
  if (res.status === 404) return null;
  await failIfNotOk(res, `Read check result for ${issueKey}`);
  const { value } = (await res.json()) as { value: CheckResult };
  return value?.version === 1 ? value : null;
}

export async function writeCheckResult(issueKey: string, result: CheckResult): Promise<void> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${CHECK_PROPERTY}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(result),
  });
  await failIfNotOk(res, `Store check result for ${issueKey}`);
}

export const ANNOUNCED_PROPERTY = 'precedent-announced';

export async function readAnnounced(issueKey: string): Promise<string[]> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${ANNOUNCED_PROPERTY}`);
  if (res.status === 404) return [];
  await failIfNotOk(res, `Read announced conflicts for ${issueKey}`);
  const { value } = (await res.json()) as { value: { pageIds?: unknown } };
  return Array.isArray(value?.pageIds) ? value.pageIds.filter((id): id is string => typeof id === 'string') : [];
}

/** Posts the (privacy-safe) conflict comment as the app and remembers which Conflicts it covered. */
export async function announceConflicts(issueKey: string, comment: object, pageIds: readonly string[], previous: readonly string[]) {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ body: comment }),
  });
  await failIfNotOk(res, `Comment on ${issueKey}`);

  const store = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${ANNOUNCED_PROPERTY}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ pageIds: [...previous, ...pageIds] }),
  });
  await failIfNotOk(store, `Remember announced conflicts for ${issueKey}`);
}

export async function findIssueKeyBySummary(projectKey: string, summary: string): Promise<string | null> {
  const res = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      jql: `project = ${projectKey} AND summary ~ ${cqlString(summary)}`,
      fields: ['summary'],
      maxResults: 10,
    }),
  });
  await failIfNotOk(res, 'Find sample issue');
  const { issues } = (await res.json()) as { issues: { key: string; fields: { summary: string } }[] };
  return issues.find((i) => i.fields.summary === summary)?.key ?? null;
}
