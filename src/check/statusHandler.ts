/**
 * dynamicProperties handler for the jira:issueContext module: sets the status
 * lozenge next to "Precedent". Counts only — no Decision titles are exposed.
 * The counting rules live in the pure `statusCounts` (tested); this function
 * only does the reads and fails closed (no lozenge) on any error.
 */
import { readResolutions } from '../resolve/store';
import { type ContextStatus, contextStatus, statusCounts } from './contextStatus';
import { readCheckResult } from './site';

export async function issueContextStatus(payload: { extension?: { issue?: { key?: string } } }): Promise<ContextStatus> {
  const issueKey = payload.extension?.issue?.key;
  if (!issueKey) return {};
  try {
    const [check, state] = await Promise.all([readCheckResult(issueKey), readResolutions(issueKey)]);
    return contextStatus(statusCounts(check, state));
  } catch (error: unknown) {
    console.warn(`Precedent: status for ${issueKey} failed`, error instanceof Error ? error.message : error);
    return {};
  }
}
