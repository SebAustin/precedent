import { describe, expect, test } from 'vitest';
import { resolveIssueKey, wantsRecheck } from './inputs';

describe('resolveIssueKey', () => {
  test('an issue the user names wins over the issue the chat was opened on', () => {
    expect(resolveIssueKey('lumenpay-14', 'LUMENPAY-1')).toBe('LUMENPAY-14');
  });

  test('falls back to the issue in context when none is named', () => {
    expect(resolveIssueKey('', 'LUMENPAY-1')).toBe('LUMENPAY-1');
    expect(resolveIssueKey(undefined, 'LUMENPAY-1')).toBe('LUMENPAY-1');
  });

  test('rejects anything that is not an issue key', () => {
    expect(() => resolveIssueKey('the mongo one', undefined)).toThrow('Tell me which Jira issue');
    expect(() => resolveIssueKey(undefined, undefined)).toThrow('Tell me which Jira issue');
  });
});

describe('wantsRecheck', () => {
  test('accepts a true boolean or the strings Rovo may send for one', () => {
    for (const yes of [true, 'true', 'TRUE', ' yes ']) expect(wantsRecheck(yes)).toBe(true);
  });

  test('treats anything else, including a missing input, as no', () => {
    for (const no of [undefined, null, false, 'false', 'no', '', 1]) expect(wantsRecheck(no)).toBe(false);
  });
});
