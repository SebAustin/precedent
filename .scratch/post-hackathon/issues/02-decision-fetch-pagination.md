# Paginate and cache Decision fetches
Status: needs-triage

src/check/site.ts caps at MAX_DECISIONS = 100 with one request and expand=body.storage, never following _links.next; every Check and find-precedents refetches all bodies. Paginate, cache parsed Decisions in KVS keyed by page version, set function timeoutSeconds.
