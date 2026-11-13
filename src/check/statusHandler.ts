/**
 * dynamicProperties handler for the jira:issueContext module: sets the status
 * lozenge next to "Precedent". Counts only — no Decision titles are exposed.
 */
import { readResolutions } from '../resolve/store';
import { type ContextStatus, contextStatus } from './contextStatus';
import { readCheckResult } from './site';

export async function issueContextStatus(payload: { extension?: { issue?: { key?: string } } }): Promise<ContextStatus> {
  const issueKey = payload.extension?.issue?.key;
  if (!issueKey) return {};
  try {
    const [check, state] = await Promise.all([readCheckResult(issueKey), readResolutions(issueKey)]);
    const verdicts = check?.verdicts ?? [];
    const conflicts = verdicts.filter((v) => v.verdict === 'Conflicts' && state.resolutions[v.pageId]?.kind !== 'Dismiss');
    return contextStatus({
      isChecked: check !== null,
      openConflicts: conflicts.filter((v) => !state.resolutions[v.pageId]).length,
      resolvedConflicts: conflicts.filter((v) => state.resolutions[v.pageId]).length,
      related: verdicts.filter((v) => v.verdict === 'Related').length,
    });
  } catch (error: unknown) {
    console.warn(`Precedent: status for ${issueKey} failed`, error instanceof Error ? error.message : error);
    return {};
  }
}
