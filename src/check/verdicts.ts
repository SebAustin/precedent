/**
 * Validates the LLM's tool-call output. The rule from GLOSSARY.md is enforced
 * here: a Verdict without a genuine Citation from the Decision is never shown.
 */
import type { CitedVerdict, DecisionRecord, ShownVerdict } from './types';

const SHOWN: readonly string[] = ['Conflicts', 'Related'];
const MIN_CITATION_LENGTH = 3;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      return asObject(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return isRecord(raw) ? raw : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toCitedVerdict(item: unknown, byId: ReadonlyMap<string, DecisionRecord>): CitedVerdict | null {
  if (!isRecord(item)) return null;

  const record = byId.get(str(item.decision_id));
  const verdict = str(item.verdict);
  const citation = str(item.citation);
  if (!record || !SHOWN.includes(verdict)) return null;

  const normalizedCitation = normalize(citation);
  if (normalizedCitation.length < MIN_CITATION_LENGTH) return null;
  if (!normalize(record.decision.statement).includes(normalizedCitation)) return null;

  return {
    pageId: record.pageId,
    title: record.decision.title,
    verdict: verdict as ShownVerdict,
    citation,
    reason: str(item.reason),
    decidedOn: record.decision.decidedOn,
    deciders: record.decision.deciders,
  };
}

export function parseVerdicts(toolArguments: unknown, candidates: readonly DecisionRecord[]): CitedVerdict[] {
  const args = asObject(toolArguments);
  if (!args || !Array.isArray(args.verdicts)) return [];

  const byId = new Map(candidates.map((c) => [c.pageId, c] as const));
  const seen = new Set<string>();
  const result: CitedVerdict[] = [];

  for (const item of args.verdicts) {
    const cited = toCitedVerdict(item, byId);
    if (cited && !seen.has(cited.pageId)) {
      seen.add(cited.pageId);
      result.push(cited);
    }
  }
  return result;
}
