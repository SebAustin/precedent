import { describe, expect, test } from 'vitest';
import { EMPTY_RESOLUTIONS, type Resolution, type ResolutionState } from '../resolve/resolutions';
import { contextStatus, statusCounts } from './contextStatus';
import type { CheckResult, CitedVerdict } from './types';

const conflict = (pageId: string): CitedVerdict => ({
  pageId,
  title: `Decision ${pageId}`,
  verdict: 'Conflicts',
  citation: 'quote',
  reason: 'r',
  decidedOn: '2026-03-04',
  deciders: ['Priya Nair'],
});
const related = (pageId: string): CitedVerdict => ({ ...conflict(pageId), verdict: 'Related' });

const checked = (verdicts: CitedVerdict[]): CheckResult => ({
  version: 1,
  contentHash: 'h',
  checkedAt: '2026-11-12T10:00:00.000Z',
  candidatesConsidered: verdicts.length,
  verdicts,
});

const resolved = (...entries: [string, Resolution['kind']][]): ResolutionState => ({
  version: 1,
  resolutions: Object.fromEntries(
    entries.map(([pageId, kind]) => [pageId, { kind, pageId, accountId: 'acc-1', at: '2026-11-12T10:00:00.000Z' }])
  ),
});

describe('statusCounts', () => {
  test('reports an unchecked issue as unchecked, with nothing counted', () => {
    expect(statusCounts(null, EMPTY_RESOLUTIONS)).toEqual({
      isChecked: false,
      openConflicts: 0,
      resolvedConflicts: 0,
      related: 0,
    });
  });

  test('counts unresolved Conflicts as open and Related verdicts separately', () => {
    expect(statusCounts(checked([conflict('1'), conflict('2'), related('3')]), EMPTY_RESOLUTIONS)).toEqual({
      isChecked: true,
      openConflicts: 2,
      resolvedConflicts: 0,
      related: 1,
    });
  });

  test('counts acknowledged and superseded Conflicts as resolved', () => {
    const counts = statusCounts(
      checked([conflict('1'), conflict('2'), conflict('3')]),
      resolved(['1', 'Acknowledge'], ['2', 'Supersede'])
    );
    expect(counts).toMatchObject({ openConflicts: 1, resolvedConflicts: 2 });
  });

  test('leaves dismissed Conflicts out entirely, so they never turn the lozenge red or green', () => {
    expect(statusCounts(checked([conflict('1')]), resolved(['1', 'Dismiss']))).toMatchObject({
      isChecked: true,
      openConflicts: 0,
      resolvedConflicts: 0,
    });
  });

  test('ignores resolutions for Decisions the latest check no longer flags', () => {
    expect(statusCounts(checked([related('9')]), resolved(['1', 'Acknowledge']))).toMatchObject({
      openConflicts: 0,
      resolvedConflicts: 0,
      related: 1,
    });
  });
});

describe('contextStatus', () => {
  test('shows open conflicts loudly', () => {
    expect(contextStatus({ openConflicts: 2, resolvedConflicts: 0, related: 1, isChecked: true })).toEqual({
      status: { type: 'lozenge', value: { label: '2 conflicts', type: 'removed' } },
    });
    expect(contextStatus({ openConflicts: 1, resolvedConflicts: 0, related: 0, isChecked: true }).status?.value.label).toBe(
      '1 conflict'
    );
  });

  test('shows resolved and related states quietly', () => {
    expect(contextStatus({ openConflicts: 0, resolvedConflicts: 1, related: 0, isChecked: true }).status?.value).toEqual({
      label: 'Resolved',
      type: 'success',
    });
    expect(contextStatus({ openConflicts: 0, resolvedConflicts: 0, related: 3, isChecked: true }).status?.value).toEqual({
      label: '3 related',
      type: 'inprogress',
    });
  });

  test('shows a neutral state for clean or unchecked issues', () => {
    expect(contextStatus({ openConflicts: 0, resolvedConflicts: 0, related: 0, isChecked: true }).status?.value).toEqual({
      label: 'Clear',
      type: 'default',
    });
    expect(contextStatus({ openConflicts: 0, resolvedConflicts: 0, related: 0, isChecked: false })).toEqual({});
  });
});

describe('Lapsed Verdicts in the lozenge', () => {
  test('a Conflict the last Check marked Lapsed is not counted as open', () => {
    const lapsed: CitedVerdict = { ...conflict('1'), lapsed: { reason: 'Superseded' } };
    expect(contextStatus(statusCounts(checked([lapsed]), EMPTY_RESOLUTIONS))).toEqual({
      status: { type: 'lozenge', value: { label: 'Clear', type: 'default' } },
    });
  });
});
