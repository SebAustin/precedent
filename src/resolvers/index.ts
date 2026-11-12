import Resolver from '@forge/resolver';
import type { WorkspaceSummary } from '../sample/plan';
import { getSampleWorkspace, removeSampleWorkspace, seedNextItem } from '../sample/service';
import { type ResolverResult, attempt } from './result';

export type { ResolverResult } from './result';

const resolver = new Resolver();

resolver.define('getText', () => 'Hello from Precedent!');

resolver.define('getSampleWorkspace', (): Promise<ResolverResult<WorkspaceSummary>> => attempt(getSampleWorkspace));
resolver.define('seedSampleStep', (): Promise<ResolverResult<WorkspaceSummary>> => attempt(seedNextItem));
resolver.define('removeSampleWorkspace', (): Promise<ResolverResult<WorkspaceSummary>> =>
  attempt(removeSampleWorkspace)
);

export const handler = resolver.getDefinitions();
