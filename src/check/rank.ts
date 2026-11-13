/**
 * Cheap, deterministic candidate pre-filter: keeps the LLM bill bounded by
 * sending only Accepted Decisions that share meaningful words with the
 * Proposal. Recall matters more than precision here — the LLM decides.
 */
import { proposalText } from './proposal';
import type { DecisionRecord, Proposal } from './types';

export const DEFAULT_CANDIDATE_LIMIT = 5;
const TAG_WEIGHT = 2;
const MIN_SCORE = 1;
const MIN_TOKEN_LENGTH = 2;

const STOPWORDS = new Set(
  (
    'a an the and or of to in on for with without by at from as is are be been was were will would should can could ' +
    'may might we our it its this that these those not no into out over under than then so if only all any each ' +
    'other more most such via per also just about after before when where which who what how why do does did done ' +
    'has have had i you they them their he she his her my your new use using used make need needs get let one two ' +
    'first should must instead keep kept'
  ).split(' ')
);

function singular(word: string): string {
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
  return words.map(singular).filter((w) => w.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(w));
}

function score(proposalTokens: ReadonlySet<string>, record: DecisionRecord): number {
  const { title, statement, tags } = record.decision;
  const tagTokens = new Set(tags.flatMap(tokenize));
  const textTokens = new Set(tokenize(`${title} ${statement}`));

  let total = 0;
  for (const token of new Set([...tagTokens, ...textTokens])) {
    if (proposalTokens.has(token)) total += tagTokens.has(token) ? TAG_WEIGHT : 1;
  }
  return total;
}

export function rankCandidates(
  proposal: Proposal,
  records: readonly DecisionRecord[],
  limit: number = DEFAULT_CANDIDATE_LIMIT
): DecisionRecord[] {
  const proposalTokens = new Set(tokenize(proposalText(proposal)));

  return records
    .filter((r) => r.decision.status === 'Accepted')
    .map((record) => ({ record, score: score(proposalTokens, record) }))
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.record);
}
