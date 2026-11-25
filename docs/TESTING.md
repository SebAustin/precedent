# Testing Precedent

Precedent checks Jira work against the decisions your team already recorded in Confluence, and flags conflicts with a quote from the decision. These steps take about 10 minutes on an empty site.

## 1. Install

1. Use a site where you are a **Jira administrator** and can create Confluence spaces, with **Jira and Confluence** on the same site. **Rovo** must be enabled to try the agent (step 5).
2. Open the install link and install Precedent on **both Jira and Confluence**:
   **`<INSTALL LINK>`**
3. The first time you open any Precedent view, it asks you to **Allow access**. Precedent reads Jira and Confluence *as you*, so it only ever shows decisions you are allowed to read.

## 2. Load the Sample Workspace (one click)

1. In Jira, go to **Settings (⚙) → Apps → Precedent** (under *Apps* in the left menu).
2. Click **Load sample workspace**. In about a minute it creates:
   - a Confluence space **Lumen Pay Decisions** (key `LUMENPAY`) with 7 decision pages labelled `decision`;
   - a Jira project **Lumen Pay Platform** (key `LUMENPAY`) with 10 issues to check against them.

   Wait until it shows **Loaded** and **19 of 19 items**. If your site already has a space or project with key `LUMENPAY`, the loader stops and says so rather than touching it.
3. Optional: click **Run evaluation**. It re-checks all 10 issues live and compares the results with the expected answers. We get **9 / 10**. The one miss, LUMENPAY-6, should be *Related* to "No production deploys on Friday afternoons" but comes back clear. One run costs a few cents of LLM usage.

## 3. See a conflict (the core flow)

1. Open **LUMENPAY-1 "Spike: store ledger events in MongoDB"**.
2. In the right sidebar, expand **Precedent**. The card says **Conflicts with an accepted decision**, links to "Postgres for all transactional data", and quotes it word for word: *"We will not adopt MongoDB…"*. Every alert carries a real quote from the decision, or it is not shown.
3. Try the three ways to resolve it:
   - **Acknowledge**: the work will respect the decision. The card turns green, and the issue gets a web link to the decision.
   - **Not a conflict**: dismiss it with a reason. It is never raised again for this issue/decision pair.
   - **Propose superseding**: the decision should change. Precedent drafts a *Proposed* replacement decision in Confluence and comments on the original. The original is only marked *Superseded* when someone sets the new page's Status to **Accepted**.
4. **Who knows about this?** lists the decision's contributors and their teams from the **Teamwork Graph**. Teamwork Graph is in preview; on sites without it, the card says *"Teamwork Graph is not available on this site"* and nothing else is affected.

## 4. Catch a conflict live

1. Create an issue in **Lumen Pay Platform**, for example:
   - Summary: `Back up customer profiles to a US bucket`
   - Description: `Nightly copy of the customer profile table to an S3 bucket in us-east-1 for disaster recovery.`
2. Open it and wait **10–20 seconds**, then reload. A Precedent comment appears and the sidebar shows a red **1 conflict** against "Customer PII stays in the EU region". Editing an issue's summary or description re-checks it.

## 5. Ask the Rovo agent

On any LUMENPAY issue, expand Precedent and click **Ask Precedent**. This opens Rovo chat with the **Precedent** agent, which explains the check with the deciders, date and quote. You can also open the agent from Rovo and ask, for example, *"Is LUMENPAY-2 consistent with our decisions?"* or *"What did we decide about APIs?"*. Before the agent records anything (acknowledge, draft a supersession), Rovo asks you to confirm.

## 6. The decision remembers

Open the Confluence page **Postgres for all transactional data**. The byline shows **Precedent · challenged by N issues**. Click it to see the Jira work that conflicted with this decision, grouped by how it was resolved.

## Good to know

- **Sidebar lozenge.** Jira shows the lozenge next to "Precedent" (*1 conflict*, *Resolved*, *1 related*, *Clear*) after the section has been opened once on that issue. Before that, only the label shows.
- **Privacy.** The Jira comment never names the decision; titles and quotes appear only in the Precedent section, filtered by your Confluence permissions. Decisions in spaces you can't read appear only as a count.
- **Which decisions are read.** Only Confluence pages labelled `decision` in the spaces chosen under **Decision Spaces** on the admin page. With nothing chosen, Precedent uses the Sample Workspace space.
- **Clean up.** Click **Remove** on the admin page to delete the sample space and project.
