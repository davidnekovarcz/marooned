---
name: kaloko
description: >
  Use when a task or flow needs an acceptance or regression walkthrough with
  evidence: writing or updating ACCEPTANCE.md or qa/scenario.yml, running a
  scenario on local, review, staging or production (readonly), capturing
  screens and e-mails, evaluating criteria, or building and sharing the
  Kaloko canvas, for web pages in Chromium, WebKit and Firefox, on phone,
  tablet and desktop presets, in light and dark mode, as well as Android, iOS,
  macOS and Windows apps,
  including checking many pages of one template at once (magazine articles,
  product pages, an SEO page catalogue). Also when someone asks what a
  reviewer rejected on a canvas, what is waiting in the Kaloko inbox, or how
  to report a run in an issue, and when designing screens of a flow in a
  design environment (live HTML steps, drafts, versions, the design
  reference, checking implementation against it, importing Figma frames),
  when looking for existing screens across flows, and when implementing a
  screen that has an approved design (read the step spec, build with its
  tokens, check drift), and when a step should be recorded on video or its
  trace read (actions, requests, console), and when a user-visible change
  should land in the visual changelog (CHANGELOG.md with step references,
  kaloko changelog draft, kaloko release) or a guide should show a step or
  be written, translated or checked (kaloko docs check), when screenshots,
  HTML or recordings must hide personal data (capture masks, pii: redact or
  pseudonymize, kaloko share stopping on unmasked data), when a run has
  Clef triage findings (experimental) to read, mention or answer, when
  a run's health (the advisory checks of packs: SEO, accessibility,
  performance, console) should be checked, fixed or adopted into acceptance,
  and when a team's own repository turns runs into quality evidence for its
  QMS or GxP (requirement refs, kaloko evidence, the evidence package, the
  evidence.ready webhook).
---

# Kaloko

Kaloko turns an acceptance plan into a run bundle (`run.json` + screenshots,
HTML, evaluations) and renders it as a flow canvas. You fill it with content;
the canvas, storage and collaboration are the service.

## Done means

- The scenario validates (`kaloko validate`).
- Every step in the requested scope has a capture, or the summary says why not.
- The captures are evaluated (`kaloko walk` ends with the verdicts; after
  `kaloko capture` run `kaloko evaluate`) and `kaloko build` ran; you report the summary line,
  failing criteria with evidence, and the preview path (or shared URL).
- Health was checked before you hand over (`kaloko health`, MCP `get_health`):
  you fixed what your change can fix, and you report the remaining counts and
  what is new since the previous run, apart from the verdicts.
- When the run was shared, its URL and the summary are in the issue or PR
  the work belongs to, the person got the review-mode link with what waits
  for them (`kaloko share` prints it; `kaloko review` repeats it), and you
  read `kaloko feedback` and `kaloko inbox` before continuing on that task.
- Changes to intent are written back to `ACCEPTANCE.md` (change log row).
- When the project keeps a visual changelog (`CHANGELOG.md`, `docs:` or
  `products:` in the config) and the change is user-visible: the Unreleased
  entry says it for people, with step references for the screens it changed
  (`kaloko changelog draft`), and new scenarios carry `product:` (and
  `module:`) when the config has products.
- When the project keeps docs (`docs.dir`, a `docs/` folder with step
  references) and the change is user-visible: the guides that show the changed
  screens say what people see now, their translations follow, and
  `kaloko docs check` reports no broken references or stale sections.
- When you implemented a step from an approved design: you read its spec
  (`kaloko spec <step>`), walked the implementation with `packs: [design]`,
  and `kaloko drift` is clean or the PR names each difference left for a
  person to decide.
- On a design environment: the folder follows the bundle rules and
  `kaloko design lint` shows no error, `kaloko walk` and `kaloko sync` ran,
  `kaloko status` shows no conflict, and you read the draft's feedback; a
  version is published only when the person asked, with notes that say what
  changed and why (`kaloko share --notes-preview`, then `--notes`).

## You may do without asking

Start the shared browser, walk a scenario on a non-production environment,
create test data there (users, roles, carts), capture screens and e-mails,
evaluate, build the preview, and fix scenario mechanics (selectors, scripts)
that do not change what is being accepted, including applying a selector
proposal with `kaloko walk --heal` when it names the same element, and pulling
the regions people drew to ignore into the scenario (`kaloko stability --pull`). Walk only
the steps a change reaches (`--affected`) and import screenshots into a run. Record steps locally
(`walk --record`) when a screenshot cannot show what a person has to judge, read traces, and
export a walkthrough video into the run folder. On a design environment: change
the design folder, walk, and sync the draft (including taking others' steps
with `--theirs`). Move to the trash runs you uploaded in this session that
were superseded before anyone looked at them (debug rounds: no comments, no
verdict), and run `kaloko prune` without `--yes` to see what a clean-up would do.
Draft and edit the Unreleased section of the changelog (`kaloko changelog draft
--apply`) and add step references to it and to guides. Put the products of the
config on Kaloko (`kaloko products sync`: it records no release) and list them
(`kaloko products list`). Create the project the config names
(`kaloko projects sync` or `kaloko projects create` with the name the person
gave). Write, translate and fix
guides in the docs folder, run `kaloko docs check`, and export them for a docs
site (`kaloko export docs --format …`) into a local folder.

## Ask first

Changing acceptance criteria or scope (adopting a health check into
acceptance with `kaloko health adopt` is such a change; pulling checks a
person already adopted with `kaloko health pull` is not), removing a pack or
keeping one in acceptance (`health.acceptance`), any production run, writing or
replacing a CI workflow (`kaloko ci github|gitlab`), uploading with
`kaloko share` (on a design environment: publishing a version), setting a
design reference or baseline, merging a design branch, keeping your version of
a step in a sync conflict (`--mine`), turning on `html_view`, turning on recordings for
a whole project (`capture.record` in the config: storage), a real clean-up
(`kaloko prune --yes`), trashing someone else's run, archiving a scenario,
renaming a project or restricting it (`kaloko projects rename`, a `kaloko
projects sync` that would rename), picking one site of a repository that
holds several (ask which one before `kaloko init` or a walk),
recording a release (`kaloko release`) or asking to publish a changelog,
publishing docs (`kaloko docs publish`, `--reviewed` above all: it says a
person checked the text), writing a release workflow (`kaloko ci github
--release`), and
anything the environment profile blocks. Never trash an accepted run, a
baseline, a run with review comments, or a run linked from an open PR or issue
comment. Never approve a
step or accept a run on a person's behalf, and never hand out a signed
acceptance record (`kaloko signoff`) for a run a person has not accepted, never present an AI verdict as a person's
decision in generated documents, and never change the signature policy; report what waits for them
(`kaloko review`, MCP `get_review_queue`) instead. Ask the person
for secret values (passwords, tokens, gate credentials) and for sign-ins only
they can do; never write secrets into the config, a scenario or a script. When
`kaloko share` stops on personal data, mask it and capture again; `--allow-pii`
only when a person says that value may be uploaded.

## Where to look

- A new project or an organization without runs of its own (install, sign in,
  the sample run, the first flow from a URL or a task, share, point the person
  to the canvas), and naming the project on Kaloko (`project_name:`,
  `kaloko projects create|rename|sync`): [reference/first-run.md](reference/first-run.md)
- A repository with several sites or apps (monorepo, Rails engines, Folio
  sites): ask which one, then `kaloko init --site … --base-url …`:
  [reference/first-run.md#several-sites-in-one-repository](reference/first-run.md#several-sites-in-one-repository)
- Writing or updating the plan and scenario: [reference/acceptance.md](reference/acceptance.md)
- Android, iOS (Simulator or a real iPhone), Electron, macOS and Windows apps,
  several devices of one app, WebViews inside apps, or screens captured by
  another tool (Maestro, Appium, XCUITest) with their UI tree:
  [reference/apps.md](reference/apps.md)
- Walking in WebKit and Firefox, on device presets (phones, foldables,
  tablets, TV), in dark mode, with reduced motion or as an installed PWA:
  [reference/devices.md](reference/devices.md)
- Many pages of one template in one step (articles, products, an SEO
  catalogue from a sitemap or a listing), with an index on the canvas:
  [reference/stacks.md](reference/stacks.md)
- Choosing playwright, agent or manual per step, driving the shared
  browser with your capabilities, walking only the steps a change reaches
  (`--affected`), several locales at once, and selectors that moved
  (`--heal`): [reference/execution.md](reference/execution.md)
- Evaluation, JEV thresholds, the vision evaluator and its reasons, reading
  results: [reference/evaluation.md](reference/evaluation.md)
- Health (CS Kondice): the advisory checks of packs, `kaloko health`,
  severities, fixing before review, adopting a check into acceptance, alerts:
  [reference/evaluation.md#health](reference/evaluation.md#health)
- Clef triage findings (experimental): what they are, how to report them apart
  from the verdicts, `get_findings` and `answer_finding`:
  [reference/evaluation.md#triage-findings-experimental](reference/evaluation.md#triage-findings-experimental)
- Hiding personal data in captures (`capture.mask`, `pii: redact`,
  `pseudonymize`, `pii: required` on an environment, the check before sharing):
  [reference/acceptance.md#capture-quality](reference/acceptance.md#capture-quality)
- Screenshots, walkthroughs, Playwright reports and traces that an agent or a
  tool already produced, laid out as a run: [reference/import.md](reference/import.md)
- Video of a step or a whole flow, traces (actions, requests, console) and the
  walkthrough video; when recording is worth its storage:
  [reference/recording.md](reference/recording.md)
- CI: a workflow that walks each pull request's preview deployment and
  comments on it (`kaloko ci github|gitlab`): [reference/ci.md](reference/ci.md)
- Environments, access (gates, accounts, sign-in), e-mails, readonly and
  production rules, and what is yours to arrange for the project's stack:
  [reference/environments.md](reference/environments.md)
- Sharing, review mode and approvals carried over unchanged steps, reviewer
  feedback, mentions, inbox, verdicts and baselines, compare views, the
  signed acceptance record (`kaloko signoff`), and cleaning up runs
  (trash, prune, keep, archive):
  [reference/collaboration.md](reference/collaboration.md)
- Reading runs, feedback and the inbox over MCP instead of the CLI:
  [reference/mcp.md](reference/mcp.md)
- Quality evidence for a team's QMS (ISO 9001, ISO 13485, IEC 62304, ISO 27001;
  GxP is the strictest case): requirement `refs:`, `kaloko evidence`, the
  evidence package and its check, the `evidence.ready` webhook, feeding a
  team's own document templates, signatures and what an agent must never do:
  [reference/evidence.md](reference/evidence.md)
- Filing a returned step or a failing criterion in Jira or Linear, issue keys in
  branches, channels per project, and hosted runs of read-only scenarios on a
  schedule (`kaloko issue`, `kaloko schedule`):
  [reference/integrations.md](reference/integrations.md)
- The visual changelog and guides with step references (`kaloko:<scenario>/<step>`):
  drafting the Unreleased entry, Diátaxis templates, translations, stale sections
  and `kaloko docs check`, training guides, exports, release tools in CI,
  products, modules and versions (`kaloko products sync|list`), who reads it:
  [reference/docs.md](reference/docs.md)
- Refreshing a manual, course or product documentation from the newest
  captures (latest URLs, changed steps, webhooks, export):
  [reference/documentation.md](reference/documentation.md)
- Designing in a design environment (bundle, sync and publish, comments,
  references, handoff, tokens, the design pack, canvas edits, branches, HTML
  view, presenting the prototype, exports, bringing your own design skill):
  [reference/design.md](reference/design.md)
- Bringing Figma frames in as design steps and the design reference
  (`kaloko design import figma`), notes on what changed in a version, and
  finding existing screens across flows (`kaloko screens`):
  [reference/design.md#import-from-figma](reference/design.md#import-from-figma)
- Implementing a screen from the approved design: read the step spec, build
  with its tokens, walk, check drift, fix:
  [reference/design.md#implement-from-the-approved-design](reference/design.md#implement-from-the-approved-design)
- Writing design pages that work on the live step, from disk and in other
  tools (relative URLs, no CDNs, state in the URL, deterministic content,
  links between steps; what `kaloko design lint` checks):
  [reference/portable-html.md](reference/portable-html.md)
- Command reference: `kaloko help` (`kaloko help --json` lists every command,
  sub-command and option as data); when something does not work (Chrome,
  token, environment URL, evaluator key), run `kaloko doctor` first and fix
  what it marks ✕. When a command answers "… is in kaloko X (you have Y)",
  the project's kaloko is too old for it: tell the person and suggest the
  update command from that line; change the dependency only when they agree.

Project configuration is `kaloko.config.yml` in the repository root.
Project skills may add conventions (paths, test data, locales); follow them
where they are more specific.
