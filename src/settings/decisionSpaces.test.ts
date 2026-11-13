import { describe, expect, test } from 'vitest';
import { normalizeSpaceKeys } from './decisionSpaces';

describe('normalizeSpaceKeys', () => {
  test('keeps valid space keys, trimmed and de-duplicated, in order', () => {
    expect(normalizeSpaceKeys([' LUMENPAY', 'ENG', 'LUMENPAY', '~personal-1'])).toEqual(['LUMENPAY', 'ENG', '~personal-1']);
  });

  test('rejects an empty selection', () => {
    expect(() => normalizeSpaceKeys([])).toThrow('Choose at least one Decision Space');
  });

  test('rejects anything that is not a list of space keys', () => {
    expect(() => normalizeSpaceKeys('LUMENPAY')).toThrow('Invalid Decision Spaces');
    expect(() => normalizeSpaceKeys(['ok', 42])).toThrow('Invalid Decision Spaces');
    expect(() => normalizeSpaceKeys(['bad key"; DROP'])).toThrow('Invalid space key');
  });

  test('caps the number of spaces', () => {
    const many = Array.from({ length: 60 }, (_, i) => `S${i}`);

    expect(() => normalizeSpaceKeys(many)).toThrow('at most 50');
  });
});
