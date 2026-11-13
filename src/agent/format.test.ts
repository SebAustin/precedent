import { describe, expect, test } from 'vitest';
import type { DecisionRecord } from '../check/types';
import { EMPTY_RESOLUTIONS, annotateVerdicts } from '../resolve/resolutions';
import { findVerdictByTitle, formatCheckForAgent, formatPrecedents } from './format';

const record: DecisionRecord = {
  pageId: '101',
  decision: {
    title: 'Postgres for all transactional data',
    statement: 'We will not adopt MongoDB.',
    rationale: 'ACID.',
    deciders: ['Priya Nair'],
    decidedOn: '2026-03-04',
    status: 'Accepted',
    tags: ['database'],
  },
};

const conflict = {
  pageId: '101',
  title: 'Postgres for all transactional data',
  verdict: 'Conflicts' as const,
  citation: 'We will not adopt MongoDB',
  reason: 'Uses MongoDB.',
  decidedOn: '2026-03-04',
  deciders: ['Priya Nair'],
};
const related = { ...conflict, pageId: '202', title: 'REST for public and partner APIs', verdict: 'Related' as const };

describe('formatPrecedents', () => {
  test('lists each Decision with statement, decider, date and a page link', () => {
    const text = formatPrecedents('database choice', [record]);

    expect(text).toContain('Postgres for all transactional data');
    expect(text).toContain('We will not adopt MongoDB.');
    expect(text).toContain('Priya Nair');
    expect(text).toContain('2026-03-04');
    expect(text).toContain('/wiki/pages/viewpage.action?pageId=101');
  });

  test('says plainly when nothing was found', () => {
    expect(formatPrecedents('quantum billing', [])).toBe(
      'No accepted decisions in the Decision Spaces match "quantum billing".'
    );
  });
});

describe('formatCheckForAgent', () => {
  test('describes open conflicts first, with the citation and the three ways to resolve', () => {
    const text = formatCheckForAgent('LP-1', annotateVerdicts([conflict, related], EMPTY_RESOLUTIONS));

    expect(text.indexOf('CONFLICTS')).toBeLessThan(text.indexOf('RELATED'));
    expect(text).toContain('"We will not adopt MongoDB"');
    expect(text).toMatch(/acknowledge.*dismiss.*supersed/is);
  });

  test('reports a clean issue', () => {
    expect(formatCheckForAgent('LP-9', annotateVerdicts([], EMPTY_RESOLUTIONS))).toBe(
      'LP-9 does not conflict with or relate to any accepted decision you can access.'
    );
  });

  test('mentions resolved conflicts and hidden decisions without naming hidden ones', () => {
    const view = annotateVerdicts([conflict], {
      version: 1,
      resolutions: { '101': { kind: 'Acknowledge', pageId: '101', accountId: 'a', at: '2026-11-12T00:00:00Z' } },
    });

    expect(formatCheckForAgent('LP-1', { ...view, hiddenCount: 2 })).toContain('acknowledged');
    expect(formatCheckForAgent('LP-1', { ...view, hiddenCount: 2 })).toContain('2 more');
  });
});

describe('findVerdictByTitle', () => {
  const verdicts = [conflict, related];

  test('matches exact titles case-insensitively', () => {
    expect(findVerdictByTitle(verdicts, '  postgres FOR all transactional data ')?.pageId).toBe('101');
  });

  test('matches a unique partial title', () => {
    expect(findVerdictByTitle(verdicts, 'REST')?.pageId).toBe('202');
  });

  test('returns undefined for ambiguous or unknown titles', () => {
    expect(findVerdictByTitle(verdicts, 'a')).toBeUndefined();
    expect(findVerdictByTitle(verdicts, 'Kafka')).toBeUndefined();
  });
});
