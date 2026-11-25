/**
 * Confluence trigger that completes a Supersession: when a replacement Decision
 * is set to Accepted, the Decision it names in "Supersedes" is marked
 * Superseded. Runs as the app (a trigger has no Viewer). The rule itself is the
 * pure `completeSupersession` in rules.ts; this module only does the I/O.
 */
import { findDecisionPageIdByTitle, readDecisionPage, setDecisionStatus } from '../confluence/decisionPages';
import { completeSupersession } from './rules';

export async function onDecisionPageUpdated(event: { content?: { id?: string | number } }): Promise<void> {
  const pageId = event.content?.id;
  if (pageId === undefined) return;

  try {
    const replacement = await readDecisionPage('app', String(pageId));
    if (!replacement.parsed.ok || !replacement.parsed.decision.supersedes) return;

    const oldId = await findDecisionPageIdByTitle('app', replacement.spaceId, replacement.parsed.decision.supersedes);
    if (!oldId) return;

    const old = await readDecisionPage('app', oldId);
    if (!old.parsed.ok) return;
    if (!completeSupersession(replacement.parsed.decision, old.parsed.decision)) return;

    await setDecisionStatus('app', old, 'Superseded', `Superseded by "${replacement.title}" (Precedent)`);
    console.info(`Precedent: "${old.title}" is now Superseded by "${replacement.title}"`);
  } catch (error: unknown) {
    console.error('Precedent: supersession completion failed', error instanceof Error ? error.message : error);
  }
}
