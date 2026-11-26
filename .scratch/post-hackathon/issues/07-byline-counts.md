# Byline: count only live Conflicts, cheaper title
Status: needs-triage

src/byline/service.ts counts Dismissed Conflicts as 'challenged' and builds full state (one readResolutions per issue) just for the title. Count open + superseding + acknowledged; add a count-only path.
