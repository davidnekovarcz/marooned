# Execution

```bash
kaloko start --scenario docs/tasks/TASK-1/qa/scenario.yml --env local [--locales cs,en]
kaloko browser start            # shared Chromium with CDP for the run's environment (its policy, own profile and port)
kaloko walk                     # runs steps with strategy playwright + script
kaloko open --step <id> --locale cs
kaloko capture --step <id> --locale cs          # all viewports of the run
kaloko capture --step <id> --crop ".selector" --title "What this shows"
kaloko mail --step <id> --locale cs             # e-mail step from the environment's mailbox
kaloko mail --step <id> --file message.eml      # e-mail you obtained yourself (.eml, .html, .json, .txt)
kaloko auth save --env staging --account admin  # a person signs in once (SSO, MFA); walk reuses it
kaloko session reset            # new visitor: clear cookies and storage in the shared browser
kaloko status
```

Commands act on the current run (`CURRENT` in the output directory). When
other agents or people may start runs in the same repository, pin yours:
`--run <id>` on every command or `KALOKO_RUN=<id>` in the environment.

`walk` resets the session before the first step of a run; agent-driven steps
call `kaloko session reset` themselves when the plan starts as a new visitor.

`start` prints a unique test e-mail address for the run; use it in forms so
`mail` can find the message.

## Choosing a strategy per step

- `playwright` — stable, repeatable steps. The script exports
  `default async ({ page, url, locale, capture, crop, acceptDialogs, env, run, session, node })`
  (`node` is `{ id, title, kind }` of the step being walked, so one script can serve several steps);
  `walk` captures automatically after the script unless it called
  `capture()`. With `sessions` in the scenario, `page` and `context` belong
  to the node's person (`session.key`, `title`, `mailbox`, `account`, and
  `credentials` for that account in the run's environment; see
  [environments.md](environments.md#accounts-and-sign-in)).
- Step states: a step with `states: [empty, error]` runs its script once
  more per state with `state` (`'default'` first, then `'empty'`, …); bring
  the page into that state (route a mocked API response with `page.route`,
  empty the cart) before the capture. Each run captures that state's keys
  (`mobile.state-empty`). For a step an agent walks:
  `kaloko capture --step <id> --state empty`. App scripts get `state` too.
- `agent` — steps that need judgement or change often. Follow
  `execution.instructions`, then `kaloko capture --step <id>`.
- `manual` — a person does it; you capture afterwards.

Prefer turning an agent step into a playwright script once it has worked
twice the same way.

A step script brings the page into the state the step accepts; it does not
check it. Do not compute a result in the script and write a `data-qa-*`
marker into the page for a criterion to find. The URL, computed styles and
values in the page have their own checks (`url_matches`, `style_equals`,
`js_equals`; see [acceptance.md](acceptance.md#url-computed-styles-and-values-in-the-page)).

## Driving the shared browser with your capabilities

- Browser tool over MCP (e.g. Playwright MCP): connect to the CDP endpoint
  printed by `kaloko browser start`, act, then capture.
- Computer use: run `kaloko browser start --headed` and operate the window.
- Shell only: write a short Playwright script (`chromium.connectOverCDP`) or
  a scenario step script and use `walk`.

There is one shared browser per environment (`browser.port` + the
environment's position in the config): a production run never shares a tab
or a cookie jar with local work, and the CLI refuses a readonly run in a
browser without the readonly policy. `walk` works in its own tab; agents and
people keep theirs. Several agents on the same environment share cookies, so
run one scenario at a time per environment: `walk` takes a lock on the shared
browser and refuses a second run while one is walking. To walk several runs
in parallel, give each its own browser with `kaloko walk --ephemeral` (own
cookies and tabs; sign-in through saved account sessions still works).
Commands leave the shared browser running: they only disconnect from it.

Native dialogs (`confirm()` from Rails `data-confirm` / `data-turbo-confirm`,
`alert`, `prompt`) are unreliable on the shared browser when more than one
Playwright client is connected over CDP: a client without a handler can
dismiss the dialog before yours accepts it, and the action silently does not
happen. In step scripts call `await acceptDialogs()` before the click (it
replaces the functions in the page, also after navigations); in your own
scripts do the same with
`page.evaluate(() => { window.confirm = () => true })`.

The environment policy and gate apply to every context the CLI creates (the
shared browser, `walk` sessions, one-off captures): blocked paths and, when
readonly, non-GET requests outside `allowed_post_paths` fail and are listed as
blocked requests in the capture; the gate's credentials go to its origins only.

## Noisy regions (`--stability`, `kaloko stability`)

When pixel diffs between runs keep flagging the same clock, ad or carousel:

```bash
kaloko walk --stability 3        # 3 screenshots per capture, a moment apart; what moved is noted
kaloko stability                 # this run against the 3 previous local runs of the scenario
kaloko stability --apply         # adds the suggested ignore: to each step (block-style YAML only)
kaloko stability --pull          # regions people drew on screenshots on kaloko.app go into ignore:
```

`kaloko stability` writes `stability.json` and `stability.yml` into the run
and prints the suggestions per step: a selector when an element of the stored
page covers the region, otherwise a rectangle for one viewport. Look at the
screenshots before applying; a region that changed because the page really
changed is not noise. `--same-commit` compares only runs of the same commit,
`--runs a,b` names them, `--last N` sets how many runs are compared. Capture
the steps again after applying: the capture records the ignored regions.

People mark noise by hand too: a Developer / Tester draws a rectangle on a
screenshot (step detail → *Mark a changing region*). It is kept per flow, shows
dashed on every run and the canvas pixel diff already skips it.
`kaloko stability --pull` writes those regions into the scenario's `ignore:`
(appended to an existing block list, never twice) and tells the service they
are in the file; walk those steps again afterwards. MCP `list_ignore_regions`
lists them, `add_ignore_region` suggests one.

## Only what changed

After a fix, walk the steps the change reaches instead of the whole flow:

```bash
kaloko affected                      # which steps, and why (against origin/main; --base <ref>)
kaloko walk --affected [--carry]     # walk them; --carry copies the other steps from the previous local run
```

A changed file reaches a step when it is a route file whose route matches the
step's path or a URL captured for it earlier (Next.js `app/` and `pages/`,
Nuxt, SvelteKit, Remix, Astro, Rails views and controllers), when it is
imported by such a file, when it is global (layouts, global styles,
dependencies; i18n messages of one locale keep the walk in that locale), when
it is the step's script or the step changed in the scenario, or when it
matches the step's `affects:` globs. Steps on the main path before a selected
step are walked first (`--no-upstream` skips them); steps with
`affects: always` (sign-in, consent) are always walked. Files nothing maps are
listed as unmapped: add `affects:` to the steps they shape, or pass
`--if-unmapped all` to walk everything then. Changes to tests, docs and CI are
ignored.

```yaml
- id: checkout
  path: /checkout
  affects: [lib/payments/**, src/components/PriceSummary.tsx]
- id: consent
  affects: always
```

Report the selection with the run: which steps were walked and why, and that
the rest was not walked (or carried from which run).

## Several locales at once

Locales are independent, so `walk --concurrency N` walks N of them at the same
time, each in its own browser context (a new visitor per locale). In an own
browser (`--ephemeral`, CI) the default follows the CPU (up to 4); on the
shared browser it stays one at a time unless you ask, because people may rely
on its signed-in tabs. Each locale's lines are printed together, in locale
order. Set `walk.concurrency` in the config for the project's default.
Viewports of one step are still captured one after another on the same page.

## Selectors that moved

When a step script waits in vain for a selector (the button lost its id, the
class was renamed), the walk proposes a replacement from the page as it is
now: a test id, then role and accessible name, then a stable id, then the text,
preferring the element the old selector matched in the step's previous
capture. It prints the reason and a patch of the step script. Review it; if it
is the same element, `kaloko walk --steps <id> --heal` runs the step with the
patched script and writes the patch only when the step passes. Applying a heal
is fixing scenario mechanics; if the proposal points at a different element,
the product changed: report it, do not heal it. `--no-heal` skips the
proposals.
