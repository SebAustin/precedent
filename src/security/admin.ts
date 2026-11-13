/**
 * Admin-only operations (seeding, evaluation, settings) share one resolver
 * function with the issue panel, so every admin resolver checks both where the
 * call came from and that the caller really is a Jira administrator.
 */
import api, { route } from '@forge/api';

export const ADMIN_MODULE_KEY = 'precedent-admin';

export function isAdminModuleContext(context: { moduleKey?: unknown } | undefined): boolean {
  return context?.moduleKey === ADMIN_MODULE_KEY;
}

export async function assertCurrentUserIsJiraAdmin(): Promise<void> {
  const res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  if (!res.ok) throw new Error(`Check Jira admin permission failed (HTTP ${res.status}).`);
  const { permissions } = (await res.json()) as { permissions: { ADMINISTER?: { havePermission: boolean } } };
  if (!permissions.ADMINISTER?.havePermission) {
    throw new Error('Only Jira administrators can do this.');
  }
}

export async function assertAdminCall(context: { moduleKey?: unknown } | undefined): Promise<void> {
  if (!isAdminModuleContext(context)) throw new Error('This action is only available from the Precedent admin page.');
  await assertCurrentUserIsJiraAdmin();
}
