/**
 * Decision Spaces (GLOSSARY.md): the Confluence spaces an admin has chosen as
 * sources of Decisions. Validated here because the keys end up inside CQL.
 */
export const MAX_DECISION_SPACES = 50;
const SPACE_KEY = /^~?[A-Za-z0-9_-]{1,255}$/;

export function normalizeSpaceKeys(input: unknown): string[] {
  if (!Array.isArray(input) || !input.every((k) => typeof k === 'string')) {
    throw new Error('Invalid Decision Spaces.');
  }

  const keys = [...new Set((input as string[]).map((k) => k.trim()).filter((k) => k.length > 0))];
  if (keys.length === 0) throw new Error('Choose at least one Decision Space.');
  if (keys.length > MAX_DECISION_SPACES) throw new Error(`Choose at most ${MAX_DECISION_SPACES} Decision Spaces.`);

  const invalid = keys.find((k) => !SPACE_KEY.test(k));
  if (invalid) throw new Error(`Invalid space key "${invalid}".`);
  return keys;
}
