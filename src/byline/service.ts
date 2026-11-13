/**
 * Data for the Confluence byline on Decision pages. The JQL search runs as the
 * viewer, so they only ever see issues they are allowed to see in Jira.
 */
import api, { route } from '@forge/api';
import { readDecisionPage } from '../confluence/decisionPages';
import { readResolutions } from '../resolve/store';
import { type IssueReference, type ReferenceGroups, groupReferences, referencesTitle } from './references';

const MAX_REFERENCES = 30;
const PAGE_ID = /^\d+$/;
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export interface BylineState {
  readonly isDecision: boolean;
  readonly title: string;
  readonly groups: ReferenceGroups | null;
}

interface SearchHit {
  readonly key: string;
  readonly fields: { readonly summary: string; readonly status?: { readonly name?: string } };
}

async function searchReferencingIssues(pageId: string, alias: 'precedentConflicts' | 'precedentRelated'): Promise<SearchHit[]> {
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ jql: `${alias} = "${pageId}" ORDER BY updated DESC`, fields: ['summary', 'status'], maxResults: MAX_REFERENCES }),
  });
  if (!res.ok) throw new Error(`Search issues referencing page ${pageId} failed (HTTP ${res.status}).`);
  return ((await res.json()) as { issues: SearchHit[] }).issues;
}

async function toReference(hit: SearchHit, pageId: string, kind: IssueReference['kind']): Promise<IssueReference> {
  const resolution = kind === 'Conflicts' ? (await readResolutions(hit.key)).resolutions[pageId]?.kind : undefined;
  return { key: hit.key, summary: hit.fields.summary, status: hit.fields.status?.name ?? '', kind, ...(resolution ? { resolution } : {}) };
}

export async function getBylineState(contentId: unknown): Promise<BylineState> {
  const pageId = String(contentId ?? '');
  if (!PAGE_ID.test(pageId)) return { isDecision: false, title: 'Precedent', groups: null };

  const page = await readDecisionPage('user', pageId);
  if (!page.parsed.ok) return { isDecision: false, title: 'Precedent', groups: null };

  const [conflicts, related] = await Promise.all([
    searchReferencingIssues(pageId, 'precedentConflicts'),
    searchReferencingIssues(pageId, 'precedentRelated'),
  ]);
  const refs = await Promise.all([
    ...conflicts.map((hit) => toReference(hit, pageId, 'Conflicts')),
    ...related.map((hit) => toReference(hit, pageId, 'Related')),
  ]);
  return { isDecision: true, title: referencesTitle(conflicts.length, related.length), groups: groupReferences(refs) };
}

/** dynamicProperties handler: sets the byline title, e.g. "Precedent · challenged by 3 issues". */
export async function bylineProperties(payload: { extension?: { content?: { id?: unknown } } }) {
  try {
    const state = await getBylineState(payload.extension?.content?.id);
    return { title: state.title };
  } catch (error: unknown) {
    console.warn('Precedent byline title failed', error instanceof Error ? error.message : error);
    return { title: 'Precedent' };
  }
}
