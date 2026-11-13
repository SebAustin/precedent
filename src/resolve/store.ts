/**
 * Resolutions are stored as an issue property so they survive re-checks.
 */
import api, { route } from '@forge/api';
import { expectOk } from '../confluence/decisionPages';
import { EMPTY_RESOLUTIONS, type ResolutionState } from './resolutions';

export const RESOLUTIONS_PROPERTY = 'precedent-resolutions';
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export async function readResolutions(issueKey: string): Promise<ResolutionState> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${RESOLUTIONS_PROPERTY}`);
  if (res.status === 404) return EMPTY_RESOLUTIONS;
  await expectOk(res, `Read resolutions for ${issueKey}`);
  const { value } = (await res.json()) as { value: ResolutionState };
  return value?.version === 1 ? value : EMPTY_RESOLUTIONS;
}

export async function writeResolutions(issueKey: string, state: ResolutionState): Promise<void> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${RESOLUTIONS_PROPERTY}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(state),
  });
  await expectOk(res, `Store resolution for ${issueKey}`);
}

