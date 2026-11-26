/**
 * Rovo actions for the Precedent agent. They reuse the same services as the
 * issue panel, so the agent can never do anything the panel can't — and every
 * answer is filtered to Decisions the asking user can read.
 */
import { NeedsAuthenticationError } from '@forge/api';
import { rankCandidates } from '../check/rank';
import { checkProposal } from '../check/service';
import { fetchDecisionRecords, getDecisionSpaces } from '../check/site';
import { forgeResolution, readableDecisionIds } from '../resolve/forgeSite';
import type { Viewer } from '../resolve/resolution';
import type { ResolutionView } from '../resolve/resolutions';
import { findVerdictByTitle, formatCheckForAgent, formatPrecedents } from './format';
import { resolveIssueKey, wantsRecheck } from './inputs';

const MAX_TOPIC_LENGTH = 300;

interface ActionPayload {
  readonly [input: string]: unknown;
  readonly context?: { readonly jira?: { readonly issueKey?: string }; readonly accountId?: string };
}
interface ActionContext {
  readonly accountId?: string;
  readonly principal?: { readonly accountId?: string };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function issueKeyFrom(payload: ActionPayload): string {
  return resolveIssueKey(payload.issueKey, payload.context?.jira?.issueKey);
}

/** The docs place the caller's accountId "in the context"; accept the known shapes, never an input. */
function accountIdFrom(payload: ActionPayload, context: ActionContext | undefined): string {
  const id = context?.accountId ?? context?.principal?.accountId ?? payload.context?.accountId;
  if (!id) {
    console.warn('Precedent: no accountId; context keys:', Object.keys(context ?? {}), 'payload.context keys:', Object.keys(payload.context ?? {}));
    throw new Error('I could not identify who is asking, so I will not change anything.');
  }
  return id;
}

async function safely(action: string, work: () => Promise<string>): Promise<string> {
  try {
    const answer = await work();
    console.info(`Precedent action ${action} answered (${answer.length} chars)`);
    return answer;
  } catch (error: unknown) {
    // Missing consent must escape so Forge can ask the Viewer to "Allow access";
    // swallowing it would make every as-Viewer check look like "no access".
    if (error instanceof NeedsAuthenticationError) throw error;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error(`Precedent action ${action} failed:`, message);
    return `Precedent could not complete that: ${message}`;
  }
}

export function findPrecedentsAction(payload: ActionPayload): Promise<string> {
  return safely('find-precedents', async () => {
    const topic = str(payload.topic).slice(0, MAX_TOPIC_LENGTH);
    if (!topic) return 'What topic should I look for decisions about?';

    const records = await fetchDecisionRecords(await getDecisionSpaces());
    const ranked = rankCandidates({ issueKey: 'topic', summary: topic, description: '' }, records);
    const readable = await readableDecisionIds(ranked.map((r) => r.pageId));
    return formatPrecedents(topic, ranked.filter((r) => readable.has(r.pageId)));
  });
}

function viewerFrom(payload: ActionPayload, context: ActionContext | undefined): Viewer {
  return { accountId: accountIdFrom(payload, context) };
}

export function checkProposalAction(payload: ActionPayload, context?: ActionContext): Promise<string> {
  return safely('check-proposal', async () => {
    const issueKey = issueKeyFrom(payload);
    const viewer = viewerFrom(payload, context);
    // viewFor first: it refuses issues the Viewer can't open, before any (paid) LLM check runs.
    let view = await forgeResolution.viewFor(issueKey, viewer);
    // A fresh Check when asked for one; otherwise only if the issue was never checked.
    const recheck = wantsRecheck(payload.recheck);
    if (recheck || !view.isChecked) {
      await checkProposal(issueKey, { force: recheck });
      view = await forgeResolution.viewFor(issueKey, viewer);
    }
    return formatCheckForAgent(issueKey, view);
  });
}

/** Chat names Decisions by title; matching that title to one open Conflict is this adapter's job. */
async function resolveByTitle(
  payload: ActionPayload,
  context: ActionContext | undefined,
  kind: 'Acknowledge' | 'Supersede'
): Promise<{ view: ResolutionView; title: string; pageId: string }> {
  const issueKey = issueKeyFrom(payload);
  const viewer = viewerFrom(payload, context);
  const current = await forgeResolution.viewFor(issueKey, viewer);
  const openConflicts = current.verdicts.filter((v) => v.verdict === 'Conflicts' && !v.resolution);
  const target = findVerdictByTitle(openConflicts, str(payload.decisionTitle)) ?? (openConflicts.length === 1 ? openConflicts[0] : undefined);
  if (!target) {
    const names = openConflicts.map((v) => `"${v.title}"`).join(', ') || 'none';
    throw new Error(`Which decision? Open conflicts on ${issueKey}: ${names}.`);
  }
  const view = await forgeResolution.resolve(issueKey, viewer, { kind, pageId: target.pageId });
  return { view, title: target.title, pageId: target.pageId };
}

export function acknowledgeConflictAction(payload: ActionPayload, context?: ActionContext): Promise<string> {
  return safely('acknowledge-conflict', async () => {
    const { title } = await resolveByTitle(payload, context, 'Acknowledge');
    return `Acknowledged: ${issueKeyFrom(payload)} respects the decision "${title}". The issue now links to the decision page.`;
  });
}

export function draftSupersessionAction(payload: ActionPayload, context?: ActionContext): Promise<string> {
  return safely('draft-supersession', async () => {
    const result = await resolveByTitle(payload, context, 'Supersede');
    const draft = result.view.drafts[result.pageId];
    return (
      `Drafted a Proposed decision to supersede "${result.title}"${draft ? ` (${draft})` : ''}. ` +
      'The original stays Accepted until someone rewrites the draft and sets it to Accepted; a note was left on the original decision.'
    );
  });
}
