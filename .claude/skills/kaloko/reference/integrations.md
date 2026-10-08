# Jira, Linear, channels and hosted runs

What the organization connected on kaloko.app (Settings → Integrations, done by an
admin) and what you may do with it from the CLI and MCP.

## Issues in Jira or Linear

When a reviewer returned a step or a criterion fails and the team tracks work in
Jira or Linear, file it there from the step instead of copying text by hand:

```bash
kaloko issue create --step checkout --to jira --criterion AC2 --note "Total ignores the voucher"
kaloko issue list --state open
```

- `--run <id>` names the shared run; without it the current run is used once it
  is shared. MCP: `create_issue`, `list_issues`.
- The issue gets the screenshot, the criterion with its evidence, the reviewers'
  open notes on the step and a link back to the step. The project or team comes
  from the admin's mapping per Kaloko project; `--target WEB` overrides it.
- The returned note on the step (or a new comment) mirrors the issue: when the
  issue is done or cancelled in the tracker, the thread gets a reply and is
  resolved; reopened, it opens again. Do not resolve that thread yourself.
- Needs the Developer / Tester role and a token with the comment scope. A 409
  means the tracker is not connected or the project has no mapping: tell the
  person, an admin sets it up.
- Name the issue key in the branch (`feat/WEB-12-gift-cards`, Linear's
  `anna/eng-42-…`) or the pull request title, or `issue: { key: WEB-12 }` in the
  scenario: the run links to the issue and the issue gets a comment with the run.

Ask before filing issues in bulk; one issue per real problem, not per criterion.

## Channels per project

Slack and Teams channels are chosen per project by an admin, with the events
each wants (new run, returned, accepted, comment, mention, release recorded,
waiting for approval, health got worse) and quiet hours. Nothing to do from the CLI: sharing,
returning and recording a release reach the right channels. Restricted projects
reach only channels that name them.

Required approvers are asked by name: a run that waits for them sends each one a
Slack direct message (when their e-mail is in the workspace) with a link into
review mode, names them in channels that take "waiting for approval" (the Teams
route), and reminds them once after 24 hours by default. Do not message
approvers yourself after sharing; tell the person the run is waiting and give
the review link.

## Hosted runs

Kaloko can open a read-only scenario's pages on its own browsers every day or
week and share the run like yours (Business plan, a monthly page budget):

```bash
kaloko schedule add --scenario qa/flows/public.yml --env production --every day --at 5
kaloko schedule add --scenario qa/flows/account.yml --env staging --every week --weekday mon --account anna
kaloko schedule list            # next and last run, pages used this month
kaloko schedule run <id>        # starts within 15 minutes
kaloko schedule pause|resume|remove <id>
kaloko schedule hook <id>       # URL + secret that start the run after a deploy (secret shown once)
```

- Run after a deploy: `kaloko schedule hook <id>` prints a trigger URL and a
  secret. A deploy (Vercel through a `deployment_status` workflow, Netlify's
  outgoing webhook with the secret as JWS token) or any CI job calls
  `curl -X POST <url> -H "Authorization: Bearer <secret>"`. Put the secret in the
  CI or hosting secrets, never in a file you commit, and do not echo it into logs.

- Works for: public pages, pages behind HTTP Basic (the environment's
  `access.basic` variables are sent once and stored encrypted), and signed-in
  pages through a session saved with `kaloko auth save` (`--account`, cookies only).
- Opens only steps whose script just opens the page (`steps/open.mjs`, or a
  script that only calls `page.goto`). Steps that click or type are left out and
  named in the answer. Criteria decided: `exists`, `absent`, `count`, `text_*`,
  `attr_*`, `title_matches`, `meta_matches`; the rest shows "not evaluated".
- Health alerts: a hosted run (and a run shared from CI) compares its health
  with the previous run of the scenario and alerts the followers, the channels
  and the `health.worse` webhook on a new error-level finding. Each schedule
  sets it to `error` (default), `warning` or `off` on kaloko.app or with
  `kaloko schedule add --health-alert`; changing it is the person's call.
- Does not work for: native apps, local or private addresses (localhost, IPs,
  `.local`), header credentials, base URLs per locale.
- For those, or for the full walk on a schedule, write a GitHub Actions
  workflow instead: `kaloko schedule export github --scenario <file> --env <name>
  [--every week] [--at 5]`. It names the repository secrets it needs.
- A 404 from `schedule add` means hosted runs are not enabled on this service:
  use the workflow.
