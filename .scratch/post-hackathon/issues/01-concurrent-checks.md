# Concurrent Checks and duplicate comments
Status: needs-triage

Create + quick edit, or trigger + Check now, can each pay for an LLM run and each post a Conflict comment (src/check/service.ts read-hash→LLM→write; src/check/site.ts announced read-modify-write). Add a per-issue in-flight key with TTL and re-read the announced list before posting.
