# Precedent privacy policy

_Last updated: 26 November 2026_

Precedent is an Atlassian Forge app built for Codegeist 2026 by an independent developer. It checks Jira issues against decisions recorded in Confluence. This page explains what data it handles.

## Where data lives

Precedent runs entirely on Atlassian's Forge platform. It makes **no calls to servers outside Atlassian**: the app declares no external network access. Everything it stores stays in your Atlassian site.

## What Precedent stores

| Data | Where | Why |
|---|---|---|
| The result of each check (decision titles, quoted decision text, short explanations, timestamps) | Jira issue properties on the checked issue | To show the Precedent section and its status |
| Responses to a conflict: Acknowledge, Dismiss (with the reason typed) or Supersede, **with the Atlassian account ID of the person who chose it** and the time | Jira issue properties | So the team can see who resolved a conflict and when |
| Which conflicts were already announced, and whether the last check failed | Jira issue properties | To avoid duplicate comments and to show check status |
| The chosen Decision Spaces | Forge storage for the app | The admin setting for where decisions are read from |

Precedent also creates content you can see in your site: a short comment on an issue when a new conflict is found, links between issues and decision pages, draft decision pages and comments when someone proposes superseding a decision, and (only if you load it) the Sample Workspace's demo space, project, pages and issues.

## Personal data

The only personal data Precedent stores is the **Atlassian account ID** recorded with each conflict response. It does not store names, email addresses or other profile data; names are displayed by Atlassian from the account ID at view time.

## AI processing

To judge whether an issue conflicts with a decision, Precedent sends the issue's summary and description, and the text of candidate decisions, to large language models through **Forge LLM**, which is hosted and governed by Atlassian. See Atlassian's documentation on Forge LLM and its data handling. Precedent does not use this data for any other purpose.

## Who can see what

Precedent shows a decision's details only to people who can read that decision in Confluence. Issue comments posted by the app never contain decision titles or quotes.

## Removing data

Uninstalling Precedent stops all processing. Data stored as issue properties and the pages, comments and links it created remain part of your site and can be removed with Jira and Confluence's own tools. To ask for help removing data, or with any privacy question, open an issue at <https://github.com/SebAustin/precedent/issues>.
