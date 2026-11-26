/**
 * The Resolution module: everything a Viewer can see of an issue's check, and
 * every way they can resolve a Conflict, behind two calls.
 *
 *   viewFor(issueKey, viewer)          → ResolutionView
 *   resolve(issueKey, viewer, request) → ResolutionView (after recording)
 *
 * Both entry points (the issue panel resolver and the Rovo actions) are thin
 * adapters over this module, so the rules live here once:
 * - The Viewer must be able to open the issue (CannotAccessIssue).
 * - Decisions the Viewer can't read are never returned, only counted.
 * - Every Resolution kind first reads the Decision as the Viewer
 *   (CannotAccessDecision) — before validation, so a hidden Decision can't be
 *   probed — then validation runs before any write.
 * - A Lapsed Verdict (its Decision is no longer a Precedent) is shown but never
 *   resolvable (DecisionLapsed).
 * - A Resolution is final (AlreadyResolved).
 * - Supersede: create the draft → record the Resolution → then, best effort,
 *   note it on the original Decision and link the issue to the draft.
 *
 * Outside operations go through the ResolutionSite seam (site.ts). Errors from
 * the site — including Forge's consent error — pass through untouched.
 */
import { draftSupersedingDecision } from '../supersession/rules';
import { ResolutionError } from './errors';
import { type Resolution, type ResolutionKind, type ResolutionView, buildView, recordResolution } from './resolutions';
import type { DecisionRef, ResolutionSite } from './site';

export interface Viewer {
  readonly accountId: string;
}

export interface ResolveRequest {
  readonly kind: ResolutionKind;
  readonly pageId: string;
  /** The reason, required for Dismiss. */
  readonly note?: string;
}

export interface ResolutionModule {
  viewFor(issueKey: string, viewer: Viewer): Promise<ResolutionView>;
  resolve(issueKey: string, viewer: Viewer, request: ResolveRequest): Promise<ResolutionView>;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function supersedeNote(issueKey: string, draftTitle: string): string {
  return (
    `<p><strong>Precedent:</strong> ${issueKey} proposes superseding this decision. A Proposed replacement was drafted: ` +
    `<ac:link><ri:page ri:content-title="${escapeAttribute(draftTitle)}" /></ac:link>. ` +
    'This decision stays Accepted until the replacement is set to Accepted.</p>'
  );
}

/** Runs a notification step whose failure must not undo an already recorded Resolution. */
async function bestEffort(what: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error: unknown) {
    console.warn(`Precedent: ${what} failed after the Resolution was recorded`, error instanceof Error ? error.message : error);
  }
}

export function createResolution(site: ResolutionSite): ResolutionModule {
  async function requireIssue(issueKey: string): Promise<void> {
    if (!(await site.canViewIssue(issueKey))) throw new ResolutionError('CannotAccessIssue');
  }

  async function currentView(issueKey: string): Promise<ResolutionView> {
    const { check, resolutions, failure } = await site.readRecord(issueKey);
    const pageIds = [...new Set((check?.verdicts ?? []).map((v) => v.pageId))];
    return buildView(check, resolutions, await site.readDecisionStandings(pageIds), failure);
  }

  async function readableDecision(pageId: string): Promise<DecisionRef> {
    const decision = await site.readDecision(pageId);
    if (!decision) throw new ResolutionError('CannotAccessDecision');
    return decision;
  }

  /** Creates the draft replacement; returns the Resolution to store plus what the notes need. */
  async function draftReplacement(issueKey: string, old: DecisionRef, base: Resolution) {
    if (!old.decision) throw new Error(`"${old.title}" is not a well-formed Decision page.`);
    const proposal = await site.readProposal(issueKey);
    const draft = draftSupersedingDecision(old.decision, proposal, base.at.slice(0, 10));
    const created = await site.createDraft(old.spaceId, draft);
    const stored: Resolution = { ...base, draftPageId: created.id };
    return { stored, id: created.id, title: draft.title, url: created.url };
  }

  return {
    async viewFor(issueKey) {
      await requireIssue(issueKey);
      return currentView(issueKey);
    },

    async resolve(issueKey, viewer, request) {
      await requireIssue(issueKey);
      const { check, resolutions } = await site.readRecord(issueKey);
      const verdicts = check?.verdicts ?? [];
      const base: Resolution = {
        kind: request.kind,
        pageId: request.pageId,
        accountId: viewer.accountId,
        at: site.now().toISOString(),
        ...(request.note ? { note: request.note } : {}),
      };

      const decision = await readableDecision(request.pageId);
      // A Decision that stopped being a Precedent since the Check can't be resolved against.
      if (decision.decision?.status !== 'Accepted') throw new ResolutionError('DecisionLapsed');
      recordResolution(resolutions, verdicts, base); // validate before any write

      if (request.kind === 'Acknowledge') {
        if (decision.url) await site.linkIssue(issueKey, { pageId: decision.id, title: decision.title, url: decision.url });
        await site.saveResolutions(issueKey, recordResolution(resolutions, verdicts, base));
      } else if (request.kind === 'Dismiss') {
        await site.saveResolutions(issueKey, recordResolution(resolutions, verdicts, base));
      } else {
        const draft = await draftReplacement(issueKey, decision, base);
        await site.saveResolutions(issueKey, recordResolution(resolutions, verdicts, draft.stored));
        await bestEffort('noting the supersession on the original Decision', () =>
          site.commentOnDecision(decision.id, supersedeNote(issueKey, draft.title))
        );
        await bestEffort('linking the issue to the draft', async () => {
          if (draft.url) await site.linkIssue(issueKey, { pageId: draft.id, title: draft.title, url: draft.url });
        });
      }

      return currentView(issueKey);
    },
  };
}
