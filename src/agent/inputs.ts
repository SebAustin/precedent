/**
 * Which issue an agent action should act on. Rovo's chat context is the page
 * the chat was opened from, which may not be the issue the user is talking
 * about — so an issue the user names always wins.
 */
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

export function resolveIssueKey(named: unknown, contextKey: unknown): string {
  const explicit = typeof named === 'string' ? named.trim().toUpperCase() : '';
  const key = explicit || (typeof contextKey === 'string' ? contextKey.trim() : '');
  if (!ISSUE_KEY.test(key)) throw new Error('Tell me which Jira issue to look at (for example LUMENPAY-1).');
  return key;
}

/**
 * The optional `recheck` input on check-proposal. Rovo may send a boolean or
 * its text form, so both are accepted; anything else means "use the stored Check".
 */
export function wantsRecheck(value: unknown): boolean {
  if (value === true) return true;
  return typeof value === 'string' && ['true', 'yes'].includes(value.trim().toLowerCase());
}
