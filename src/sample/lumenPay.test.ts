import { describe, expect, test } from 'vitest';
import { parseDecisionPage, renderDecisionPage } from '../domain/decisionPage';
import { SAMPLE_DECISIONS, SAMPLE_PROPOSALS } from './lumenPay';

describe('Lumen Pay sample workspace', () => {
  test('every sample Decision survives a render/parse round trip', () => {
    for (const { key: _key, ...decision } of SAMPLE_DECISIONS) {
      expect(parseDecisionPage(decision.title, renderDecisionPage(decision))).toEqual({
        ok: true,
        decision,
      });
    }
  });

  test('titles and summaries are unique, so they can key idempotent seeding', () => {
    const titles = SAMPLE_DECISIONS.map((d) => d.title);
    const summaries = SAMPLE_PROPOSALS.map((p) => p.summary);

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(summaries).size).toBe(summaries.length);
  });

  test('every supersession points at an existing Superseded Decision', () => {
    for (const decision of SAMPLE_DECISIONS.filter((d) => d.supersedes)) {
      const target = SAMPLE_DECISIONS.find((d) => d.title === decision.supersedes);
      expect(target?.status).toBe('Superseded');
    }
  });

  test('expected Verdicts never point at a non-Accepted Decision', () => {
    const accepted = new Set(SAMPLE_DECISIONS.filter((d) => d.status === 'Accepted').map((d) => d.key));

    for (const proposal of SAMPLE_PROPOSALS) {
      for (const key of Object.keys(proposal.expected)) {
        expect(accepted.has(key as never)).toBe(true);
      }
    }
  });

  test('the eval set covers every Verdict: 3 Conflicts, 5 Related, 2 None', () => {
    const verdicts: string[] = SAMPLE_PROPOSALS.map((p) => Object.values(p.expected)[0] ?? 'None');

    expect(verdicts.filter((v) => v === 'Conflicts')).toHaveLength(3);
    expect(verdicts.filter((v) => v === 'Related')).toHaveLength(5);
    expect(verdicts.filter((v) => v === 'None')).toHaveLength(2);
  });
});
