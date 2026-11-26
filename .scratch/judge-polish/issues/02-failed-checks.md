# B. Failed Checks
Status: ready-for-agent

A Check fails when the classifier errors or returns no tool call. Individually rejected Verdicts do not fail it.

- A failed Check never replaces the last completed one, and its content hash is not trusted, so the next issue event retries.
- The panel keeps the last completed Verdicts and adds a warning: "The last check failed · Check again". An issue whose first Check failed says so instead of "hasn't been checked yet".
- No automatic trigger retry.
