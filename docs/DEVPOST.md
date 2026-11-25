# Precedent

**Tagline:** Your team's decisions, checked against every new piece of work — quoted, explained, and resolvable in one click.

**Category:** Apps for Software Teams · **Bonus:** Best use of Rovo agents

---

## Inspiration

Teams keep having the same meeting twice. Someone files a spike to try MongoDB, and weeks in, someone else remembers the team decided against it last spring — for reasons that are written down, in Confluence, where nobody looked. The decision record exists. It just isn't anywhere near the work.

Architecture decision records are a good habit with a fatal flaw: they only help if you go and read them. I wanted decisions to come to the work instead — at the moment the work is written down, inside the tools the team already uses.

## What it does

Precedent checks every Jira issue against the decisions your team has already accepted in Confluence, and tells you when the work collides with one.

- **Decisions stay where they are.** A decision is any Confluence page labelled `decision`, with a small properties table (Status, Decided on, Deciders). No new tool, no migration.
- **Every new or edited issue is checked automatically.** Within seconds, the issue's **Precedent** section shows one of three verdicts per decision: **Conflicts**, **Related**, or nothing. The sidebar carries a lozenge — *1 conflict*, *Resolved*, *1 related*, *Clear* — so you see it without opening anything.
- **Every alert quotes the decision word for word.** If the model can't point to exact words in the decision, the verdict is thrown away. Conflicts also get a short explanation of *why* the work collides and what the honest options are.
- **Three ways to resolve a conflict, all recorded with who and when:**
  - **Acknowledge** — the work will respect the decision (the issue links to it).
  - **Not a conflict** — dismiss it with a reason; it's never raised again.
  - **Propose superseding** — sometimes the decision *should* change. Precedent drafts a Proposed replacement decision in Confluence and leaves a note on the original. Nothing flips until a human sets the new decision to Accepted; then the old one is marked Superseded automatically.
- **The decision remembers.** On the Confluence page, the byline reads *"Precedent · challenged by N issues"*; open it to see exactly which work pushed on that decision and how each was resolved.
- **Ask Precedent (Rovo agent).** One click opens Rovo chat with the Precedent agent, which explains the check — who decided, when, the exact quote — and can find decisions on a topic, re-check an issue, acknowledge a conflict, or draft a supersession, with Rovo's confirmation before anything is written.
- **Who knows about this?** Pulls the people who shaped the decision, and their teams, from the **Teamwork Graph**.
- **Try it in one click.** An admin page loads *Lumen Pay*, a fictional fintech team with 7 decisions and 10 issues, plus a live **evaluation** that re-checks all 10 and scores the results against the expected answers. It scores **9 / 10** — I'd rather show the one it misses than hide it.

## How I built it

Precedent is a **Forge** app in **TypeScript** with **UI Kit**, spanning Jira and Confluence.

- **Checking pipeline** (Forge product trigger on issue create/update):
  1. Read the issue's summary and description; skip if the content hash hasn't changed.
  2. Search accepted decisions in the configured Confluence spaces and rank them with a cheap keyword/tag pre-filter, so only the top 5 candidates go to the model.
  3. **Forge LLM** (`claude-haiku-4-5`) classifies each pair with a forced tool call, returning structured verdicts with citations.
  4. A validator drops any verdict whose citation isn't genuinely in the decision text.
  5. For conflicts only, **`claude-sonnet-4-6`** writes the explanation.
  6. The result is stored as a Jira issue property; an app-posted comment announces each new conflict once.
- **Rovo agent** with four actions (`findPrecedents`, `checkProposal`, `acknowledgeConflict`, `draftSupersession`) that reuse the same functions as the UI. The agent is conversational; it is never on the critical path for producing a verdict (ADR 0001).
- **Teamwork Graph** (`confluencePageContributors`, `atlassianUserInTeams`) as optional enrichment that degrades to a clear "not available" message (ADR 0002).
- **Confluence byline** powered by a flat issue property exposed to JQL through `jira:entityProperty`, so the "challenged by" query runs as the viewer.
- **Status lozenge** via `jira:issueContext` dynamic properties.
- **Supersession completion** via a Confluence page-updated trigger.

**Security and privacy were design constraints, not afterthoughts.** Everything a user sees is read *as that user*, so Confluence's own permissions decide which decisions they can see; hidden ones show only as a count. The Jira comment is deliberately vague (it never names the decision), because every issue viewer sees comments. Admin-only actions check both the admin-page context and a live Jira-admin permission. The app has no external egress — all data stays on Atlassian's platform, and it is eligible for **Runs on Atlassian**.

The pure logic (decision parsing, ranking, verdict validation, resolution state, lozenge counts, permission filtering) is covered by **127 unit tests** written test-first.

## Challenges I ran into

- **Teaching the model the difference between "same words" and "same subject."** Early versions flagged anything that shared vocabulary — "internal", "data", "service". The fix was in the prompt (ask what the decision *governs*, then whether the work acts inside that area) plus the citation validator, measured against the 10-issue evaluation each time.
- **Making Rovo and our own UI agree.** A Rovo agent can't render into our panel, so verdicts had to come from a trigger, with the agent layered on top. Rovo's chat also carries the page you opened it from as context — so an issue you *name* in chat has to win over that context, or the agent answers about the wrong issue.
- **Confluence storage format.** The editor rewrites table cells with its own attributes, which broke the first version of flipping a decision's Status. A regression test from real page data fixed it for good.
- **Permission edge cases.** Showing "1 conflict" to someone who can't read the decision, without leaking its title, took a few iterations to get both honest and private.

## Accomplishments that I'm proud of

- **Every alert carries a real quote, or it isn't shown.** That single rule is what makes the alerts trustworthy enough to act on.
- **Supersession is a first-class outcome.** Precedent doesn't just enforce old decisions — it gives teams a clean, recorded path to change them.
- **An honest evaluation built into the product.** Anyone can press *Run evaluation* and see 9 / 10, including the miss.
- **A complete loop across Jira, Confluence, Rovo and the Teamwork Graph**, in one app, solo.

## What I learned

- Grounding beats cleverness: requiring a verbatim citation removed most bad answers more reliably than any prompt tweak.
- Put AI where its output lands. Triggers produce verdicts; the agent is for conversation. Mixing the two would have made both worse.
- Atlassian's permission model does most of the privacy work for you — if you read data as the user and resist the shortcut of reading it as the app.

## What's next for Precedent

- **Decisions from more places** — ADR files in Bitbucket/GitHub repositories, and decisions captured in Loom or meeting notes.
- **Checks on pull requests**, so a conflicting change is caught at review time, not just at planning time.
- **A decision health view** — which decisions are challenged most often, and which may be due for a rethink.
- **Marketplace release**, with per-space settings and smarter cost controls for large decision libraries.

## Built with

Atlassian Forge · TypeScript · UI Kit · Forge LLM (Claude Haiku 4.5, Claude Sonnet 4.6) · Rovo agents and actions · Teamwork Graph · Jira Cloud REST API · Confluence Cloud REST API · Forge triggers · Jira entity properties and JQL · Forge KVS · Vitest

## Links

- Demo video: `<VIDEO LINK>`
- Source (MIT): `<GITHUB REPO URL>`
- Install link and testing steps: see [TESTING.md](TESTING.md)
