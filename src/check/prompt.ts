/**
 * Prompts for Forge LLM. Classification uses a forced tool call so the model
 * returns structured Verdicts that parseVerdicts() can validate.
 */
import type { Prompt, ToolSchema } from '@forge/llm';
import { proposalText } from './proposal';
import type { CitedVerdict, DecisionRecord, Proposal } from './types';

export const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001';
export const EXPLAIN_MODEL = 'claude-sonnet-4-6';
export const RECORD_TOOL = 'record_verdicts';

const CLASSIFY_SYSTEM = `You check planned engineering work (a "Proposal") against decisions a team has already made.
For EACH candidate decision, choose exactly one verdict:
- "Conflicts": doing the Proposal as written would contradict the decision or reopen it (e.g. adopting something the decision rules out, or violating a constraint it sets).
- "Related": the Proposal is about the same topic and is consistent with the decision, or follows it.
- "None": the decision is not meaningfully about what the Proposal does.
Rules:
- Be precise. Shared words alone are not enough for Conflicts or Related.
- "citation" MUST be copied word-for-word from the decision's Statement: a short contiguous phrase (5-25 words) that shows why the verdict applies. Never paraphrase.
- "reason" is one sentence, written for the engineer who filed the Proposal.
- Return one entry per candidate decision via the ${RECORD_TOOL} tool.`;

const RECORD_SCHEMA: ToolSchema = {
  type: 'function',
  function: {
    name: RECORD_TOOL,
    description: 'Record one verdict per candidate decision.',
    parameters: {
      type: 'object',
      properties: {
        verdicts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              decision_id: { type: 'string' },
              verdict: { type: 'string', enum: ['Conflicts', 'Related', 'None'] },
              citation: { type: 'string', description: 'Exact words from the decision Statement.' },
              reason: { type: 'string' },
            },
            required: ['decision_id', 'verdict', 'citation', 'reason'],
          },
        },
      },
      required: ['verdicts'],
    },
  },
};

/** The id is only for the classifier to reference; humans see titles, never page ids. */
function describeDecision(record: DecisionRecord, options: { withId: boolean } = { withId: true }): string {
  const d = record.decision;
  return [
    options.withId ? `<decision id="${record.pageId}">` : '<decision>',
    `Title: ${d.title}`,
    `Statement: ${d.statement}`,
    `Rationale: ${d.rationale}`,
    `Tags: ${d.tags.join(', ')}`,
    '</decision>',
  ].join('\n');
}

export function buildClassifyPrompt(proposal: Proposal, candidates: readonly DecisionRecord[]): Prompt {
  return {
    model: CLASSIFY_MODEL,
    temperature: 0,
    max_completion_tokens: 1500,
    messages: [
      { role: 'system', content: CLASSIFY_SYSTEM },
      {
        role: 'user',
        content: `<proposal>\n${proposalText(proposal)}\n</proposal>\n\n${candidates.map((c) => describeDecision(c)).join('\n\n')}`,
      },
    ],
    tools: [RECORD_SCHEMA],
    tool_choice: { type: 'function', function: { name: RECORD_TOOL } },
  };
}

const EXPLAIN_SYSTEM = `You help an engineer whose planned work conflicts with a decision their team already made.
In 2-3 short sentences: say what was decided and why (from the rationale), say concretely how the Proposal collides with it,
and name the two honest options: change the work to respect the decision, or deliberately propose superseding it.
Refer to the decision by its title in quotes. Plain text, no headings, no bullet points, no flattery.`;

export function buildExplainPrompt(proposal: Proposal, record: DecisionRecord, verdict: CitedVerdict): Prompt {
  return {
    model: EXPLAIN_MODEL,
    temperature: 0.2,
    max_completion_tokens: 300,
    messages: [
      { role: 'system', content: EXPLAIN_SYSTEM },
      {
        role: 'user',
        content: `<proposal>\n${proposalText(proposal)}\n</proposal>\n\n${describeDecision(record, { withId: false })}\nDecided on ${record.decision.decidedOn} by ${record.decision.deciders.join(', ')}.\n\nWhy it conflicts: ${verdict.reason}`,
      },
    ],
  };
}
