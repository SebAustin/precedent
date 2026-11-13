import { describe, expect, test } from 'vitest';
import { type IssueReference, groupReferences, referencesTitle } from './references';

const ref = (key: string, kind: IssueReference['kind'], resolution?: IssueReference['resolution']): IssueReference => ({
  key,
  summary: `Summary ${key}`,
  status: 'To Do',
  kind,
  resolution,
});

describe('groupReferences', () => {
  test('groups conflicting issues by how they were resolved, and lists related issues', () => {
    const groups = groupReferences([
      ref('LP-1', 'Conflicts'),
      ref('LP-2', 'Conflicts', 'Acknowledge'),
      ref('LP-3', 'Conflicts', 'Supersede'),
      ref('LP-4', 'Conflicts', 'Dismiss'),
      ref('LP-5', 'Related'),
    ]);

    expect(groups.open.map((r) => r.key)).toEqual(['LP-1']);
    expect(groups.acknowledged.map((r) => r.key)).toEqual(['LP-2']);
    expect(groups.superseding.map((r) => r.key)).toEqual(['LP-3']);
    expect(groups.dismissed.map((r) => r.key)).toEqual(['LP-4']);
    expect(groups.related.map((r) => r.key)).toEqual(['LP-5']);
  });
});

describe('referencesTitle', () => {
  test('highlights how often a Decision has been challenged', () => {
    expect(referencesTitle(3, 1)).toBe('Precedent · challenged by 3 issues');
    expect(referencesTitle(1, 0)).toBe('Precedent · challenged by 1 issue');
  });

  test('falls back to related references, then to the plain name', () => {
    expect(referencesTitle(0, 2)).toBe('Precedent · 2 related issues');
    expect(referencesTitle(0, 0)).toBe('Precedent');
  });
});
