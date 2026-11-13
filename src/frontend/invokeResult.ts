import { invoke } from '@forge/bridge';
import type { ResolverResult } from '../resolvers/result';

/** Calls a resolver and unwraps the {ok, data | error} envelope, throwing on error. */
export async function call<T>(name: string, payload?: Record<string, unknown>): Promise<T> {
  const raw = await invoke<ResolverResult<T>>(name, payload);
  const result = (typeof raw === 'object' && raw !== null && 'body' in raw ? raw.body : raw) as ResolverResult<T>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
