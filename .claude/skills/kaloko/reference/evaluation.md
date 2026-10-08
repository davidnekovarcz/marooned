# Evaluation

`kaloko walk` sends the semantic questions of each step as soon as it is captured and ends with the
verdicts: what fails and what a person should look at, per step, locale and viewport. Use that list to fix
things right away. Steps captured later with `kaloko capture` need `kaloko evaluate`; it reuses every cached
answer, so running it again is cheap.

`kaloko evaluate` combines, per capture:

- deterministic results computed in the live page at capture time (with
  evidence: selector snippet, measured value);
- the semantic evaluator for semantic criteria. It is a replaceable provider;
  the default is JEV by TypeSafe (`TYPESAFE_API_KEY`), which reads the
  reduced page state (no images) and returns only a probability per question
  (`score`, 0–1). Verdicts: `pass` ≥ 0.85, `fail` ≤ 0.15, otherwise
  `needs_review` (thresholds in config);
- a vision evaluator for a second look with the screenshot (below);
- `manual` criteria stay `not_evaluated` until a reviewer decides.

Where the evaluator runs: with `TYPESAFE_API_KEY` set locally, your own key; without it, the organization's
service evaluates with its key (Team plan and up, a monthly allowance of questions; `kaloko evaluate` prints
"via Kaloko (340 of 1000 questions this month)"). Answers are cached by content locally and in the service, so
evaluating the same capture again costs nothing. `evaluators.jev.hosted: false` keeps it to your own key.
When neither is available, or the allowance is used up, semantic criteria stay `not_evaluated`; say so in the
report with the reason `kaloko evaluate` gives.

The default evaluator is text-only and most accurate in English. It is weak
at numbers, which is why those are checked deterministically.

## Vision and reasons

Every semantic verdict carries one sentence, `reason`, shown as "Why" next to
the score on the canvas, in `kaloko build`, in the walk summary and in
`get_run_summary`. With only the text evaluator the sentence says what it
read and how sure it was (JEV gives no explanation). The vision evaluator
gives a real one: it sees the screenshot, or a crop of the criterion's
`scope` (or `highlight`), and answers with a probability and what in the
image decided it. It is asked for:

- criteria with `vision: true` on the check (layout, imagery, "looks like the
  brand", anything the text cannot show);
- text answers in the uncertain band (0.15–0.85 by default), which would
  otherwise go to a person.

Its answer replaces the score (the text score stays as `text_score` in the
evaluation). Cost stays bounded: only those criteria, one request per
capture, images scaled to 1000 px wide and at most two tiles of a full page,
at most 40 uncached requests per evaluation, and answers cached by content
like the text ones. The provider is Anthropic's Messages API
(`ANTHROPIC_API_KEY`, model from `evaluators.vision.model`, default
`claude-opus-5-5`). Without the key it goes through the organization's
service, where one vision question counts as five of the monthly allowance;
when the text evaluator runs with your own `TYPESAFE_API_KEY`, the vision
evaluator also waits for your own key (`evaluators.vision.hosted: true`
lets it use the service anyway).
Configure or switch it off in `kaloko.config.yml`:

```yaml
evaluators:
  vision:
    when: uncertain      # flagged (only vision: true) | always | off
    uncertain: [0.15, 0.85]
    max_calls: 40
    reason_language: en  # cs for Czech reviewers
  # vision: false        # text evaluator only
```

Report the reason with each `needs_review` or failing criterion; when the
evaluator saw the screenshot, say so.

## Health

The checks of packs (`seo`, `a11y`, `perf`, `usability`, `console`,
`errors`, `app`) are the run's **health** (CS *kondice*): advisory, stored in
`node.health` and `summary.health` of `run.json`, never in `criteria`. They
do not change a step's status, the run verdict, the review queue, carried
approvals, required approvers, the acceptance record or exit codes. The
`design` pack and packs listed in `health.acceptance` stay acceptance
criteria. Runs shared before the split keep their stored verdicts; their pack
criteria show as health.

- **Check it before you hand over.** `kaloko walk` and `kaloko evaluate`
  print one health line; `kaloko health` lists the findings by pack with
  severity (error: people or search engines are shut out; warning: the rest;
  info: the evaluator was unsure), what is new or fixed since the previous run
  of the scenario, and a fix for each check. `--json` for the structure,
  `--remote` (or MCP `get_health`) for a shared run.
- **Fix what your change can fix**, walk the step again and check that the
  finding is gone. Leave the rest and say so.
- **Never hide health.** Do not remove a pack, raise a limit, narrow a
  selector or add `environments:` to make a finding disappear. A limit or a
  check that does not fit the project is the person's call; name it in the
  report.
- **Ids.** Health checks are `HC<n>` (`home:HC103`), acceptance criteria
  `AC<n>`. Runs from before 7 Oct 2026 say `AC103` for the health check;
  read it as `HC103`, and both ids work in commands and MCP.
- **Adopting is the team's decision.** `kaloko health adopt <step>:<check>
  [--text "…"]` writes the check into the scenario as an acceptance
  criterion of the step (`home:HC103` becomes `AC103` with `from: HC103`),
  so it counts for acceptance from the next walk. Do it only when
  the person asks. Checks people adopted on the canvas (or through
  `adopt_health_check`) wait on the service until `kaloko health pull` writes
  them into the scenario; pulling them is routine, then walk those steps.
- **Report it apart from the verdicts**: "Health: 2 errors (1 new), 5
  warnings; fixed HC108 on home". Never present a health finding as a
  failing criterion, or a clean health as acceptance.
- `kaloko health --fail-on error` exits 1 on errors; use it in CI only where
  the team asked for that gate. Hosted runs and CI runs alert on new errors
  by themselves (inbox, mail, channels, webhook `health.worse`).

## Triage findings (experimental)

When the organization switched the experiment on, `kaloko evaluate` also asks
Clef, a model on Cloudflare, what kind of problem each screen and a few frames
of its recording show: overlap, cut-off text, raw keys, placeholders, errors,
endless loading, layout jumps and more. They land in the eval file and the run
as `findings` (kind, probability, severity, frame times) and never change a
verdict. Mention the shown ones (`shown: true`) as "possible problems", apart
from the verdicts, and fix the clear ones; `get_findings` lists them with the
answers reviewers gave. Do not answer findings on a reviewer's behalf unless
asked. `evaluators.triage: false` turns it off.

When a criterion comes back `needs_review`, read the reduced state the
evaluator saw (`steps/<node>/<locale>/<viewport>.capture.json`, key `state`)
and the screenshot. Either the page is genuinely unclear (report it), the
reducer missed something (report a Kaloko bug), or the question is too broad
(narrow it with `scope`, `true`/`false`; this changes mechanics, not intent).
Check evidence of passing deterministic checks too: a match in the wrong
region (e.g. a shipping threshold instead of the product price) means the
selector needs a scope.

When the check itself was wrong (selector, pattern too broad) and the step
cannot be repeated (data created, an e-mail sent once, a state that moved
on), fix the scenario and run `kaloko evaluate --recheck [--steps a,b]`: the
deterministic checks run again against the stored HTML with page scripts off
and are marked `rechecked`; console errors, overflow and performance keep
their live result. The same command asks changed or new semantic questions
again on the stored captures, so a reworded semantic criterion needs no new
walk. When the page content itself is in question, capture again.

## Quick signals

Beside the criteria, every captured screen gets three cheap questions in the same evaluator request: does the
page do what the step's `purpose` says, is its text in the expected language, does it look broken (an error,
placeholder text, a blank page). They never change a verdict; the canvas marks a screen with ⚠ when one is
off (purpose or language at 30 % or less, broken at 70 % or more). Mention them in the report when they
disagree with passing criteria: it usually means a criterion is missing. `evaluators.jev.signals: false`
turns them off; they do not count against the hosted allowance.

## Reporting

After `kaloko build`, report: the summary line, each failing or
`needs_review` criterion with step, locale, viewport and evidence, blocked
requests if any, the health counts (apart from the verdicts), and the preview
path. Do not claim a criterion passed when
it was not evaluated.

`needs_review` is not a failure: look at the screenshot and state your
reading, or leave it to the reviewer.

After a share, steps that did not change since the last accepted run keep a
person's approval; only the rest waits in review mode. Report it as the
share prints it ("12 steps unchanged, approvals carried over; 5 need review:
<link>") and never call a carried or agent approval a person's acceptance.
