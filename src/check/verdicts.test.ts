import { describe, expect, test } from 'vitest';
import type { DecisionRecord } from './types';
import { parseVerdicts } from './verdicts';

const postgres: DecisionRecord = {
  pageId: '101',
  decision: {
    title: 'Postgres for all transactional data',
    statement: 'We will not adopt MongoDB or other document stores for transactional data; Postgres is the system of record.',
    rationale: 'ACID.',
    deciders: ['Priya Nair'],
    decidedOn: '2026-03-04',
    status: 'Accepted',
    tags: ['database'],
  },
};

const candidates = [postgres];

function call(verdicts: unknown[]) {
  return { verdicts };
}

describe('parseVerdicts', () => {
  test('keeps a well-formed Conflicts verdict with an exact citation', () => {
    const result = parseVerdicts(
      call([
        {
          decision_id: '101',
          verdict: 'Conflicts',
          citation: 'We will not adopt MongoDB',
          reason: 'The spike stores ledger events in MongoDB.',
        },
      ]),
      candidates
    );

    expect(result).toEqual([
      {
        pageId: '101',
        title: 'Postgres for all transactional data',
        verdict: 'Conflicts',
        citation: 'We will not adopt MongoDB',
        reason: 'The spike stores ledger events in MongoDB.',
        decidedOn: '2026-03-04',
        deciders: ['Priya Nair'],
      },
    ]);
  });

  test('accepts citations that differ only in case, spacing or punctuation', () => {
    const result = parseVerdicts(
      call([{ decision_id: '101', verdict: 'Related', citation: 'postgres is the system  of record', reason: 'r' }]),
      candidates
    );

    expect(result).toHaveLength(1);
  });

  test('drops verdicts whose citation is not in the Decision statement', () => {
    const result = parseVerdicts(
      call([{ decision_id: '101', verdict: 'Conflicts', citation: 'MongoDB is banned forever', reason: 'r' }]),
      candidates
    );

    expect(result).toEqual([]);
  });

  test('drops None verdicts, unknown decisions and unknown verdict values', () => {
    const result = parseVerdicts(
      call([
        { decision_id: '101', verdict: 'None', citation: 'We will not adopt MongoDB', reason: 'r' },
        { decision_id: '999', verdict: 'Conflicts', citation: 'We will not adopt MongoDB', reason: 'r' },
        { decision_id: '101', verdict: 'Maybe', citation: 'We will not adopt MongoDB', reason: 'r' },
      ]),
      candidates
    );

    expect(result).toEqual([]);
  });

  test('keeps only the first verdict per Decision', () => {
    const v = { decision_id: '101', citation: 'We will not adopt MongoDB', reason: 'r' };

    const result = parseVerdicts(call([{ ...v, verdict: 'Conflicts' }, { ...v, verdict: 'Related' }]), candidates);

    expect(result.map((r) => r.verdict)).toEqual(['Conflicts']);
  });

  test('reports why each non-None verdict was rejected', () => {
    const rejected: string[] = [];

    parseVerdicts(
      call([
        { decision_id: '101', verdict: 'Related', citation: 'MongoDB is banned forever', reason: 'r' },
        { decision_id: '101', verdict: 'None', citation: '', reason: 'r' },
      ]),
      candidates,
      (why) => rejected.push(why)
    );

    expect(rejected).toEqual(['101 Related: citation not found in statement: "MongoDB is banned forever"']);
  });

  test('returns nothing for malformed tool output', () => {
    expect(parseVerdicts(null, candidates)).toEqual([]);
    expect(parseVerdicts({ verdicts: 'nope' }, candidates)).toEqual([]);
    expect(parseVerdicts({ verdicts: [42, null] }, candidates)).toEqual([]);
  });

  test('accepts tool arguments delivered as a JSON string', () => {
    const json = JSON.stringify(
      call([{ decision_id: '101', verdict: 'Related', citation: 'Postgres is the system of record', reason: 'r' }])
    );

    expect(parseVerdicts(json, candidates)).toHaveLength(1);
  });
});
