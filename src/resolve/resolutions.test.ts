import { describe, expect, test } from 'vitest';
import type { CitedVerdict } from '../check/types';
import { EMPTY_RESOLUTIONS, annotateVerdicts, recordResolution } from './resolutions';

const conflict: CitedVerdict = {
  pageId: '101',
  title: 'Postgres for all transactional data',
  verdict: 'Conflicts',
  citation: 'We will not adopt MongoDB',
  reason: 'r',
  decidedOn: '2026-03-04',
  deciders: ['Priya Nair'],
};
const related: CitedVerdict = { ...conflict, pageId: '202', title: 'REST', verdict: 'Related' };

const AT = '2026-11-12T10:00:00.000Z';

describe('recordResolution', () => {
  test('records an Acknowledge on a Conflicts verdict without mutating the previous state', () => {
    const next = recordResolution(EMPTY_RESOLUTIONS, [conflict], {
      kind: 'Acknowledge',
      pageId: '101',
      accountId: 'acc-1',
      at: AT,
    });

    expect(next.resolutions['101']).toEqual({ kind: 'Acknowledge', pageId: '101', accountId: 'acc-1', at: AT });
    expect(EMPTY_RESOLUTIONS.resolutions).toEqual({});
  });

  test('requires a reason to Dismiss', () => {
    expect(() =>
      recordResolution(EMPTY_RESOLUTIONS, [conflict], { kind: 'Dismiss', pageId: '101', accountId: 'a', at: AT, note: '  ' })
    ).toThrow('Dismissing needs a short reason');
  });

  test('only Conflicts verdicts can be resolved', () => {
    expect(() =>
      recordResolution(EMPTY_RESOLUTIONS, [related], { kind: 'Acknowledge', pageId: '202', accountId: 'a', at: AT })
    ).toThrow('Only a Conflicts verdict can be resolved');
  });

  test('rejects resolving a Decision that has no current verdict', () => {
    expect(() =>
      recordResolution(EMPTY_RESOLUTIONS, [conflict], { kind: 'Acknowledge', pageId: '999', accountId: 'a', at: AT })
    ).toThrow('Only a Conflicts verdict can be resolved');
  });
});

describe('annotateVerdicts', () => {
  test('marks acknowledged and superseding conflicts as resolved, leaving others open', () => {
    const state = recordResolution(EMPTY_RESOLUTIONS, [conflict], {
      kind: 'Supersede',
      pageId: '101',
      accountId: 'a',
      at: AT,
      draftPageId: '555',
    });

    const view = annotateVerdicts([conflict, related], state);

    expect(view.verdicts.map((v) => v.resolution?.kind)).toEqual(['Supersede', undefined]);
    expect(view.openConflicts).toBe(0);
  });

  test('hides dismissed pairs entirely', () => {
    const state = recordResolution(EMPTY_RESOLUTIONS, [conflict], {
      kind: 'Dismiss',
      pageId: '101',
      accountId: 'a',
      at: AT,
      note: 'We only store analytics copies there',
    });

    const view = annotateVerdicts([conflict, related], state);

    expect(view.verdicts.map((v) => v.pageId)).toEqual(['202']);
    expect(view.dismissedCount).toBe(1);
  });

  test('counts unresolved conflicts', () => {
    expect(annotateVerdicts([conflict, related], EMPTY_RESOLUTIONS).openConflicts).toBe(1);
  });
});

describe('annotateVerdicts with a readability filter', () => {
  test('hides Precedents the viewer cannot read and counts them without naming them', () => {
    const view = annotateVerdicts([conflict, related], EMPTY_RESOLUTIONS, new Set(['202']));

    expect(view.verdicts.map((v) => v.pageId)).toEqual(['202']);
    expect(view.hiddenCount).toBe(1);
    expect(view.openConflicts).toBe(0);
  });

  test('shows everything when no filter is given', () => {
    expect(annotateVerdicts([conflict, related], EMPTY_RESOLUTIONS).hiddenCount).toBe(0);
  });
});
