/**
 * A flat issue property that Jira indexes for JQL (see the jira:entityProperty
 * module), so a Decision page can find every issue that conflicts with or
 * relates to it — the reverse view shown in the Confluence byline.
 */
import type { CheckResult } from './types';

export const SEARCH_INDEX_PROPERTY = 'precedent-index';

export interface SearchIndex {
  readonly conflictPageIds: readonly string[];
  readonly relatedPageIds: readonly string[];
}

export function buildSearchIndex(result: CheckResult): SearchIndex {
  return {
    conflictPageIds: result.verdicts.filter((v) => v.verdict === 'Conflicts').map((v) => v.pageId),
    relatedPageIds: result.verdicts.filter((v) => v.verdict === 'Related').map((v) => v.pageId),
  };
}
