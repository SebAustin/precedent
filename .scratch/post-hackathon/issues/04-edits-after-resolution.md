# Flag issue edits after a Resolution
Status: needs-triage

Resolutions are keyed by page id only, so an Acknowledged issue rewritten to break the Decision still reads 'All conflicts resolved'. Store the content hash on the Resolution and flag 'issue changed since acknowledged'. Orphan Resolutions and remote links when a Conflict vanishes on re-check.
