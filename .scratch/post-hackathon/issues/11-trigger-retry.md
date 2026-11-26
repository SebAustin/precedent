# Automatic retry for failed Checks
Status: needs-triage

Failed Checks retry only on the next edit or Check again. Consider Forge event retry (retryAfter) once concurrent-check dedupe (01) exists.

Note: the Supersession trigger can re-check only 3 issues per completion (product triggers cannot raise the time limit). A queue consumer would lift both limits.
