import { describe, expect, test } from 'vitest';
import { contextStatus } from './contextStatus';

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
