/**
 * Orchestrates the Sample Workspace: one seed step per call, so each resolver
 * invocation stays far below Forge's function timeout and the UI can show
 * real progress. Re-reading the site each step makes every call idempotent.
 */
import { type WorkspaceSummary, computeRemovePlan, computeSeedPlan, summarizeWorkspace } from './plan';
import { executeRemoveAction, executeSeedAction, readSnapshot } from './siteGateway';

export async function getSampleWorkspace(): Promise<WorkspaceSummary> {
  const { state } = await readSnapshot();
  return summarizeWorkspace(state);
}

export async function seedNextItem(): Promise<WorkspaceSummary> {
  const snapshot = await readSnapshot();
  const plan = computeSeedPlan(snapshot.state);
  if (plan.status === 'blocked' || plan.actions.length === 0) {
    return summarizeWorkspace(snapshot.state);
  }

  await executeSeedAction(plan.actions[0], snapshot);
  return getSampleWorkspace();
}

export async function removeSampleWorkspace(): Promise<WorkspaceSummary> {
  const { state } = await readSnapshot();
  const plan = computeRemovePlan(state);
  if (plan.status === 'ready') {
    for (const action of plan.actions) {
      await executeRemoveAction(action);
    }
  }
  return getSampleWorkspace();
}
