import { describe, expect, test } from 'vitest';
import type { Decision } from '../domain/decision';
import { acceptedInScope, carryLapsed, decisionsFingerprint, isCurrent, withKnownSuperseded } from './freshness';
import type { CheckResult, CitedVerdict, DecisionRecord } from './types';

const decision = (title: string, overrides: Partial<Decision> = {}): Decision => ({
  title,
  statement: 's',
  rationale: 'r',
  deciders: ['Priya Nair'],
  decidedOn: '2026-03-04',
  status: 'Accepted',
  tags: [],
  ...overrides,
});
const record = (pageId: string, title: string, overrides: Partial<Decision> = {}, version = 1): DecisionRecord => ({
  pageId,
  decision: decision(title, overrides),
  version,
});
const verdict = (pageId: string, kind: CitedVerdict['verdict'] = 'Conflicts'): CitedVerdict => ({
  pageId,
  title: `Decision ${pageId}`,
  verdict: kind,
  citation: 'q',
  reason: 'r',
  decidedOn: '2026-03-04',
  deciders: [],
});

describe('decisionsFingerprint', () => {
  test('is the same for the same Decisions in any order', () => {
    const a = [record('1', 'A'), record('2', 'B')];
    expect(decisionsFingerprint(['S'], a)).toBe(decisionsFingerprint(['S'], [...a].reverse()));
  });

  test('changes when a Decision is edited, changes status, appears, or the spaces change', () => {
    const base = decisionsFingerprint(['S'], [record('1', 'A')]);
    expect(decisionsFingerprint(['S'], [record('1', 'A', {}, 2)])).not.toBe(base);
    expect(decisionsFingerprint(['S'], [record('1', 'A', { status: 'Superseded' })])).not.toBe(base);
    expect(decisionsFingerprint(['S'], [record('1', 'A'), record('2', 'B')])).not.toBe(base);
    expect(decisionsFingerprint(['S', 'T'], [record('1', 'A')])).not.toBe(base);
  });
});

describe('isCurrent', () => {
  const previous: CheckResult = {
    version: 1,
    contentHash: 'h',
    checkedAt: '2026-11-12T10:00:00.000Z',
    candidatesConsidered: 0,
    verdicts: [],
    decisionsFingerprint: 'f',
  };

  test('only when both the issue text and the Decisions are unchanged', () => {
    expect(isCurrent(previous, 'h', 'f')).toBe(true);
    expect(isCurrent(previous, 'h2', 'f')).toBe(false);
    expect(isCurrent(previous, 'h', 'f2')).toBe(false);
  });

  test('never for a missing Check, or one stored before Decisions were fingerprinted', () => {
    expect(isCurrent(null, 'h', 'f')).toBe(false);
    expect(isCurrent({ ...previous, decisionsFingerprint: undefined }, 'h', 'f')).toBe(false);
  });
});

describe('acceptedInScope', () => {
  test('counts only Accepted Decisions', () => {
    expect(acceptedInScope([record('1', 'A'), record('2', 'B', { status: 'Superseded' }), record('3', 'C', { status: 'Proposed' })])).toBe(1);
  });
});

describe('carryLapsed', () => {
  test('keeps a Conflict whose Decision was Superseded, naming the Accepted replacement', () => {
    const records = [
      record('1', 'Postgres', { status: 'Superseded' }),
      record('9', 'Revisit: Postgres', { supersedes: 'Postgres' }),
    ];
    expect(carryLapsed([verdict('1')], records)).toEqual([
      { ...verdict('1'), lapsed: { reason: 'Superseded', supersededBy: 'Revisit: Postgres' } },
    ]);
  });

  test('marks a Conflict whose Decision left scope as no longer a Precedent', () => {
    expect(carryLapsed([verdict('1')], [])).toEqual([{ ...verdict('1'), lapsed: { reason: 'NotAPrecedent' } }]);
  });

  test('drops Conflicts that are still Precedents, and every Related Verdict', () => {
    expect(carryLapsed([verdict('1'), verdict('2', 'Related')], [record('1', 'A')])).toEqual([]);
  });

  test('keeps an already Lapsed Verdict as it was', () => {
    const lapsed = { ...verdict('1'), lapsed: { reason: 'Superseded' as const, supersededBy: 'X' } };
    expect(carryLapsed([lapsed], [])).toEqual([lapsed]);
  });

  test('drops a Lapsed Verdict whose Decision is Accepted again, so it can be judged afresh', () => {
    const lapsed = { ...verdict('1'), lapsed: { reason: 'Superseded' as const } };
    expect(carryLapsed([lapsed], [record('1', 'A')])).toEqual([]);
  });
});

describe('withKnownSuperseded', () => {
  test('treats a Decision just marked Superseded as Superseded even if search still says Accepted', () => {
    const records = [record('1', 'Postgres'), record('2', 'REST')];
    expect(withKnownSuperseded(records, '1').map((r) => r.decision.status)).toEqual(['Superseded', 'Accepted']);
  });

  test('changes nothing without a known Supersession', () => {
    const records = [record('1', 'Postgres')];
    expect(withKnownSuperseded(records, undefined)).toBe(records);
  });
});
