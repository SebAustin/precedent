/**
 * Persistence for Decision Spaces (Forge KVS) and the list of spaces an admin
 * can pick from.
 */
import api, { route } from '@forge/api';
import kvs from '@forge/kvs';
import { SAMPLE_SPACE } from '../sample/lumenPay';
import { normalizeSpaceKeys } from './decisionSpaces';

const DECISION_SPACES_KEY = 'decision-spaces';
const MAX_LISTED_SPACES = 250;

export interface SpaceOption {
  readonly key: string;
  readonly name: string;
}

export interface DecisionSpaceSettings {
  readonly selected: readonly string[];
  /** True when no admin has saved a choice yet and the Sample Workspace default applies. */
  readonly isDefault: boolean;
  readonly available: readonly SpaceOption[];
}

export async function getDecisionSpaces(): Promise<string[]> {
  const stored = await kvs.get<string[]>(DECISION_SPACES_KEY);
  return stored && stored.length > 0 ? stored : [SAMPLE_SPACE.key];
}

export async function saveDecisionSpaces(input: unknown): Promise<string[]> {
  const keys = normalizeSpaceKeys(input);
  await kvs.set(DECISION_SPACES_KEY, keys);
  return keys;
}

/** Spaces the admin can see, so they can only pick spaces they have access to. */
async function listAvailableSpaces(): Promise<SpaceOption[]> {
  const res = await api.asUser().requestConfluence(route`/wiki/api/v2/spaces?limit=${MAX_LISTED_SPACES}&sort=name`);
  if (!res.ok) throw new Error(`List Confluence spaces failed (HTTP ${res.status}).`);
  const { results } = (await res.json()) as { results: { key: string; name: string; type?: string }[] };
  return results.filter((s) => s.type !== 'personal').map((s) => ({ key: s.key, name: s.name }));
}

export async function getDecisionSpaceSettings(): Promise<DecisionSpaceSettings> {
  const [stored, available] = await Promise.all([kvs.get<string[]>(DECISION_SPACES_KEY), listAvailableSpaces()]);
  const isDefault = !stored || stored.length === 0;
  return { selected: isDefault ? [SAMPLE_SPACE.key] : stored, isDefault, available };
}
