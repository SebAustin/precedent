import { describe, expect, test } from 'vitest';
import {
  PAGE_CONTRIBUTORS_QUERY,
  USER_TEAMS_QUERY,
  confluencePageAri,
  graphErrorCodes,
  parseContributors,
  parseTeams,
  userAri,
} from './people';

describe('ARIs', () => {
  test('builds a Confluence page ARI in the format the Confluence API itself returns', () => {
    expect(confluencePageAri('3df5a6ca-e6d9-4fe3-bfb9-55d8be5d0b9d', '3768321')).toBe(
      'ari:cloud:confluence:3df5a6ca-e6d9-4fe3-bfb9-55d8be5d0b9d:page/3768321'
    );
  });

  test('builds a user ARI from an account id', () => {
    expect(userAri('712020:abc')).toBe('ari:cloud:identity::user/712020:abc');
  });

  test('rejects malformed ids instead of building a query with them', () => {
    expect(() => confluencePageAri('cloud"', '1')).toThrow('Invalid cloud id');
    expect(() => confluencePageAri('3df5a6ca-e6d9-4fe3-bfb9-55d8be5d0b9d', 'abc')).toThrow('Invalid page id');
  });
});

describe('parseContributors', () => {
  const response = {
    data: {
      confluencePageContributors: {
        edges: [
          { node: { accountId: 'a1', name: 'Priya Nair' } },
          { node: { accountId: 'a1', name: 'Priya Nair' } },
          { node: { accountId: 'a2', name: null } },
          { node: null },
          { node: { name: 'No account' } },
        ],
      },
    },
  };

  test('returns unique contributors with an account id, defaulting missing names', () => {
    expect(parseContributors(response)).toEqual([
      { accountId: 'a1', name: 'Priya Nair' },
      { accountId: 'a2', name: 'Unknown user' },
    ]);
  });

  test('returns nothing for an empty or failed graph response', () => {
    expect(parseContributors({ data: { confluencePageContributors: null } })).toEqual([]);
    expect(parseContributors(null)).toEqual([]);
  });
});

describe('parseTeams', () => {
  test('returns team names in graph order', () => {
    const response = {
      data: {
        atlassianUserInTeams: {
          edges: [{ node: { id: 't1', displayName: 'Payments Platform' } }, { node: { id: 't2', displayName: null } }],
        },
      },
    };

    expect(parseTeams(response)).toEqual([{ id: 't1', displayName: 'Payments Platform' }]);
  });
});

describe('graphErrorCodes', () => {
  test('extracts error codes so callers can tell "no data" from "not available"', () => {
    expect(graphErrorCodes({ errors: [{ extensions: { code: 'FEATURE_UNAVAILABLE' } }, { message: 'x' }] })).toEqual([
      'FEATURE_UNAVAILABLE',
      'UNKNOWN',
    ]);
    expect(graphErrorCodes({ data: {} })).toEqual([]);
  });
});

describe('query operation names', () => {
  test('follow the Teamwork Graph rule: company_operation (>=3 and >=4 chars)', () => {
    for (const query of [PAGE_CONTRIBUTORS_QUERY, USER_TEAMS_QUERY]) {
      const name = query.match(/query\s+(\w+)/)?.[1] ?? '';
      expect(name).toMatch(/^[A-Za-z0-9]{3,}_[A-Za-z0-9]{4,}$/);
    }
  });
});
