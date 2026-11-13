import { createHash } from 'node:crypto';
import type { Proposal } from './types';

/** ADF node types whose children are inline text and should be concatenated. */
const INLINE_CONTAINERS = new Set(['paragraph', 'heading', 'codeBlock']);

interface AdfNode {
  readonly type?: unknown;
  readonly text?: unknown;
  readonly content?: unknown;
}

function isNode(value: unknown): value is AdfNode {
  return typeof value === 'object' && value !== null;
}

/** Extracts readable text from an Atlassian Document Format value. */
export function adfToText(adf: unknown): string {
  if (typeof adf === 'string') return adf;
  if (!isNode(adf)) return '';
  if (adf.type === 'text' && typeof adf.text === 'string') return adf.text;
  if (!Array.isArray(adf.content)) return '';

  const parts = adf.content.map(adfToText);
  return INLINE_CONTAINERS.has(String(adf.type))
    ? parts.join('')
    : parts.filter((part) => part.length > 0).join('\n');
}

export function proposalText(proposal: Proposal): string {
  return `${proposal.summary}\n\n${proposal.description}`;
}

/** Hash of what a Verdict depends on; unchanged text means no re-check. */
export function contentHash(proposal: Proposal): string {
  return createHash('sha256')
    .update(`${proposal.summary.trim()}\n${proposal.description.trim()}`)
    .digest('hex');
}
