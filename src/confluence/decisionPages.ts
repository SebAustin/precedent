/**
 * Confluence operations on Decision pages, shared by the Sample Workspace
 * seeder and the Supersede resolution.
 */
import api, { route } from '@forge/api';
import { DECISION_LABEL, type Decision, type DecisionStatus } from '../domain/decision';
import { type ParseResult, parseDecisionPage, renderDecisionPage, withStatus } from '../domain/decisionPage';

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };
const MAX_ERROR_BODY = 300;

export type Actor = 'user' | 'app';

function requester(actor: Actor) {
  return actor === 'user' ? api.asUser() : api.asApp();
}

export async function expectOk(
  response: { ok: boolean; status: number; text(): Promise<string> },
  what: string
): Promise<void> {
  if (response.ok) return;
  throw new Error(`${what} failed (HTTP ${response.status}): ${(await response.text()).slice(0, MAX_ERROR_BODY)}`);
}

export interface DecisionPage {
  readonly id: string;
  readonly title: string;
  readonly spaceId: string;
  readonly version: number;
  readonly body: string;
  readonly url: string | undefined;
  readonly parsed: ParseResult;
}

export async function readDecisionPage(actor: Actor, pageId: string): Promise<DecisionPage> {
  const res = await requester(actor).requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=storage`);
  await expectOk(res, `Read Decision page ${pageId}`);
  const page = (await res.json()) as {
    id: string;
    title: string;
    spaceId: string;
    version: { number: number };
    body: { storage?: { value?: string } };
    _links?: { base?: string; webui?: string };
  };
  const body = page.body.storage?.value ?? '';
  return {
    id: page.id,
    title: page.title,
    spaceId: page.spaceId,
    version: page.version.number,
    body,
    url: page._links?.base && page._links.webui ? `${page._links.base}${page._links.webui}` : undefined,
    parsed: parseDecisionPage(page.title, body),
  };
}

/** Creates a Decision page and applies the `decision` label. Returns the new page id. */
export async function createDecisionPage(actor: Actor, spaceId: string, decision: Decision): Promise<string> {
  const res = await requester(actor).requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      spaceId,
      status: 'current',
      title: decision.title,
      body: { representation: 'storage', value: renderDecisionPage(decision) },
    }),
  });
  await expectOk(res, `Create Decision "${decision.title}"`);
  const { id } = (await res.json()) as { id: string };

  const label = await requester(actor).requestConfluence(route`/wiki/rest/api/content/${id}/label`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify([{ prefix: 'global', name: DECISION_LABEL }]),
  });
  await expectOk(label, `Label Decision "${decision.title}"`);
  return id;
}

/** Changes only the Status cell of an existing Decision page. */
export async function setDecisionStatus(actor: Actor, page: DecisionPage, status: DecisionStatus, message: string) {
  const res = await requester(actor).requestConfluence(route`/wiki/api/v2/pages/${page.id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id: page.id,
      status: 'current',
      title: page.title,
      body: { representation: 'storage', value: withStatus(page.body, status) },
      version: { number: page.version + 1, message },
    }),
  });
  await expectOk(res, `Set status of "${page.title}"`);
}

export async function commentOnPage(actor: Actor, pageId: string, storageHtml: string): Promise<void> {
  const res = await requester(actor).requestConfluence(route`/wiki/api/v2/footer-comments`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ pageId, body: { representation: 'storage', value: storageHtml } }),
  });
  await expectOk(res, `Comment on page ${pageId}`);
}

/** Finds a Decision page by exact title within a space (used to follow "Supersedes"). */
export async function findDecisionPageIdByTitle(actor: Actor, spaceId: string, title: string): Promise<string | null> {
  const res = await requester(actor).requestConfluence(
    route`/wiki/api/v2/spaces/${spaceId}/pages?title=${title}&limit=5`
  );
  await expectOk(res, `Find Decision "${title}"`);
  const { results } = (await res.json()) as { results: { id: string; title: string }[] };
  return results.find((p) => p.title === title)?.id ?? null;
}
