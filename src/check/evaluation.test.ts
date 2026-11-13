import { describe, expect, test } from 'vitest';
import { scoreProposal } from './evaluation';

describe('scoreProposal', () => {
  test('passes when shown Verdicts exactly match the expected ones', () => {
    const outcome = scoreProposal({ postgres: 'Conflicts' }, [{ decisionKey: 'postgres', verdict: 'Conflicts' }]);

    expect(outcome).toEqual({ passed: true, missing: [], unexpected: [] });
  });

  test('passes a None proposal that produced no Verdicts', () => {
    expect(scoreProposal({}, []).passed).toBe(true);
  });

  test('fails on a wrong verdict for the right Decision', () => {
    const outcome = scoreProposal({ postgres: 'Conflicts' }, [{ decisionKey: 'postgres', verdict: 'Related' }]);

    expect(outcome).toEqual({
      passed: false,
      missing: ['postgres: Conflicts'],
      unexpected: ['postgres: Related'],
    });
  });

  test('fails on an extra Conflicts but tolerates an extra Related', () => {
    expect(
      scoreProposal({ rest: 'Related' }, [
        { decisionKey: 'rest', verdict: 'Related' },
        { decisionKey: 'flags', verdict: 'Related' },
      ]).passed
    ).toBe(true);

    expect(
      scoreProposal({ rest: 'Related' }, [
        { decisionKey: 'rest', verdict: 'Related' },
        { decisionKey: 'flags', verdict: 'Conflicts' },
      ]).passed
    ).toBe(false);
  });
});
