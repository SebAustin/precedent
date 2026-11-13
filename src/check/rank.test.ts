import { describe, expect, test } from 'vitest';
import { SAMPLE_DECISIONS, SAMPLE_PROPOSALS } from '../sample/lumenPay';
import { rankCandidates, tokenize } from './rank';
import type { DecisionRecord } from './types';

const records: DecisionRecord[] = SAMPLE_DECISIONS.map(({ key, ...decision }) => ({ pageId: key, decision }));

function proposalFor(key: string) {
  const p = SAMPLE_PROPOSALS.find((x) => x.key === key);
  if (!p) throw new Error(key);
  return { issueKey: key, summary: p.summary, description: p.description };
}

describe('tokenize', () => {
  test('lowercases, drops stopwords and folds simple plurals', () => {
    expect(tokenize('We store the Replicas of profiles')).toEqual(['store', 'replica', 'profile']);
  });

  test('keeps technical tokens like us-east-1 and v2 intact', () => {
    expect(tokenize('Add a us-east-1 replica under /v2')).toEqual(['add', 'us-east-1', 'replica', 'v2']);
  });
});

describe('rankCandidates', () => {
  test('never returns a non-Accepted Decision', () => {
    const ranked = rankCandidates(proposalFor('notifications-service'), records);

    expect(ranked.map((r) => r.decision.status)).not.toContain('Superseded');
  });

  test('returns nothing when no Decision shares a meaningful word', () => {
    expect(rankCandidates(proposalFor('onboarding-typo'), records)).toEqual([]);
  });

  test('caps the candidate list', () => {
    expect(rankCandidates(proposalFor('us-replica'), records, 2).length).toBeLessThanOrEqual(2);
  });

  test.each(
    SAMPLE_PROPOSALS.filter((p) => Object.keys(p.expected).length > 0).map((p) => [p.key, Object.keys(p.expected)[0]])
  )('recalls the expected Decision for %s within the top 5', (proposalKey, decisionKey) => {
    const ranked = rankCandidates(proposalFor(proposalKey), records);

    expect(ranked.map((r) => r.pageId)).toContain(decisionKey);
  });
});
