/**
 * Optional Teamwork Graph enrichment (ADR 0002): never on the critical path.
 * Runs as the viewer (TWG has no app-level access), and degrades to an
 * explicit "not available" state instead of looking broken.
 */
import api from '@forge/api';
import {
  PAGE_CONTRIBUTORS_QUERY,
  type Person,
  type Team,
  USER_TEAMS_QUERY,
  confluencePageAri,
  graphErrorCodes,
  parseContributors,
  parseTeams,
  userAri,
} from './people';

const MAX_PEOPLE = 5;

export interface PersonWithTeams extends Person {
  readonly teams: readonly Team[];
}

export type DecisionPeople =
  | { readonly status: 'ok'; readonly people: readonly PersonWithTeams[] }
  | { readonly status: 'empty' }
  | { readonly status: 'unavailable'; readonly reason: string };

async function queryGraph(query: string, variables: Record<string, string>): Promise<unknown> {
  // TWG requires a named operation shaped company_operation; pass it explicitly too.
  const operationName = query.match(/query\s+(\w+)/)?.[1];
  const res = await api.asUser().requestTeamworkGraph(query, variables, operationName);
  return res.json();
}

async function teamsOf(person: Person): Promise<readonly Team[]> {
  try {
    return parseTeams(await queryGraph(USER_TEAMS_QUERY, { userId: userAri(person.accountId) }));
  } catch {
    return []; // Teams are a nice-to-have on top of a nice-to-have.
  }
}

export async function getDecisionPeople(cloudId: string, pageId: string): Promise<DecisionPeople> {
  const response = await queryGraph(PAGE_CONTRIBUTORS_QUERY, { id: confluencePageAri(cloudId, pageId) });
  const errors = graphErrorCodes(response);
  const contributors = parseContributors(response).slice(0, MAX_PEOPLE);

  if (contributors.length === 0) {
    if (errors.length > 0) {
      const detail = JSON.stringify((response as { errors?: unknown }).errors ?? []).slice(0, 500);
      console.warn(`Precedent: Teamwork Graph unavailable for page ${pageId}: ${errors.join(', ')} ${detail}`);
      return { status: 'unavailable', reason: errors.join(', ') };
    }
    return { status: 'empty' };
  }

  const people = await Promise.all(contributors.map(async (p) => ({ ...p, teams: await teamsOf(p) })));
  return { status: 'ok', people };
}
