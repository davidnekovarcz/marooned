# MCP server

`https://kaloko.app/mcp` speaks MCP over Streamable HTTP (JSON-RPC 2.0,
POST only, one message per request). Authenticate with an organization API
token as `Authorization: Bearer kal_…`. The server is part of the Team plan
and up. A read-only token is enough to read; tools that write need a token
with that scope, as noted below. Nothing binary crosses MCP: summaries carry the URLs of
screenshots and files, which the same token can fetch over HTTPS.

## Configure

Claude Code:

```bash
claude mcp add --transport http kaloko https://kaloko.app/mcp --header "Authorization: Bearer $KALOKO_TOKEN"
```

Codex / other clients: an HTTP MCP server with URL `https://kaloko.app/mcp`
and the same header. Keep the token in the environment, not in a committed
file.

## Tools

List tools (`list_runs`, `list_notifications`, `list_comments`) answer one page: when more match than `limit`, the
answer's `next` holds a cursor (also as a second text block). Call the tool again with `cursor: <next>` until `next`
is null. Projects and products come complete, without pages.

| Tool | Use it for |
|---|---|
| `list_runs` | published runs, newest first; filters `scenario`, `project`, `verdict`, `author`, `environment`, `branch`, `limit`; `cursor` for the next page |
| `get_run_summary` | one run: statuses per step and locale, criteria that need attention with evidence (semantic ones with score and the evaluator's one-sentence `reason` per locale and viewport), regions ignored in pixel diffs and regions seen moving (`ignored_regions`, `unstable_regions`), screenshot URLs, verdict, baseline, canvas URL, open feedback |
| `get_feedback` | run verdict with note, approved steps, unresolved rejections and comments, failed manual criteria (`run_id`, or `scenario` for its latest run) |
| `list_notifications` | the token owner's inbox (`unread_only`, `limit`, `cursor`) |
| `list_projects` | projects of the organization with counts; the slug is the `project` filter of `list_runs` and the value for `project:` in a scenario |
| `upsert_project` | creates a project (`slug`, `name`, `visibility`, `product`; `create: true` refuses an existing one) or renames it; the same rules as `kaloko projects create\|rename\|sync` (a full token; renaming is for the project's admin). Ask before renaming |
| `get_criteria_verdicts` | reviewer verdicts on manual or overridden criteria of a run |
| `get_stack_items` | the pages of a stack step (`run_id`, `step`; filters `status`, `criterion`, text): path, URL, title, status and failing criteria with evidence, screenshot URLs |
| `get_step_recording` | a step's recording and trace (`run_id`, `step`, `locale`, `viewport`, `trace: true` for the full trace): video URLs, duration, its chapter of a flow recording, failed attempts, the trace summary (failed requests, console errors, slowest request); see [recording.md](recording.md). `get_run_summary` lists trace summaries per step too |
| `get_review_queue` | what a person still has to decide in a run (`run_id`, or `scenario` / nothing for the newest run): steps in review order with reasons, decisions, approvals carried over unchanged steps with their origin, counts and `review_url` to give the person |
| `decide_step` | records your (the agent's) decision on a step: `approve`, or `return` with a `note`; marked as an agent's and not counted as a person's. Never use it to approve for a person |
| `revoke_carried_approval` | revokes an approval carried over to a step that looks unchanged but should be looked at again (`run_id`, `step`) |
| `get_step_assets` | documentation layer (Business): newest capture of every step of a scenario with stable image, HTML and metadata URLs (`scenario`, `step`, `locale`, `viewport`, `accepted`) |
| `list_products` | the products the caller reads: name, modules, the projects it maps that the caller sees, the newest release, published docs (versions, languages), who reads it (and the public link), whether the caller manages it, links to its page, changelog and docs |
| `get_changelog` | the visual changelog of a product (`product`, `version`, `resolve: true` for the pictures, `limit`): releases newest first with the entry as written and its groups; see [docs.md](docs.md) |
| `draft_changelog_entry` | what accepted runs since the last release (or `since`) show differently, as a Keep a Changelog draft with before/after step references (`product`, `since`) |
| `resolve_step_image` | one step reference (`ref` = `kaloko:<scenario>/<step>?…[#<detail>]`, `product`, `version`, `locale`, `viewport`, `detail`) as a signed image URL with its run, how the version was found and canvas links; `video` (mp4, webm, duration_ms) when the step's recording plays (`media=video` / `media=image` in the ref); with a detail id the detail's picture and `detail` { id, name, box, size }, or the whole screen with `detail_missing` |
| `get_docs` | a product's published docs (`product`; without `path` the versions, languages and sidebar; with `path` one page with its Markdown, sections, stale sections and, with `resolve: true`, its pictures) |
| `docs_check` | what needs attention in the published docs of a version: broken step references, references without an accepted picture, stale sections, missing or outdated translations, release items without a picture |
| `list_step_changes` | documentation layer: steps whose capture or status changed since the previous accepted run or `since` (`scenario`, `since`, `accepted`); see [documentation.md](documentation.md) |
| `get_started` | where the organization stands (`empty`, `sample`, `active`), its sample run, the next steps and a prompt; call it in a new project, see [first-run.md](first-run.md) |
| `add_sample_run` | adds the sample run (or returns the one there is); needs an upload or full token and the Developer / Tester role |
| `search_screens` | the screen library: newest screenshot of every step across the organization's flows (`q` words matched against titles, ids, paths, URLs, page title and H1; `project`, `product`, `module`, `scenario`, `locale`, `viewport`, `device`, `status`, `environment`; `source: design` or `all` for design versions; `group: none` for every locale and viewport; `cursor` from `next`), each with a signed image and the canvas link |
| `get_health` | the advisory health of a run (`run_id`), the newest run of a scenario (`scenario`) or the trend of a project (`project`): findings by severity, pack and step with evidence and a fix, and what is new or fixed since the previous run; never a verdict, see [evaluation.md#health](evaluation.md#health) |
| `adopt_health_check` | turns a health check into an acceptance criterion of the scenario (`run_id`, `step`, `check` such as `HC103`, `text` to reword it; it becomes `AC103` with `from: HC103`); Developer / Tester role. Only when the person asks; `kaloko health pull` then writes it into the scenario file |
| `get_affected_steps` | which steps of a scenario changed files reach, with the reason per step (`scenario`, `changed_files`, `run_id`, `upstream`); route files are matched against the step paths and URLs of the newest run. Imports and `affects:` globs need the repository: `kaloko affected` follows them |

## Comment tools

| Tool | Use |
|---|---|
| `list_comments` | open threads (or `state: all`) across the organization, filtered by `scenario` or `run_id`, with replies, pins, anchors, drawn regions (`region.px`: CSS pixels of the page in `region.viewport`), attached images with URLs, and who wrote them; `limit`, `cursor` |
| `add_comment` | comment on a step (`run_id` + `step`), the whole run (`run_id`) or the whole flow (`scenario`); `parent_id` replies; optional `pin` `{ x, y, viewport }` or `shape` (box or arrow in fractions, with `viewport` and `size`) |
| `list_ignore_regions` | regions people drew to leave out of pixel diffs, per step, with the `ignore:` entry each becomes (`kaloko stability --pull` writes them) |
| `add_ignore_region` | suggest such a region (`run_id`, `step`, `viewport`, `rect` in CSS px); Developer / Tester, scope upload or full |
| `get_findings` | experimental Clef triage findings of a run (`run_id`): the kind of problem on each screen or in recording frames, with probability, severity and box, and the answers testers gave. Findings never change a verdict |
| `answer_finding` | answers a finding (`run_id`, `node`, `locale`, `viewport`, `finding`, `kind`, `answer`: right, wrong or comment with the `comment_id` from `add_comment`); scope comment |
| `get_triage_report` | the organization's Clef numbers of the last 90 days (read-only): findings shown and answered, precision and calibration per kind, findings turned into comments, median hours to the first review with and without findings, triage requests per useful finding. Report them as they are; the go/no-go is a person's |
| `get_signoff_record` | the signed acceptance record of an accepted run (Business): approvals with provenance, criteria, capture hashes, signature |
| `get_evidence` | the evidence of a run (any shared run) or a release (Business, `qawalk.evidence.v1`): acceptance and signing state, criteria as walked with `refs`, who assessed each result (AI advisory), screenshots with SHA-256, decisions, signatures, audit trail, trace matrix ([evidence.md](evidence.md)) |
| `resolve_comment` | close a thread with a `note` that says what changed (it becomes the last reply) |
| `reopen_comment`, `edit_comment`, `delete_comment` | reopen; edit or delete your own comment |
| `create_issue` | a Jira or Linear issue from a step (`run_id`, `step`, `to`: jira or linear, optional `criterion`, `title`, `note`, `locale`, `viewport`, `target`): screenshot, criterion, notes and a link back; the step's thread resolves when the issue is done. Developer / Tester, scope comment; see [integrations.md](integrations.md) |
| `list_issues` | issues created from steps with key, URL and state (`run_id`, `scenario`, `state`) |
| `list_schedules`, `run_schedule` | hosted runs: schedules of read-only scenarios on Kaloko's browsers with the month's page budget; start one now (`id`) |

Writes here need a token with the `comment` scope (or full); `add_ignore_region`
and `run_schedule` need upload or full. Follow *Processing feedback* in
[collaboration.md](collaboration.md).

Typical loop for an agent that owns a task: `list_runs` with the scenario →
`get_feedback` for the latest run → fix what was returned → new run with the
CLI (`kaloko start … share`) → post the canvas URL in the issue. Capturing,
evaluating and uploading stay in the CLI; MCP reads, comments, records
decisions and answers to findings, creates issues, and for design drafts also
publishes versions and sets references and step status (below).

Errors come back as tool results with `isError: true` (unknown run, expired
run, missing argument); an invalid token is HTTP 401.

## Design tools (#42)

The same data and permissions as the REST API; each tool is its REST route.

| Tool | Use |
|---|---|
| `get_draft` | which revision each step shows, step status, who changed it (person or agent) |
| `get_step` | the handoff: live files, signed entry URL, token set, page structure, open comments (`ref`: draft, design, vN, run id) |
| `get_step_spec` | what to build for a step as approved: elements with role, name and selector, styles mapped to tokens, states, contrast (`ref`: design by default, draft, vN, run id; `format` text or json) |
| `get_step_drift` | how an implementation run (`run`: id or `latest`) differs from the design reference, per element: expected token against the actual value |
| `get_step_history` | versions, and revisions of a step with authors |
| `list_step_changes` | steps that differ between two references (default design reference → draft) |
| `get_references`, `get_tokens` | design reference and baseline; the project's token set |
| `get_draft_feedback` | draft comments, pinned ones with their element |
| `get_version_notes` | what changed in a version (`version`: vN or run id) or what publishing the draft now would say (`version: draft`): a summary and one plain sentence per changed step; text by default, `format: json` for the structure |
| `publish_version`, `set_reference`, `set_step_status`, `add_draft_comment` | writes: need a token with scope full; ask first where the skill says so. `publish_version` takes `notes` (a summary, then `step-id: text` lines, or `{ summary, steps }`) |
| `set_version_notes` | rewrite the summary or step texts of a published version's notes (design scope) |

Files are not uploaded over MCP: the CLI (`kaloko sync`) or the REST blob endpoints carry them.
