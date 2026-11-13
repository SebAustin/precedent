/**
 * Pure helpers for the Teamwork Graph enrichment: "who knows about this
 * Decision?" — the page's contributors and the teams they belong to.
 * Shapes follow the TWG schema (Relay connections of union nodes).
 */
const CLOUD_ID = /^[0-9a-f-]{36}$/i;
const PAGE_ID = /^\d+$/;

export interface Person {
  readonly accountId: string;
  readonly name: string;
}

export interface Team {
  readonly id: string;
  readonly displayName: string;
}

export function confluencePageAri(cloudId: string, pageId: string): string {
  if (!CLOUD_ID.test(cloudId)) throw new Error('Invalid cloud id.');
  if (!PAGE_ID.test(pageId)) throw new Error('Invalid page id.');
  return `ari:cloud:confluence:${cloudId}:page/${pageId}`;
}

export function userAri(accountId: string): string {
  return `ari:cloud:identity::user/${accountId}`;
}

export const PAGE_CONTRIBUTORS_QUERY = `query precedent_pageContributors($id: ID!) {
  confluencePageContributors(id: $id, first: 10) {
    edges { node { ... on AtlassianUser { accountId name } } }
  }
}`;

export const USER_TEAMS_QUERY = `query precedent_userTeams($userId: ID!) {
  atlassianUserInTeams(userId: $userId, first: 3) {
    edges { node { ... on AtlassianTeam { id displayName } } }
  }
}`;

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null;
}

/** Returns the `node`s of a connection at data[field], skipping nulls. */
function nodesOf(response: unknown, field: string): Json[] {
  const data = isJson(response) && isJson(response.data) ? response.data : null;
  const connection = data && isJson(data[field]) ? (data[field] as Json) : null;
  const edges = connection && Array.isArray(connection.edges) ? connection.edges : [];
  return edges.map((edge) => (isJson(edge) && isJson(edge.node) ? edge.node : null)).filter((n): n is Json => n !== null);
}

export function parseContributors(response: unknown): Person[] {
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const node of nodesOf(response, 'confluencePageContributors')) {
    if (typeof node.accountId !== 'string' || seen.has(node.accountId)) continue;
    seen.add(node.accountId);
    people.push({ accountId: node.accountId, name: typeof node.name === 'string' ? node.name : 'Unknown user' });
  }
  return people;
}

export function parseTeams(response: unknown): Team[] {
  return nodesOf(response, 'atlassianUserInTeams')
    .filter((n) => typeof n.id === 'string' && typeof n.displayName === 'string')
    .map((n) => ({ id: n.id as string, displayName: n.displayName as string }));
}

export function graphErrorCodes(response: unknown): string[] {
  if (!isJson(response) || !Array.isArray(response.errors)) return [];
  return response.errors.map((e) => {
    const code = isJson(e) && isJson(e.extensions) ? e.extensions.code : undefined;
    return typeof code === 'string' ? code : 'UNKNOWN';
  });
}
