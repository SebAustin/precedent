import { describe, expect, test } from 'vitest';
import { EMPTY_RESOLUTIONS } from '../resolve/resolutions';
import { buildConflictComment, conflictsToAnnounce } from './announce';
import type { CitedVerdict } from './types';

const verdict = (pageId: string, kind: 'Conflicts' | 'Related'): CitedVerdict => ({
  pageId,
  title: `Decision ${pageId}`,
  verdict: kind,
  citation: 'c',
  reason: 'r',
  decidedOn: '2026-01-01',
  deciders: ['A'],
});

describe('conflictsToAnnounce', () => {
  test('announces each new Conflict once and never a Related verdict', () => {
    expect(conflictsToAnnounce([verdict('1', 'Conflicts'), verdict('2', 'Related')], [], EMPTY_RESOLUTIONS)).toEqual(['1']);
  });

  test('skips Conflicts already announced', () => {
    expect(conflictsToAnnounce([verdict('1', 'Conflicts')], ['1'], EMPTY_RESOLUTIONS)).toEqual([]);
  });

  test('skips Conflicts that already have a Resolution', () => {
    const resolved = {
      version: 1 as const,
      resolutions: { '1': { kind: 'Dismiss' as const, pageId: '1', accountId: 'a', at: 't', note: 'n' } },
    };

    expect(conflictsToAnnounce([verdict('1', 'Conflicts')], [], resolved)).toEqual([]);
  });
});

describe('buildConflictComment', () => {
  test('never reveals Decision titles or citations, since issue viewers may lack access to them', () => {
    const text = JSON.stringify(buildConflictComment(2));

    expect(text).toContain('2 accepted decisions');
    expect(text).toContain('Precedent');
    expect(text).not.toContain('Decision 1');
  });

  test('uses the singular for one conflict', () => {
    expect(JSON.stringify(buildConflictComment(1))).toContain('an accepted decision');
  });
});
