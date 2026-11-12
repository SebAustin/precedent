import { NeedsAuthenticationError } from '@forge/api';
import { describe, expect, test, vi } from 'vitest';
import { attempt } from './result';

describe('attempt', () => {
  test('wraps a successful result', async () => {
    await expect(attempt(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  test('turns ordinary failures into an error envelope the UI can show', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(attempt(async () => Promise.reject(new Error('HTTP 500')))).resolves.toEqual({
      ok: false,
      error: 'HTTP 500',
    });
  });

  test('rethrows NeedsAuthenticationError so Forge can show the user-consent prompt', async () => {
    const consentNeeded = new NeedsAuthenticationError('Authentication Required', 'atlassian-token-service-key');

    await expect(attempt(async () => Promise.reject(consentNeeded))).rejects.toBe(consentNeeded);
  });
});
