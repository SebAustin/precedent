import { describe, expect, test } from 'vitest';
import { SAMPLE_DECISIONS } from '../sample/lumenPay';
import { buildClassifyPrompt, buildExplainPrompt, CLASSIFY_MODEL, RECORD_TOOL } from './prompt';

const candidates = SAMPLE_DECISIONS.slice(0, 2).map(({ key, ...decision }) => ({ pageId: key, decision }));
const proposal = { issueKey: 'LP-1', summary: 'Store ledger events in MongoDB', description: 'Schemaless.' };

describe('buildClassifyPrompt', () => {
  test('forces the record tool on the classification model at temperature 0', () => {
    const prompt = buildClassifyPrompt(proposal, candidates);

    expect(prompt.model).toBe(CLASSIFY_MODEL);
    expect(prompt.temperature).toBe(0);
    expect(prompt.tool_choice).toEqual({ type: 'function', function: { name: RECORD_TOOL } });
  });

  test('includes the proposal and every candidate with its id and statement', () => {
    const user = String(buildClassifyPrompt(proposal, candidates).messages[1].content);

    expect(user).toContain('Store ledger events in MongoDB');
    for (const c of candidates) {
      expect(user).toContain(`<decision id="${c.pageId}">`);
      expect(user).toContain(c.decision.statement);
    }
  });
});

describe('buildExplainPrompt', () => {
  test('refers to the Decision by title, never by its internal page id', () => {
    const record = { pageId: '3964929', decision: candidates[0].decision };
    const verdict = {
      pageId: '3964929',
      title: record.decision.title,
      verdict: 'Conflicts' as const,
      citation: 'x',
      reason: 'r',
      decidedOn: record.decision.decidedOn,
      deciders: record.decision.deciders,
    };

    const text = buildExplainPrompt(proposal, record, verdict).messages.map((m) => String(m.content)).join('\n');

    expect(text).not.toContain('3964929');
    expect(text).toContain(record.decision.title);
  });
});
