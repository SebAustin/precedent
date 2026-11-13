/**
 * Scores one Proposal's Verdicts against the Sample Workspace's expectations.
 * Missing an expected Verdict or raising a false Conflict fails; an extra
 * "Related" on an unexpected Decision is tolerated (it is harmless context).
 */
import type { ShownVerdict } from './types';

export interface ActualVerdict {
  readonly decisionKey: string;
  readonly verdict: ShownVerdict;
}

export interface ProposalScore {
  readonly passed: boolean;
  readonly missing: readonly string[];
  readonly unexpected: readonly string[];
}

const label = (key: string, verdict: string): string => `${key}: ${verdict}`;

export function scoreProposal(
  expected: Readonly<Partial<Record<string, ShownVerdict>>>,
  actual: readonly ActualVerdict[]
): ProposalScore {
  const actualByKey = new Map(actual.map((a) => [a.decisionKey, a.verdict] as const));

  const missing = Object.entries(expected)
    .filter(([key, verdict]) => actualByKey.get(key) !== verdict)
    .map(([key, verdict]) => label(key, String(verdict)));

  const unexpected = actual
    .filter((a) => {
      const wanted = expected[a.decisionKey];
      return wanted === undefined ? a.verdict === 'Conflicts' : wanted !== a.verdict;
    })
    .map((a) => label(a.decisionKey, a.verdict));

  return { passed: missing.length === 0 && unexpected.length === 0, missing, unexpected };
}
