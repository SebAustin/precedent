/**
 * Forge LLM calls. Kept tiny so the rest of the pipeline stays testable.
 */
import { chat } from '@forge/llm';
import { buildClassifyPrompt, buildExplainPrompt, RECORD_TOOL } from './prompt';
import { parseVerdicts } from './verdicts';
import type { CitedVerdict, DecisionRecord, Proposal } from './types';

/**
 * The classifier did not produce a usable answer. A failed Check must never be
 * stored as "no Verdicts" (GLOSSARY.md: a failed Check never replaces the last
 * completed one), so this is thrown rather than returning an empty list.
 */
export class CheckFailedError extends Error {
  constructor(reason: string) {
    super(`Precedent couldn't finish checking this issue (${reason}). Try "Check again".`);
    this.name = 'CheckFailedError';
  }
}

export async function classify(proposal: Proposal, candidates: readonly DecisionRecord[]): Promise<CitedVerdict[]> {
  const response = await chat(buildClassifyPrompt(proposal, candidates));
  const toolCall = response.choices[0]?.message.tool_calls?.find((c) => c.function.name === RECORD_TOOL);
  if (!toolCall) {
    throw new CheckFailedError(`no verdicts returned, finish reason: ${response.choices[0]?.finish_reason ?? 'unknown'}`);
  }
  return parseVerdicts(toolCall.function.arguments, candidates, (why) =>
    console.warn(`Precedent: rejected verdict for ${proposal.issueKey}: ${why}`)
  );
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: { text?: unknown }) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

export async function explainConflict(
  proposal: Proposal,
  record: DecisionRecord,
  verdict: CitedVerdict
): Promise<string | undefined> {
  try {
    const response = await chat(buildExplainPrompt(proposal, record, verdict));
    const text = textOf(response.choices[0]?.message.content);
    return text.length > 0 ? text : undefined;
  } catch (error: unknown) {
    // The Verdict and Citation stand on their own; the explanation is a bonus.
    console.warn('Precedent: explanation failed', error instanceof Error ? error.message : error);
    return undefined;
  }
}
