# Demo video v3: show a Decision's whole life

Status: ready-for-agent

## Problem Statement

The approved demo video (v2, 2:32) was recorded before the judge-polish release that is now in production. Three things have drifted since then:

- The issue panel now looks a little different: its footer says "Checked … against N decisions", and Conflicts whose Decision is no longer a Precedent appear as Lapsed Verdicts. A judge who installs Precedent after watching the video sees a panel that doesn't quite match it.
- The video's story stops halfway. It shows "Propose superseding" drafting a replacement Decision, then says "nothing flips until a human accepts it". It never shows what happens when someone does accept it: the old Decision becomes Superseded, and the Conflicts it caused lapse. That is the strongest proof of "build with context" the app has, and it is missing.
- The outro URL now leads to a real public repository. That doesn't need a fix, but a re-record is the moment to confirm it.

## Solution

Re-record the demo with the same voice, caption style and site as v2, keeping every v2 beat that still matches the product. Extend the Supersession beat into a full Decision lifecycle:

1. A teammate proposes superseding the conflicting Decision.
2. The team rewrites the drafted statement and sets the replacement to Accepted.
3. Back on the issue, the Conflict now reads "No longer accepted", names the replacement, and stops counting as open.

The finished video stays under three minutes. It passes the same two gates as v2: an approved script before capture, and a scene-by-scene review of the first render.

## User Stories

1. As a hackathon judge, I want the video to show the same panel I will see after installing, so that I trust the demo reflects the real product.
2. As a hackathon judge, I want to see a Conflict caught on a brand-new issue within seconds, so that I understand Precedent works automatically.
3. As a hackathon judge, I want to see the exact quoted words of a Decision in every alert, so that I believe the AI is grounded in real records.
4. As a hackathon judge, I want to see who decided, and when, without leaving Jira, so that I see the context Precedent brings to the work.
5. As a hackathon judge, I want to see the Rovo agent explain a Conflict, so that I can score the Rovo bonus category.
6. As a hackathon judge, I want to see a Conflict acknowledged in one click, so that I see the resolution flow is lightweight.
7. As a hackathon judge, I want to see a Decision deliberately superseded from an issue, so that I see Precedent doesn't just block change.
8. As a hackathon judge, I want to see the replacement Decision accepted by a person, so that I see a human, not the AI, changes a Decision.
9. As a hackathon judge, I want to see the original Decision marked Superseded after acceptance, so that I see the lifecycle completes on its own.
10. As a hackathon judge, I want to see the issue's Conflict turn into a "No longer accepted" Lapsed Verdict naming the replacement, so that I see Precedent stays correct when Decisions change.
11. As a hackathon judge, I want to see the sidebar stop counting a lapsed Conflict, so that I see the status at a glance is honest.
12. As a hackathon judge, I want to see the Confluence byline list the issues that challenged a Decision, so that I see the link works in both directions.
13. As a hackathon judge, I want to see the Teamwork Graph "Who knows about this?" result, so that I see the people behind a Decision.
14. As a hackathon judge, I want to see the one-click Sample Workspace and its evaluation score, so that I know I can try it myself on an empty site.
15. As a hackathon judge, I want the video to end on a link that works, so that I can read the source.
16. As a hackathon judge, I want every value the narrator mentions to be readable on screen, so that I don't have to take the narration on trust.
17. As a hackathon judge, I want the video to be under three minutes, so that I can watch it in full.
18. As a hackathon judge watching without sound, I want captions that track the narration, so that I can follow along.
19. As a team lead evaluating Precedent, I want to see that dismissing or superseding leaves a visible trail, so that I know decisions aren't silently overridden.
20. As a team lead evaluating Precedent, I want to see that a drafted replacement can't be accepted until someone rewrites it, so that I trust a placeholder never becomes a Precedent.
21. As the maker, I want each take to start from the same site state, so that retakes are interchangeable.
22. As the maker, I want a dry run that lists what a take changed before anything is undone, so that resetting never touches data a take didn't create.
23. As the maker, I want the reset to restore a Decision that a take superseded back to Accepted, so that the next take can supersede it again.
24. As the maker, I want the reset to trash replacement Decisions a take created, whether still Proposed or already Accepted, so that the Decision Space only holds the Sample Workspace.
25. As the maker, I want the reset to clear the demo issue's Resolutions and remote links, so that its Conflict is open again at the start of a take.
26. As the maker, I want the capture to wait for the Lapsed Verdict to appear rather than sleep for a fixed time, so that takes don't flake.
27. As the maker, I want slow waits (the trigger, the agent, the Supersession) jump-cut out, so that the video keeps its pace.
28. As the maker, I want the same voice and caption style as the approved v2, so that the re-record needs no new style decisions.
29. As the maker, I want to approve the script before any capture, so that no capture is wasted on a beat I'd cut.
30. As the maker, I want a scene-level review of the first render, so that I can request targeted retakes instead of a full redo.
31. As the maker, I want the video never to mention the tool that produced it or that it was AI-made, so that it meets my publishing rules.
32. As the maker, I want the vertical cut and GIF regenerated only after the main video is approved, so that I don't pay for renders of an unapproved cut.
33. As the maker, I want the DEVPOST video placeholder filled once the video is uploaded, so that the submission is complete.

## Implementation Decisions

- **Same pipeline, same project.** The re-record reuses the existing demo project: its capture flow, script, storyboard, reset recipe and the signed-in capture profile. The storyboard stays the single source of truth for beats, timing and narration. v2's outputs are archived, not overwritten.
- **Beats kept from v2:**
  - intro card;
  - the Decision page;
  - the issue with its red sidebar lozenge;
  - the catch;
  - Ask Precedent (Rovo);
  - Acknowledge;
  - the live catch on a new issue;
  - the byline;
  - Who knows about this?;
  - the Sample Workspace;
  - outro.
  Their narration is re-read against the current UI. Copy that no longer matches the screen is updated; the panel's "Checked … against N decisions" footer may appear without being narrated.
- **The extended Supersession beat** replaces v2 scene 7 with three short beats:
  1. Propose superseding from the new issue, which drafts a Proposed replacement with the DRAFT placeholder statement.
  2. The team rewrites the statement and sets the replacement to Accepted. The edit may happen off camera between clips (a jump cut), and the narration says so honestly ("once the team rewrites and accepts it…"). The camera shows the accepted replacement page and the original Decision now reading Superseded.
  3. Back on the issue, the card reads "No longer accepted" and names the replacement, and the sidebar no longer shows a conflict.
- **Which Decision is superseded:** the one the live-catch issue conflicts with ("Customer PII stays in the EU region"), so the lifecycle follows on from the live catch without a new setup. The Postgres Decision is never superseded, because the byline beat depends on it.
- **Waiting is condition-based.** Each clip waits for a visible state: the comment and red card after creating the issue, the agent's answer, the Superseded status on the original Decision, and the "No longer accepted" card. It never sleeps for a fixed time. Waits are cut from the final video.
- **The reset recipe gains three undo steps**, all limited to what takes create:
  - restore a Superseded Sample Workspace Decision to Accepted;
  - trash every replacement Decision a take created, Proposed or Accepted (identified by the drafted title prefix);
  - delete the "proposes superseding" notes on the original.
  The existing undo steps stay. The dry run must list each change before `--apply` makes it.
- **Captions, voice and format** match the approved v2: bar captions, the same ElevenLabs voice, 1080p landscape.
- **Length:** target about 2:50 or less; hard limit 3:00. If the extended beat pushes past that, the Who-knows beat is trimmed first, then the Sample Workspace beat.
- **Outro:** `github.com/SebAustin/precedent`, now public under MIT.

## Testing Decisions

- A good check verifies what a viewer or a fresh take sees, not how the flow is written.
- **The reset recipe is the pre-take check.** Before each take, the dry run must list only changes made by earlier takes. Running it with `--apply` must leave the demo issue with an open Conflict and every Sample Workspace Decision in its original status. Prior art: the v2 reset recipe and its dry-run mode.
- **The script gate:** the maker approves the scene-by-scene outline, with the narration line, on-screen state, media type and estimated seconds for each beat, before any capture. Prior art: the v2 script.
- **The render review gate:** the first render is reviewed scene by scene against the approved script. Automatic checks before review:
  - duration is 3:00 or less;
  - the outro shows the repository URL;
  - neither narration nor captions mention the producing tool or AI generation;
  - every value narrated is legible at 1080p.
  Prior art: the v2 review.
- **No app code changes are expected,** so the app's 162 unit tests are not part of this work. If capture reveals an app bug, that becomes its own ticket, not a change made during capture.

## Out of Scope

- Changes to Precedent itself, including new UI made only for the video.
- A second site or a fresh-install take.
- Showing a failed Check, Dismiss with a reason, or the Rovo re-check input.
- Marketplace listing assets.
- Uploading the video to a host (the maker does this); this work ends with approved files and the DEVPOST placeholder filled once a URL is provided.

## Further Notes

- **Leftover take issues:** the capture account cannot delete issues in the LUMENPAY project, so each take leaves a "Back up customer profiles to a US bucket" issue behind (LUMENPAY-15 and -16 so far). They also conflict with the PII Decision, so a Supersession re-checks up to three of them alongside the take's issue. Before capture, either grant the capture account Delete in LUMENPAY or accept the leftovers. The reset restores the PII Decision either way, so their Verdicts are Conflicts again on the next take.
- **Supersession timing:** completing a Supersession re-checks at most three issues in one trigger run, but the panel derives "No longer accepted" from the Decision's live status. The on-camera issue shows the lapse even if its re-check hasn't finished. Its sidebar lozenge updates only once that issue is re-checked. Because the re-checked issues are whatever the search returns first, the take's issue may not be among the three. The clip that shows the lozenge waits briefly for it, and if it hasn't updated, the flow clicks "Check again" and cuts the wait. Clearing the leftover issues first (see above) removes the risk.
- **Capture profile:** re-sign-in to the capture profile before the first take. Quit that Chrome with Cmd+Q so it releases the profile lock.
