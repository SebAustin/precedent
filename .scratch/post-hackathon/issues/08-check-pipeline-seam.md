# CheckSite seam and tests for the check pipeline
Status: needs-triage

Only the Resolution module has an adapter seam. Introduce a CheckSite (mirroring ResolutionSite) so service.ts, llm.ts, trigger.ts, site.ts, statusHandler.ts, byline/service.ts, supersession/completion.ts and agent/actions.ts can be tested.
