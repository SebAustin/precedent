import { describe, expect, test } from 'vitest';
import { ADMIN_MODULE_KEY, isAdminModuleContext } from './admin';

describe('isAdminModuleContext', () => {
  test('accepts calls made from the Precedent admin page', () => {
    expect(isAdminModuleContext({ moduleKey: ADMIN_MODULE_KEY })).toBe(true);
  });

  test('rejects calls from the issue panel or with no module', () => {
    expect(isAdminModuleContext({ moduleKey: 'precedent-issue-context' })).toBe(false);
    expect(isAdminModuleContext({})).toBe(false);
    expect(isAdminModuleContext(undefined)).toBe(false);
  });
});
