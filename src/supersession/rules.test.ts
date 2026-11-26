import { describe, expect, test } from 'vitest';
import type { Decision } from '../domain/decision';
import { completeSupersession, draftSupersedingDecision } from './rules';

const old: Decision = {
  title: 'Customer PII stays in the EU region',
  statement: 'Customer PII is stored only in the EU.',
  rationale: 'GDPR.',
  deciders: ['Lena Fischer'],
  decidedOn: '2025-09-02',
  status: 'Accepted',
  tags: ['privacy', 'gdpr'],
};

describe('draftSupersedingDecision', () => {
  const proposal = {
    issueKey: 'LUMENPAY-3',
    summary: 'Add a us-east-1 read replica of customer profiles',
    description: 'US merchants see 300ms latency.',
  };

  test('creates a Proposed Decision that supersedes the old one and keeps its tags', () => {
    const draft = draftSupersedingDecision(old, proposal, '2026-11-12');

    expect(draft).toMatchObject({
      status: 'Proposed',
      supersedes: 'Customer PII stays in the EU region',
      decidedOn: '2026-11-12',
      deciders: [],
      tags: ['privacy', 'gdpr'],
    });
  });

  test('titles the draft after the old Decision and the proposing issue', () => {
    expect(draftSupersedingDecision(old, proposal, '2026-11-12').title).toBe(
      'Revisit: Customer PII stays in the EU region (LUMENPAY-3)'
    );
  });

  test('pre-fills statement and rationale from the issue for a human to rewrite', () => {
    const draft = draftSupersedingDecision(old, proposal, '2026-11-12');

    expect(draft.statement).toContain('Add a us-east-1 read replica of customer profiles');
    expect(draft.rationale).toContain('US merchants see 300ms latency.');
    expect(draft.rationale).toContain('LUMENPAY-3');
  });
});

describe('completeSupersession', () => {
  const replacement: Decision = { ...old, title: 'New PII rule', status: 'Accepted', supersedes: old.title };

  test('marks the old Decision Superseded once its replacement is Accepted', () => {
    expect(completeSupersession(replacement, old)).toEqual({ ...old, status: 'Superseded' });
  });

  test('does nothing while the replacement is still Proposed', () => {
    expect(completeSupersession({ ...replacement, status: 'Proposed' }, old)).toBeNull();
  });

  test('does nothing while the replacement still has the drafted placeholder statement', () => {
    const draft = draftSupersedingDecision(old, { issueKey: 'LUMENPAY-3', summary: 'Use MongoDB', description: '' }, '2026-11-26');
    expect(completeSupersession({ ...draft, status: 'Accepted' }, old)).toBeNull();
  });

  test('does nothing when the old Decision is already Superseded', () => {
    expect(completeSupersession(replacement, { ...old, status: 'Superseded' })).toBeNull();
  });

  test('does nothing when the replacement supersedes a different Decision', () => {
    expect(completeSupersession({ ...replacement, supersedes: 'Something else' }, old)).toBeNull();
  });
});
