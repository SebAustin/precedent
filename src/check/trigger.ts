/**
 * Product-event trigger: checks an issue whenever it is created or edited.
 * The content hash makes repeated events (including our own property writes)
 * cheap no-ops.
 */
import { checkProposal } from './service';

interface IssueEvent {
  readonly issue?: { readonly key?: string };
}

export async function onIssueEvent(event: IssueEvent): Promise<void> {
  const issueKey = event.issue?.key;
  if (!issueKey) return;

  try {
    const result = await checkProposal(issueKey);
    console.info(`Precedent checked ${issueKey}: ${result.verdicts.length} verdict(s)`);
  } catch (error: unknown) {
    console.error(`Precedent check failed for ${issueKey}:`, error instanceof Error ? error.message : error);
  }
}
