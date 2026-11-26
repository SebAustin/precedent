import { describe, expect, test } from 'vitest';
import { buildSearchIndex } from './searchIndex';
import type { CheckResult } from './types';

const base = { pageId: '', title: 't', citation: 'c', reason: 'r', decidedOn: 'd', deciders: [] };

describe('buildSearchIndex', () => {
  test('splits Decision page ids by Verdict so JQL can find issues per Decision', () => {
    const result: CheckResult = {
      version: 1,
      contentHash: 'h',
      checkedAt: 'now',
      candidatesConsidered: 3,
      verdicts: [
        { ...base, pageId: '1', verdict: 'Conflicts' },
        { ...base, pageId: '2', verdict: 'Related' },
        { ...base, pageId: '3', verdict: 'Related' },
      ],
    };

    expect(buildSearchIndex(result)).toEqual({ conflictPageIds: ['1'], relatedPageIds: ['2', '3'] });
  });

  test('leaves Lapsed Verdicts out: their Decision is no longer a Precedent', () => {
    const result: CheckResult = {
      version: 1,
      contentHash: 'h',
      checkedAt: 'now',
      candidatesConsidered: 1,
      verdicts: [{ ...base, pageId: '1', verdict: 'Conflicts', lapsed: { reason: 'Superseded' } }],
    };

    expect(buildSearchIndex(result)).toEqual({ conflictPageIds: [], relatedPageIds: [] });
  });
});
