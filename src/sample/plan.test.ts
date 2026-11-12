import { describe, expect, test } from 'vitest';
import { SAMPLE_DECISIONS, SAMPLE_PROPOSALS } from './lumenPay';
import { type WorkspaceState, computeRemovePlan, computeSeedPlan, summarizeWorkspace } from './plan';

const EMPTY: WorkspaceState = { space: null, decisionTitles: [], project: null, proposalSummaries: [] };

const COMPLETE: WorkspaceState = {
  space: { isSample: true },
  decisionTitles: SAMPLE_DECISIONS.map((d) => d.title),
  project: { isSample: true },
  proposalSummaries: SAMPLE_PROPOSALS.map((p) => p.summary),
};

describe('computeSeedPlan', () => {
  test('on an empty site, creates space, every Decision, project, every Proposal — in that order', () => {
    const plan = computeSeedPlan(EMPTY);

    expect(plan.status).toBe('ready');
    const kinds = plan.status === 'ready' ? plan.actions.map((a) => a.kind) : [];
    expect(kinds).toEqual([
      'createSpace',
      ...SAMPLE_DECISIONS.map(() => 'createDecision'),
      'createProject',
      ...SAMPLE_PROPOSALS.map(() => 'createProposal'),
    ]);
  });

  test('is idempotent: a complete workspace needs no actions', () => {
    expect(computeSeedPlan(COMPLETE)).toEqual({ status: 'ready', actions: [] });
  });

  test('resumes a partial run without recreating existing content', () => {
    const partial: WorkspaceState = {
      ...EMPTY,
      space: { isSample: true },
      decisionTitles: [SAMPLE_DECISIONS[0].title],
    };

    const plan = computeSeedPlan(partial);

    expect(plan.status === 'ready' && plan.actions[0]).toEqual({
      kind: 'createDecision',
      decisionKey: SAMPLE_DECISIONS[1].key,
    });
    expect(plan.status === 'ready' && plan.actions.some((a) => a.kind === 'createSpace')).toBe(false);
  });

  test('refuses to write into a same-key space Precedent did not create', () => {
    const plan = computeSeedPlan({ ...EMPTY, space: { isSample: false } });

    expect(plan).toEqual({
      status: 'blocked',
      reason: 'A Confluence space with key LUMENPAY already exists and was not created by Precedent.',
    });
  });

  test('refuses to write into a same-key project Precedent did not create', () => {
    const plan = computeSeedPlan({ ...COMPLETE, project: { isSample: false }, proposalSummaries: [] });

    expect(plan.status).toBe('blocked');
  });
});

describe('computeRemovePlan', () => {
  test('deletes the sample project and space', () => {
    expect(computeRemovePlan(COMPLETE)).toEqual({
      status: 'ready',
      actions: [{ kind: 'deleteProject' }, { kind: 'deleteSpace' }],
    });
  });

  test('never deletes content Precedent did not create', () => {
    const plan = computeRemovePlan({ ...COMPLETE, space: { isSample: false } });

    expect(plan).toEqual({ status: 'ready', actions: [{ kind: 'deleteProject' }] });
  });

  test('has nothing to do on an empty site', () => {
    expect(computeRemovePlan(EMPTY)).toEqual({ status: 'ready', actions: [] });
  });
});

describe('summarizeWorkspace', () => {
  test.each([
    ['empty', EMPTY],
    ['complete', COMPLETE],
    ['partial', { ...EMPTY, space: { isSample: true } }],
    ['blocked', { ...EMPTY, space: { isSample: false } }],
  ] as const)('reports %s', (expected, state) => {
    expect(summarizeWorkspace(state).status).toBe(expected);
  });

  test('reports progress as created / total items', () => {
    const summary = summarizeWorkspace({ ...EMPTY, space: { isSample: true } });

    expect(summary.created).toBe(1);
    expect(summary.total).toBe(2 + SAMPLE_DECISIONS.length + SAMPLE_PROPOSALS.length);
  });
});
