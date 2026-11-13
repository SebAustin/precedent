# Teamwork Graph is optional enrichment, never on the critical path

The hackathon theme centres on the Teamwork Graph, so a reader may expect Precedent to be built on it. We deliberately keep it optional: as of Nov 2026 the Forge TWG API is Preview (some docs still say test organisations only), runs `asUser` only, requires an org-admin install, and returns silently empty results when a scope is missing — all unacceptable risks on a judge's freshly installed site. Precedent feature-detects TWG at runtime and uses it only to add people/work connected to a Decision; Conflict detection relies solely on Confluence and Jira APIs. Rovo agents, not TWG, are the primary bonus-prize target.

## Implementation (2026-11-12)

Shipped as an on-demand "Who knows about this?" action on each Decision card in the issue panel: curated queries `confluencePageContributors` → `atlassianUserInTeams`, run `asUser` (TWG has no app access), with scopes `read:graph:page:confluence`, `read:graph:user:atlassian`, `read:graph:team:atlassian`. On demand rather than on panel load to avoid ~1+N graph calls per Decision. Any error or empty result renders an explicit "not available" / "no contributors" line, never a broken card. Gotcha found live: TWG rejects queries whose operation name is not shaped `company_operation` (e.g. `precedent_pageContributors`); a unit test pins this.
