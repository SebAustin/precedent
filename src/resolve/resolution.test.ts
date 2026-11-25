/**
 * Tests through the Resolution module's interface only (viewFor / resolve),
 * using the in-memory adapter. They describe behaviour a Viewer can observe,
 * so they survive refactors inside the module.
 */
import { describe, expect, test } from 'vitest';
import type { CheckResult, CitedVerdict } from '../check/types';
import type { Decision } from '../domain/decision';
import { ResolutionError } from './errors';
import { type MemoryDecision, memorySite } from './memorySite';
import { createResolution } from './resolution';
import type { ResolutionState } from './resolutions';

const ISSUE = 'LUMENPAY-1';
const viewer = { accountId: 'acc-viewer' };

const verdict = (pageId: string, title: string, kind: CitedVerdict['verdict']): CitedVerdict => ({
  pageId,
  title,
  verdict: kind,
  citation: `quote from ${title}`,
  reason: 'r',
  decidedOn: '2026-03-04',
  deciders: ['Priya Nair'],
});
const postgres = verdict('101', 'Postgres for all transactional data', 'Conflicts');
const rest = verdict('202', 'REST for public and partner APIs', 'Related');
const secret = verdict('303', 'Secret acquisition plan', 'Conflicts');

const check: CheckResult = {
  version: 1,
  contentHash: 'h',
  checkedAt: '2026-11-12T10:00:00.000Z',
  candidatesConsidered: 3,
  verdicts: [postgres, rest, secret],
};

const decisionBody = (title: string): Decision => ({
  title,
  statement: 'We will not adopt MongoDB.',
  rationale: 'ACID.',
  deciders: ['Priya Nair'],
  decidedOn: '2026-03-04',
  status: 'Accepted',
  tags: ['database'],
});
const decision = (id: string, title: string, readable: boolean): MemoryDecision => ({
  readable,
  ref: { id, title, spaceId: 'space-1', url: `https://site/wiki/${id}`, decision: decisionBody(title) },
});

function setup(overrides: { resolutions?: ResolutionState; checked?: boolean } = {}) {
  const site = memorySite({
    viewableIssues: [ISSUE],
    checks: overrides.checked === false ? {} : { [ISSUE]: check },
    resolutions: overrides.resolutions ? { [ISSUE]: overrides.resolutions } : {},
    decisions: [
      decision('101', postgres.title, true),
      decision('202', rest.title, true),
      decision('303', secret.title, false),
    ],
    proposals: { [ISSUE]: { issueKey: ISSUE, summary: 'Spike: store ledger events in MongoDB', description: 'Try it.' } },
  });
  return { site, resolution: createResolution(site) };
}

const expectCode = async (work: Promise<unknown>, code: ResolutionError['code']) => {
  await expect(work).rejects.toBeInstanceOf(ResolutionError);
  await expect(work).rejects.toMatchObject({ code });
};

describe('viewFor', () => {
  test('refuses an issue the Viewer cannot open', async () => {
    const { resolution } = setup();
    await expectCode(resolution.viewFor('SECRET-1', viewer), 'CannotAccessIssue');
  });

  test('reports an unchecked issue as unchecked', async () => {
    const view = await setup({ checked: false }).resolution.viewFor(ISSUE, viewer);
    expect(view).toMatchObject({ isChecked: false, checkedAt: null, verdicts: [] });
  });

  test('never reveals Decisions the Viewer cannot read — only counts them', async () => {
    const view = await setup().resolution.viewFor(ISSUE, viewer);

    expect(view.verdicts.map((v) => v.pageId)).toEqual(['101', '202']);
    expect(view.counts.hidden).toBe(1);
    expect(JSON.stringify(view)).not.toContain('Secret acquisition plan');
    expect(JSON.stringify(view)).not.toContain('303');
  });

  test('counts open Conflicts and Related Verdicts among what the Viewer can read', async () => {
    const view = await setup().resolution.viewFor(ISSUE, viewer);
    expect(view.counts).toEqual({ open: 1, resolved: 0, related: 1, dismissed: 0, hidden: 1 });
    expect(view).toMatchObject({ isChecked: true, checkedAt: check.checkedAt });
  });
});

describe('resolve', () => {
  test('Acknowledge links the issue to the Decision and records who resolved it and when', async () => {
    const { site, resolution } = setup();

    const view = await resolution.resolve(ISSUE, viewer, { kind: 'Acknowledge', pageId: '101' });

    expect(site.links).toEqual([
      { issueKey: ISSUE, link: { pageId: '101', title: postgres.title, url: 'https://site/wiki/101' } },
    ]);
    expect(site.saved.get(ISSUE)?.resolutions['101']).toEqual({
      kind: 'Acknowledge',
      pageId: '101',
      accountId: 'acc-viewer',
      at: '2026-11-25T10:00:00.000Z',
    });
    expect(view.counts).toMatchObject({ open: 0, resolved: 1 });
    expect(view.verdicts.find((v) => v.pageId === '101')?.resolution?.kind).toBe('Acknowledge');
  });

  test('Dismiss needs a reason, stores it trimmed, and hides the pair from then on', async () => {
    const { site, resolution } = setup();
    await expectCode(resolution.resolve(ISSUE, viewer, { kind: 'Dismiss', pageId: '101', note: '   ' }), 'ReasonRequired');

    const view = await resolution.resolve(ISSUE, viewer, { kind: 'Dismiss', pageId: '101', note: '  analytics copy only ' });

    expect(site.saved.get(ISSUE)?.resolutions['101']?.note).toBe('analytics copy only');
    expect(view.verdicts.map((v) => v.pageId)).toEqual(['202']);
    expect(view.counts).toMatchObject({ open: 0, resolved: 0, dismissed: 1 });
  });

  test('refuses every kind on a Decision the Viewer cannot read, and changes nothing', async () => {
    const { site, resolution } = setup();
    for (const kind of ['Acknowledge', 'Dismiss', 'Supersede'] as const) {
      await expectCode(resolution.resolve(ISSUE, viewer, { kind, pageId: '303', note: 'reason' }), 'CannotAccessDecision');
    }
    expect(site.saved.size).toBe(0);
    expect(site.drafts).toEqual([]);
  });

  test('refuses an issue the Viewer cannot open', async () => {
    const { resolution } = setup();
    await expectCode(resolution.resolve('SECRET-1', viewer, { kind: 'Acknowledge', pageId: '101' }), 'CannotAccessIssue');
  });

  test('only resolves Conflicts Verdicts of the current check', async () => {
    const { resolution } = setup();
    await expectCode(resolution.resolve(ISSUE, viewer, { kind: 'Acknowledge', pageId: '202' }), 'NotAConflict');
  });

  test('checks Decision access before anything else, so unknown or hidden ids look the same', async () => {
    const { resolution } = setup();
    await expectCode(resolution.resolve(ISSUE, viewer, { kind: 'Acknowledge', pageId: '999' }), 'CannotAccessDecision');
    await expectCode(resolution.resolve(ISSUE, viewer, { kind: 'Acknowledge', pageId: '303' }), 'CannotAccessDecision');
  });

  test('a Resolution is final: a second one is refused and creates no second draft', async () => {
    const { site, resolution } = setup();
    await resolution.resolve(ISSUE, viewer, { kind: 'Supersede', pageId: '101' });

    await expectCode(resolution.resolve(ISSUE, viewer, { kind: 'Supersede', pageId: '101' }), 'AlreadyResolved');
    await expectCode(resolution.resolve(ISSUE, viewer, { kind: 'Acknowledge', pageId: '101' }), 'AlreadyResolved');
    expect(site.drafts).toHaveLength(1);
  });

  test('Supersede drafts a Proposed replacement, records it, notes it on the original and links the issue', async () => {
    const { site, resolution } = setup();

    const view = await resolution.resolve(ISSUE, viewer, { kind: 'Supersede', pageId: '101' });

    expect(site.drafts).toHaveLength(1);
    const draft = site.drafts[0];
    expect(draft.spaceId).toBe('space-1');
    expect(draft.decision).toMatchObject({
      title: `Revisit: ${postgres.title} (${ISSUE})`,
      status: 'Proposed',
      supersedes: postgres.title,
    });
    expect(site.saved.get(ISSUE)?.resolutions['101']).toMatchObject({ kind: 'Supersede', draftPageId: draft.id });
    expect(site.comments.map((c) => c.pageId)).toEqual(['101']);
    expect(site.comments[0].html).toContain(`${ISSUE} proposes superseding this decision`);
    expect(site.links.map((l) => l.link.pageId)).toEqual([draft.id]);
    expect(view.drafts['101']).toContain(draft.id);
  });

  test('Supersede keeps the recorded Resolution when the note or the link fails afterwards', async () => {
    const { site, resolution } = setup();
    site.failOn('commentOnDecision');
    site.failOn('linkIssue');

    const view = await resolution.resolve(ISSUE, viewer, { kind: 'Supersede', pageId: '101' });

    expect(site.saved.get(ISSUE)?.resolutions['101']?.kind).toBe('Supersede');
    expect(view.counts.resolved).toBe(1);
  });

  test('Supersede records nothing when the draft cannot be created', async () => {
    const { site, resolution } = setup();
    site.failOn('createDraft');

    await expect(resolution.resolve(ISSUE, viewer, { kind: 'Supersede', pageId: '101' })).rejects.toThrow('createDraft failed');
    expect(site.saved.size).toBe(0);
  });

  test('passes adapter errors through untouched (e.g. Forge consent errors)', async () => {
    const { site, resolution } = setup();
    const consent = new Error('needs consent');
    site.readDecision = async () => {
      throw consent;
    };

    await expect(resolution.resolve(ISSUE, viewer, { kind: 'Acknowledge', pageId: '101' })).rejects.toBe(consent);
  });
});
