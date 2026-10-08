# Collaboration: share, feedback, inbox

A run is only worth something once the people who decide have seen it. The
loop teams use:

1. **Share the run** (`kaloko share`, tester token, after asking). The
   command prints the canvas URL and one line on what waits for a person,
   e.g. `12 steps unchanged, approvals carried over; 5 need review: <link>`.
   Give the person that review-mode link (it ends in `#review`) with the
   counts, not just the canvas.
2. **Put the link where the work is tracked.** When the branch has a pull
   request and `gh` is signed in, `kaloko share --pr` posts one comment per
   scenario on it (summary line, canvas link, criteria that need attention
   with evidence) and updates that same comment on every later run, so the
   PR never fills up with Kaloko noise. In CI `KALOKO_PR` names the pull
   request of a detached checkout, and on GitLab merge requests the comment is a
   note on the MR (`KALOKO_GITLAB_TOKEN`). Otherwise write the comment yourself:
   what was tested (scenario, environment, locales), the summary line
   (`n/m steps passed`), every failing or `needs_review` criterion with
   evidence, and the canvas URL. Reviewers accept, return or comment on the
   canvas.
   When the organization connected the Kaloko GitHub App (Settings →
   Integrations), the same share also creates a check on the pull request
   that waits for review and turns green or red with the verdict; do not
   report it as passed before a person accepted the run.
3. **Read feedback before continuing.** `kaloko feedback` lists the run
   verdict, returned steps first (with the reviewer's note), open comments,
   failed manual criteria and how many steps still wait for a person.
   `kaloko review` (or MCP `get_review_queue`) says exactly what a person
   still has to decide; see *Review mode* below.
   `kaloko inbox` lists what needs your attention across runs: mentions,
   returned runs, rejected steps in your runs, new runs of scenarios you
   reviewed, and expiry warnings. Both take `--json`; `kaloko inbox --read`
   marks the shown items read.
4. **Work through the comments, then close them.** See *Processing
   feedback* below.
5. **A returned run means fix, then a new run.** Runs are immutable; never
   patch a shared run. Start a new one on the same scenario, share it and
   reply in the tracker with the new link. The reviewer who returned it is
   told about the new run automatically.

## Review mode

Reviewers decide in **review mode** on the canvas (`Q`, the Review button,
or a link ending in `#review`): one step at a time, the steps that need a
person first (failed, returned, the AI was unsure or did not evaluate,
changed since the last accepted run, open comments), with the accepted run
beside it. `J`/`K` move, `A` approves, `R` returns with a note, `C`
comments; at the end they accept or return the run.

- **Approvals carry over unchanged steps.** When a new run is shared, a step
  whose screenshots are byte-identical to the last accepted run, whose
  criteria are the same and whose deterministic checks pass keeps the
  approval a person gave it there, with its origin (who, when, which run).
  Only changed or failing steps go to the queue. Anyone can revoke a carried
  approval; the step then waits again. Organizations on Business can turn
  this off (Settings → Approvals).
- A carried approval never accepts the run and never counts for required
  approvers: the run verdict is always a person's decision.
- **Report what waits**, do not decide it: run `kaloko review` (add `--json`
  for the data, `--run <id>` for another run) or MCP `get_review_queue` and
  tell the person how many steps wait and give them `review_url`.
- **Never approve or accept on a person's behalf.** Decisions by tokens and
  agents (MCP `decide_step`, `add_comment` with `approved`) are recorded as
  yours, shown apart, and do not count as a person's unless the organization
  allows it. Return a step only when you found a real problem, with a note.
- Returned steps are feedback: fix them, share a new run, and resolve the
  thread with what changed (see below).

## Processing feedback

Comments are threads in three places:

- **A step:** optionally pinned to a position on the screenshot
  (`pin: {x, y}` as fractions, per viewport), drawn on it (a box, an arrow or
  a line: `shape`, with `region` giving the area as fractions and in CSS
  pixels of the page, and for an arrow the point it aims at), or attached to
  an element of a live design step (`anchor`). Comments may carry images
  (`attachments`, each with a download URL that needs the token).
- **The whole run:** `node_id` is `''`.
- **The whole flow:** these stay across runs, e.g. "add the empty-cart
  state".

`kaloko feedback` (or MCP `get_feedback` / `list_comments`) shows the open
ones with their ids and replies. A comment written by an agent carries the
agent's name (`KALOKO_AGENT`, e.g. `claude-code`), so people can tell who
said what.

The loop, for every open thread:

1. **Understand it.** A `region` says exactly where to look: `px` is
   `[x, y, width, height]` in CSS pixels of the captured page for that
   viewport (`region.viewport`) and locale; find the element there in the
   step's HTML or screenshot. Download attached images (a corrected copy, a
   reference) before you change anything. Open the canvas link when a pin or
   an element matters.
2. **Fix it** in the code or the scenario. When the comment asks for a
   change of intent (criteria, scope), ask the person first.
3. **Answer and close.** Use
   `kaloko comment --resolve <id> --note "Fixed in <commit>: <what changed>"`
   (add `--flow` for flow comments; MCP `resolve_comment` takes the same
   `note`). The closing note is a reply in the thread, and the author is
   told in their inbox.
4. **When you disagree or need a decision,** reply with
   `kaloko comment --reply <id> --note "…"` and leave the thread open.
   Mention the person with `@name` when they must act; mentions are mailed
   at once.
5. **Share a new run** once the fixes are in, and link it in the tracker.
   Resolved threads stay visible under "Resolved" on the canvas.

Rules:

- Never resolve a thread you did not address.
- Never delete other people's comments; the service refuses anyway.
- Your own comment may be edited (`--edit <id>`) or deleted (`--delete <id>`).
- A rejected step (`status: rejected`) is feedback like any other: fix it,
  resolve it, share again.

People see open counts next to flows and runs in the app, on map nodes and
index rows, and in the canvas's *Comments* panel (`#comments=all|run|flow`
in a link). Mails:

- **Right away:** mentions, rejected steps, returned runs and runs waiting
  for approval.
- **In the digest:** new comments, replies, resolutions and new runs, as a
  daily or weekly mail grouped by flow.

## Presenting a run

For stakeholders who do not read canvases, open the run in **Replay**
(button in the top bar, key `R`, or `#replay=1` in the URL): one step at a
time with its screenshot, purpose and criteria, a single *Next* action, and a
choice of branch at every decision node. `#replay=1&step=<id>&path=a,b,c`
deep-links a specific path, so an issue comment can point at "the sign-in
branch, step 3". Replay reads the manifest only; nothing is uploaded.

For people who work through a list rather than a flow (QA leads, content
and SEO teams, big runs), switch the canvas to **Index**. Use *Map | Index*
in the top bar, the key `I`, or `#mode=index` in the URL.

- **Rows:** every step in flow order, grouped by section. Each row shows
  a thumbnail, status, passed criteria, failing criteria, HTTP status and
  console errors.
- **Filtering:** by status, plus search over titles, paths and criteria.
  The search also reaches the pages inside stacks.
- **Stacks:** a stack step is a folder. Opening it shows its page index
  with a breadcrumb back to the run.
- **Navigation:** the sidebar selects rows, and the lightbox's previous and
  next follow the filtered list.
- **Export:** CSV of the rows.
- **Links:** `#mode=index&step=<stack>` links straight into a folder.

## Public runs

An admin can make one run per scenario **public** (canvas report → *Make
public*, or `kaloko public --run <id>`): readable without sign-in, reviewer
names hidden, embeddable in an iframe. Use it for demos, status pages or
sharing with people outside the organization, and only for scenarios that
show no personal data. A tester token may later move the flag to a newer run
of that scenario, which is how a scheduled demo refresh works.

## Staying informed without the app

Members choose in Settings → Profile a daily or weekly e-mail digest of
their unread inbox and whether to get an immediate mail when their run is
returned or a step rejected; every mail has an unsubscribe link. Admins can
connect one Slack channel (Settings → Integrations, "Add to Slack") that
receives new shared runs, rejected steps and run verdicts. None of this
changes what agents do: share the run, post the link, read the feedback.

## Mentions

`@name` in a comment or verdict note notifies that colleague in the app
(the part of their e-mail before `@`, e.g. `@anna` or `@anna.novak`; a full
e-mail works too). Use it when a step needs a decision from a specific person
(design, legal, product owner) instead of asking in chat.

## Verdicts and baselines

- Reviewers set a **run verdict**: accepted, returned (with a note) or
  pending. Testers see the note in `kaloko feedback` and in the inbox.
- An accepted run may be the scenario's **baseline**. Later runs compare
  against it; report differences against the baseline, not only against the
  previous run.
- `kaloko compare [--run <id>] [--baseline <id>] [--json]` prints the text
  diff (step statuses, criterion verdicts, scores, evidence) of the current
  run against the baseline, or the previous run when there is no baseline.
  Put the relevant lines in the issue comment. On the canvas the same
  comparison is the **Compare** selector in the top bar (or `#cmp=<run>` in
  the URL): pixel differences per step, changed criteria, and a side-by-side
  or diff view in the lightbox, plus *Swipe* (a divider dragged across both
  screenshots) and *Onion skin* (this run faded over the other). Pixel diffs
  are computed in the browser; nothing is uploaded. **G** opens the grid: one
  step in every locale and viewport at once, failing cells marked.
- **Manual criteria** are decided on the canvas by a reviewer; treat a
  reviewer's `fail` like a failing deterministic check.
- Admins may name **required approvers** per scenario (Settings). Such a
  run stays `pending` until every one of them approved; `kaloko feedback`
  prints `awaiting approval from: …`, so do not treat a single approval as
  acceptance there. Those approvers are asked on their own (mail, inbox,
  Slack or Teams, one reminder); do not ping them again.
- An accepted run has a **signed acceptance record** (Business and up): the
  run, scenario, commit and environment, who approved what and when (people
  apart from tokens and agents, approvals carried over unchanged steps with
  where they came from), criteria results, capture hashes and the hash of
  `run.json`, signed with the service's Ed25519 key. `kaloko signoff <run>`
  downloads the JSON and the PDF and checks them; `kaloko signoff --verify
  <file>` checks a record someone handed over (public key at
  `/.well-known/kaloko-signoff.json`). Give it to the person when they ask
  for proof of acceptance; never create one for a run that is not accepted.

## Cleaning up runs

Re-running a scenario after every fix is expected, and it fills the list: the
scenario list (the organization home) shows one row per scenario, and `/runs`
shows the newest run per scenario with "+ N older" unless a filter is set.
Clean up so the history stays readable; everything goes to the trash, which
can be restored until it is purged.

```bash
npx kaloko runs                              # newest run per scenario, "+ N older"
npx kaloko runs --scenario TASK-1273-cart    # every run of one scenario
npx kaloko trash <run-id>...                 # soft delete (uploader or admin); kaloko restore <run-id>
npx kaloko prune --scenario TASK-1273-cart --keep 3            # dry run: lists what would go
npx kaloko prune --scenario TASK-1273-cart --keep 3 --yes      # ask first
npx kaloko keep <run-id>                     # never expires, never pruned (--off to undo)
npx kaloko archive TASK-1273-klub            # retired scenario, ask first (admin); --undo
```

- **Without asking:** trash runs you uploaded in this session that were
  superseded before anyone looked at them (debug rounds without comments or a
  verdict), and a dry-run `prune`.
- **Ask first:** `prune --yes`, trashing someone else's run, archiving a
  scenario.
- **Never:** trash an accepted run, a baseline, a run with review comments, or a
  run linked from an open PR or issue comment. `prune` already keeps kept,
  accepted, baseline, design-reference and commented runs, and without the admin
  role it trashes only your own runs.
- After splitting or renaming a scenario, propose archiving the old one
  (`archived: true` in its file, or `kaloko archive <id>`). `kaloko validate`
  warns when the service still lists a scenario whose file is gone.
- Report clean-ups in the tracker next to the run links: which runs went to the
  trash and why.

An organization admin can turn on automatic clean-up after each share in
Settings → Storage (keep the newest N per scenario and environment).

## API for agents and CI

Everything above is available over the API with an organization token:

- `GET /api/v1/orgs/<org>/feedback?run=<id|latest>[&scenario=<id>]`
- `GET /api/v1/orgs/<org>/runs/<id>/review-queue` (or
  `GET /api/v1/orgs/<org>/review-queue?run=<id|latest>&scenario=<id>`):
  `items` in review order with `reasons`, `decision` (approved, returned or
  carried, with who and how), `unconfirmed` (an agent's or token's decision
  that does not count), `changed`, criteria with evidence, `screenshots` and
  `ref_screenshots`; `carried` with provenance; `counts` (`queue`,
  `decided`, `pending`, `carried`, `clear`); `reference` (the accepted run);
  `review_url`. Decisions use the comment and verdict routes;
  `POST …/runs/<id>/carried/<step>/revoke` revokes a carried approval.
- `GET|POST /api/v1/orgs/<org>/runs/<id>/comments` (a step: `node_id`;
  the whole run: `node_id: ""`), `GET|POST …/scenarios/<id>/comments`
  (the whole flow), and per comment `PATCH`, `DELETE`, `POST …/<cid>/resolve`
  (with `note`) and `…/<cid>/reopen`; `GET /api/v1/orgs/<org>/comments?state=open|all&scenario=&run=&mine=1`
  across the organization. Lists of runs and scenarios carry `open_comments`.
  A comment body may carry `shape` (`{kind: box, box: [x, y, w, h]}`,
  `{kind: arrow, from, to}` or `{kind: pen, points}` in fractions, with
  `viewport` and `size`) and `attachments` (ids from
  `POST …/comments/attachments?name=<file>` with the image as the body: PNG,
  JPEG, WebP or GIF up to 5 MB, counted in the plan's storage).
- `GET|POST /api/v1/orgs/<org>/runs/<id>/ignore-regions`,
  `DELETE …/ignore-regions/<rid>`, `GET …/scenarios/<id>/ignore-regions[?state=all]`
  and `POST …/scenarios/<id>/ignore-regions/applied` (`{ids}`): regions drawn
  to leave out of pixel diffs (drawing needs Developer / Tester).
- `GET /api/v1/orgs/<org>/runs/<id>/signoff` (JSON), `…/signoff.pdf`,
  `…/signoff.html`: the signed acceptance record of an accepted run.
- `GET /api/v1/orgs/<org>/notifications[?unread=1]`, `POST` with
  `{"read": "all"}` or `{"read": [ids]}`
- `GET /api/v1/orgs/<org>/runs[?project=&scenario=&kind=&verdict=&author=&environment=&branch=&q=][&latest=1]`
  (`latest=1`: the newest run per scenario with `older`), `GET /api/v1/orgs/<org>/runs/<id>`
- Paging: runs, `comments`, `notifications`, `tokens` and `audit` take
  `?limit=` and `?cursor=`. The body keeps its shape (an array stays an
  array); the next page is named in the `X-Next-Cursor` header and in
  `Link: <…?cursor=…>; rel="next"`, and object answers (`notifications`,
  `audit`) also carry `next`. No header, no next page. `projects` and
  `products` answer the complete list.
- Clean-up: `DELETE …/runs/<id>` (trash), `POST …/runs/<id>/restore`,
  `POST …/runs/<id>/keep` with `{"keep": true|false}`,
  `POST /api/v1/orgs/<org>/runs/prune` with `{ scenario?, project?, environment?, keep_latest: 3, older_than_days?, dry_run: true }`
  (answers `trash` and `kept` with reasons), `POST …/scenarios/<id>/archive`
  and `…/unarchive` (admin)
- `GET /api/v1/orgs/<org>/runs/<id>/export.zip` (`kaloko export`): the whole
  run as a zip before it expires; keep it with the issue when the evidence
  must outlive the retention period.
- Uploads by content hash: `POST …/blobs/missing` with `{"hashes": [sha256…]}`
  answers what the organization does not store yet, `PUT …/blobs/<sha256>`
  (header `X-QAwalk-Type: png|webp|html|json`) stores one, and the run's file
  plan `POST …/runs/<id>/files` takes `{ path, bytes, blob }` entries that
  point at stored blobs. `kaloko share` does this: unchanged captures are not
  sent again and a share that broke off resumes when run again.
- MCP server for agents: see [mcp.md](mcp.md).

Read-only tokens may list but not change anything; keep CI tokens read-only
unless the job publishes runs.
