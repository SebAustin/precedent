/**
 * Sample Workspace: "Lumen Pay", a fictional 40-person fintech platform team.
 *
 * Doubles as the Verdict eval fixture: every Proposal lists the Verdicts a
 * correct check must produce. Pairs not listed are expected to be None.
 * The supersession pair (monolith-first → standalone services) is a deliberate
 * trap: a Proposal must never Conflict with a Superseded Decision.
 */
import type { Decision } from '../domain/decision';

export type DecisionKey = 'postgres' | 'rest' | 'fridayDeploys' | 'flags' | 'euPii' | 'monolith' | 'services';

export interface SampleDecision extends Decision {
  readonly key: DecisionKey;
}

export type ExpectedVerdict = 'Conflicts' | 'Related';

export interface SampleProposal {
  readonly key: string;
  readonly summary: string;
  readonly description: string;
  readonly expected: Readonly<Partial<Record<DecisionKey, ExpectedVerdict>>>;
}

export const SAMPLE_SPACE = { key: 'LUMENPAY', name: 'Lumen Pay Decisions' } as const;
export const SAMPLE_PROJECT = { key: 'LUMENPAY', name: 'Lumen Pay Platform' } as const;

export const SAMPLE_DECISIONS: readonly SampleDecision[] = [
  {
    key: 'postgres',
    title: 'Postgres for all transactional data',
    statement: 'We will not adopt MongoDB or other document stores for transactional data; Postgres is the system of record for ledgers, payments and balances.',
    rationale: 'Ledger correctness depends on multi-row ACID transactions and strict schemas. A 2025 spike on MongoDB showed reconciliation drift under concurrent writes, and running two primary databases doubles on-call load.',
    deciders: ['Priya Nair', 'Tom Becker'],
    decidedOn: '2026-03-04',
    status: 'Accepted',
    tags: ['database', 'storage', 'ledger'],
  },
  {
    key: 'rest',
    title: 'REST for public and partner APIs',
    statement: 'Public and partner-facing APIs are REST with OpenAPI specs and URL versioning; we will not expose GraphQL externally.',
    rationale: 'Partners are banks and PSPs whose integration teams expect REST and OpenAPI. GraphQL complicates rate limiting, caching and per-field authorization on regulated data.',
    deciders: ['Amara Okafor'],
    decidedOn: '2026-01-21',
    status: 'Accepted',
    tags: ['api', 'partners', 'graphql'],
  },
  {
    key: 'fridayDeploys',
    title: 'No production deploys on Friday afternoons',
    statement: 'No production deploys after 14:00 local time on Fridays, except approved hotfixes.',
    rationale: 'Three of the last four Sev-1 incidents started with Friday afternoon deploys when weekend on-call coverage was thin.',
    deciders: ['Diego Alvarez'],
    decidedOn: '2025-11-10',
    status: 'Accepted',
    tags: ['release', 'deploys', 'on-call'],
  },
  {
    key: 'flags',
    title: 'Feature flags through the Beacon service',
    statement: 'All feature flags go through our internal Beacon flag service; no hard-coded toggles or third-party flag SDKs in services.',
    rationale: 'One audited place to see what is switched on for which merchant is a compliance requirement, and Beacon already integrates with our kill-switch runbooks.',
    deciders: ['Priya Nair', 'Lena Fischer'],
    decidedOn: '2026-02-12',
    status: 'Accepted',
    tags: ['feature-flags', 'release', 'compliance'],
  },
  {
    key: 'euPii',
    title: 'Customer PII stays in the EU region',
    statement: 'Customer personally identifiable information is stored and processed only in our EU (eu-central-1) region, including replicas, caches and backups.',
    rationale: 'GDPR data-residency commitments in our merchant contracts and our banking licence conditions require EU residency for customer data.',
    deciders: ['Lena Fischer', 'Amara Okafor'],
    decidedOn: '2025-09-02',
    status: 'Accepted',
    tags: ['privacy', 'gdpr', 'data-residency', 'infrastructure'],
  },
  {
    key: 'monolith',
    title: 'New capabilities start inside the core monolith',
    statement: 'New capabilities are built as modules inside the core monolith rather than as separate services.',
    rationale: 'With six engineers, operating more services cost more than it saved.',
    deciders: ['Tom Becker'],
    decidedOn: '2024-06-18',
    status: 'Superseded',
    tags: ['architecture', 'services'],
  },
  {
    key: 'services',
    title: 'Standalone services for capabilities that own their data',
    statement: 'A new capability may be built as a standalone service when it owns its data and has a dedicated team; otherwise it stays in the core monolith.',
    rationale: 'At 40 engineers, monolith deploy contention became the main delivery bottleneck. Ownership of data is the boundary that keeps services from becoming a distributed monolith.',
    deciders: ['Tom Becker', 'Priya Nair'],
    decidedOn: '2026-05-27',
    status: 'Accepted',
    tags: ['architecture', 'services'],
    supersedes: 'New capabilities start inside the core monolith',
  },
];

export const SAMPLE_PROPOSALS: readonly SampleProposal[] = [
  {
    key: 'mongo-ledger',
    summary: 'Spike: store ledger events in MongoDB',
    description: 'Ledger event payloads vary by payment method. Try storing them in MongoDB so we can skip schema migrations when new methods launch.',
    expected: { postgres: 'Conflicts' },
  },
  {
    key: 'graphql-partners',
    summary: 'Expose the partner API over GraphQL',
    description: 'Partners keep asking for flexible queries. Add a GraphQL endpoint to the partner gateway so they can fetch exactly the transaction fields they need.',
    expected: { rest: 'Conflicts' },
  },
  {
    key: 'us-replica',
    summary: 'Add a us-east-1 read replica of customer profiles',
    description: 'US merchants see 300ms latency on profile lookups. Replicate the customer profile table (names, emails, addresses) to a read replica in us-east-1.',
    expected: { euPii: 'Conflicts' },
  },
  {
    key: 'partition-transactions',
    summary: 'Partition the transactions table by month',
    description: 'The Postgres transactions table passed 2B rows. Add monthly range partitioning to keep vacuum and index maintenance fast.',
    expected: { postgres: 'Related' },
  },
  {
    key: 'checkout-flag',
    summary: 'Roll out new checkout flow behind a Beacon flag',
    description: 'Release the redesigned checkout to 5% of merchants first using a Beacon feature flag, then ramp up weekly.',
    expected: { flags: 'Related' },
  },
  {
    key: 'thursday-train',
    summary: 'Schedule the v4.2 release train for Thursday morning',
    description: 'Move the v4.2 production release to Thursday 10:00 so the full team is around for the first 24 hours.',
    expected: { fridayDeploys: 'Related' },
  },
  {
    key: 'rest-v2',
    summary: 'Version payout endpoints under /v2',
    description: 'Payout responses need a breaking change to the amount format. Publish /v2 payout endpoints with an updated OpenAPI spec and deprecate /v1.',
    expected: { rest: 'Related' },
  },
  {
    key: 'notifications-service',
    summary: 'Extract notifications into a standalone service',
    description: 'The new Messaging team owns the notification templates and delivery log. Move notifications out of the core monolith into its own service with its own database.',
    expected: { services: 'Related' },
  },
  {
    key: 'onboarding-typo',
    summary: 'Fix typo on merchant onboarding screen',
    description: '"Recieve payouts" should read "Receive payouts" on step 3 of merchant onboarding.',
    expected: {},
  },
  {
    key: 'dark-mode',
    summary: 'Add dark mode to the internal admin dashboard',
    description: 'Support staff work night shifts and asked for a dark theme in the admin dashboard.',
    expected: {},
  },
];
