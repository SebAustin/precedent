import { describe, expect, test } from 'vitest';
import type { CitedVerdict, DecisionRecord } from '../check/types';
import { EMPTY_RESOLUTIONS, type ResolutionState, buildView } from '../resolve/resolutions';
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

/** A Viewer's view of a check: `readable` verdicts plus `hidden` ones in spaces they can't access. */
function viewOf(readable: CitedVerdict[], state: ResolutionState = EMPTY_RESOLUTIONS, hidden = 0) {
  const unreadable = Array.from({ length: hidden }, (_, i): CitedVerdict => ({ ...readable[0], pageId: `h${i}`, title: `Hidden ${i}` }));
  const check = { version: 1 as const, contentHash: 'h', checkedAt: '2026-11-12T00:00:00Z', candidatesConsidered: 0, verdicts: [...readable, ...unreadable] };
  const standings = new Map(
    readable.map((v) => [
      v.pageId,
      // A Lapsed Verdict's Decision is live-Superseded too; Accepted would un-lapse it.
      { status: v.lapsed ? ('Superseded' as const) : ('Accepted' as const), version: 1, url: `https://site.example/wiki/${v.pageId}` },
    ])
  );
  return buildView(check, state, standings);
}

describe('formatCheckForAgent', () => {
  test('links each Decision with an absolute URL, so the link works inside Rovo chat', () => {
    expect(formatCheckForAgent('LP-1', viewOf([conflict]))).toContain(`Link: https://site.example/wiki/${conflict.pageId}`);
  });

  test('never presents a Lapsed Verdict as an open conflict', () => {
    const lapsed: CitedVerdict = { ...conflict, lapsed: { reason: 'Superseded', supersededBy: 'Revisit: Postgres' } };
    const text = formatCheckForAgent('LP-1', viewOf([lapsed]));

    expect(text).not.toContain('CONFLICTS');
    expect(text).toContain('NO LONGER ACCEPTED');
    expect(text).toContain('superseded by "Revisit: Postgres"');
  });

  test('describes open conflicts first, with the citation and the three ways to resolve', () => {
    const text = formatCheckForAgent('LP-1', viewOf([conflict, related]));

    expect(text.indexOf('CONFLICTS')).toBeLessThan(text.indexOf('RELATED'));
    expect(text).toContain('"We will not adopt MongoDB"');
    expect(text).toMatch(/acknowledge.*dismiss.*supersed/is);
  });

  test('reports a clean issue', () => {
    expect(formatCheckForAgent('LP-9', viewOf([]))).toBe(
      'LP-9 does not conflict with or relate to any accepted decision you can access.'
    );
  });

  test('mentions resolved conflicts and hidden decisions without naming hidden ones', () => {
    const state: ResolutionState = {
      version: 1,
      resolutions: { '101': { kind: 'Acknowledge', pageId: '101', accountId: 'a', at: '2026-11-12T00:00:00Z' } },
    };
    const text = formatCheckForAgent('LP-1', viewOf([conflict], state, 2));

    expect(text).toContain('acknowledged');
    expect(text).toContain('2 more');
    expect(text).not.toContain('Hidden');
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
