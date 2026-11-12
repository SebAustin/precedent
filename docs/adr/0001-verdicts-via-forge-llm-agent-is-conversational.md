# Verdicts are computed by Forge LLM in a trigger; the Rovo agent is conversational only

Precedent must show a Verdict in the Jira issue panel automatically when an issue is created or edited. A Rovo agent cannot return output to our own UI (`rovo.open` only opens the chat sidebar), so Verdicts are computed in a Forge trigger with `@forge/llm` (search filter → Haiku Verdict → Sonnet explanation on Conflicts only, cached by content hash) and stored on the issue. The Rovo agent reuses the same functions as actions for "explain / what now?" conversations and for Resolutions; it is never on the critical path for producing a Verdict.

## Consequences

- We pay Forge LLM token costs (no free tier); the content-hash cache and candidate pre-filter exist to bound that.
- Installing the app shows admins an AI-usage permission prompt.
