import { NeedsAuthenticationError } from '@forge/api';

/** Envelope for resolver results, so the UI can show failures instead of hanging. */
export type ResolverResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs resolver work and converts ordinary failures into an error envelope.
 * NeedsAuthenticationError is rethrown untouched: Forge only shows the
 * "Allow access" consent prompt when that error escapes the resolver.
 */
export async function attempt<T>(work: () => Promise<T>): Promise<ResolverResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error: unknown) {
    if (error instanceof NeedsAuthenticationError) throw error;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Precedent resolver failed:', message);
    return { ok: false, error: message };
  }
}
