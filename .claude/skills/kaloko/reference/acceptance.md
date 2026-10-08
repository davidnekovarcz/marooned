# Acceptance plan and scenario

Two files per task, next to the task documentation:

- `ACCEPTANCE.md` — for people. Goal, flow (Mermaid), steps with purpose and
  criteria `AC<n>`, variants, locales, environments, execution per step,
  change log. Template: `templates/ACCEPTANCE.md` (Czech: `templates/cs/`).
- `qa/scenario.yml` — for the runner. Schema `schemas/scenario.v1.json`,
  example `templates/scenario.yml`.

Long-lived flows that outlive tasks (checkout, SEO on production) live in
`qa/flows/*.yml` with `kind: flow`.

## Creating or updating

Read the task documentation and recent commits first. The plan states intent;
the scenario is its executable form. When sources disagree or intent is
unclear, ask one focused question instead of guessing.

When intent changes, update `ACCEPTANCE.md` first, add a change-log row with
date and commit, bump `version` in the scenario, then adjust the scenario.

In a project without scenarios, `kaloko init` already drafted
`qa/flows/main-pages.yml` from the route files: one screen per main route in
the locales of the i18n config, with the dev server's URL as `local`. It walks
as it is; sharpen the purposes and criteria and add the flows that matter.

Screenshots an agent or a test tool already took (a Cursor or Antigravity
walkthrough, a Playwright report or trace) can start a scenario too:
`kaloko import <folder> --adhoc` writes one manual step per screen; see
[import.md](import.md).

For public pages of a site (landings, marketing, documentation) start from a
draft: `npx kaloko draft https://example.com/ https://example.com/pricing`
fetches the pages and writes a read-only production scenario and its plan
(title, H1, description as purpose; packs seo, a11y, perf, console). Then
sharpen each purpose and add the criteria the page must really meet.

## Check packs

`packs: [seo]` or `packs: [seo, usability]` on a node adds a fixed set of
health checks (ids `HC1xx` for `seo`, `HC2xx` for `usability`; acceptance
criteria are `AC`, health checks `HC`, and the number is the check's: the
same check kept in acceptance or adopted is `AC103` for `HC103`) at load time:
`seo` checks one H1, title and description length, canonical, hreflang for
every locale, Open Graph, indexing, viewport, `html lang`, overflow and
console; `usability` checks unlabeled inputs and link texts and asks the
evaluator questions that fit the step's page type. Pack checks are health,
not acceptance: they are evaluated on every walk but never decide a step's
verdict (see [evaluation.md#health](evaluation.md#health)). The `design` pack
always counts for acceptance; `health: { acceptance: [seo] }` on the scenario
keeps another pack in acceptance, which only the person decides. A node's own
criterion with the same id wins and counts for acceptance (that is what
`kaloko health adopt` writes). Pack checks do not count as drift in
`--coverage`; the plan lists only what the brief asks for. Use packs for
public pages and landings; task flows keep their own criteria.

Set `page` on every step (or once on the scenario) so the usability pack
asks the right questions:

| `page` | for | asks |
| --- | --- | --- |
| `landing` | public and marketing pages | purpose in the first screen (`HC201`), exactly one primary call to action (`HC202`) |
| `work` | app screens where people work: overview, canvas, detail, inbox item | the heading says what the screen is for (`HC205`) |
| `list` | lists and tables: runs, projects, inbox | `HC205`, each item says what it is and how to open it (`HC207`) |
| `settings` | settings, billing, tokens | `HC205`, each setting says what it changes and how it is saved (`HC208`) |
| `form` | sign-up, sign-in, a form to fill in | `HC205`, how to send it and what happens next (`HC206`) |
| `doc` | documentation, guides, terms | `HC201`, headings and short paragraphs (`HC209`) |

Every type also gets `HC203` and `HC204`. Without `page` a step with the
`seo` pack, or any step of a scenario allowed on production, is `landing`;
everything else is `work`. Do not put `landing` on signed-in screens: "one
primary call to action" is a marketing rule, and a work screen rightly offers
several actions.

A criterion that only makes sense on production (hreflang pairs pointing at
the live domain, an embedded live demo, the production sitemap) carries
`environments: [production]`. Walked anywhere else it is reported as not
applicable to that environment (`not_evaluated` with `not_applicable:
environment`) and does not make the step partial.

When a scenario walks several locales, a text check (`text_matches`,
`title_matches`, …) must match every language: write
`pattern: "(Your data|Vaše data)"`. `kaloko validate` warns when a pattern
reads in one language only (it looks for diacritics and common Czech or
English words; one plain word such as a brand name is left alone).

- `a11y` (`HC3xx`): images with alt, links and buttons with a name, labelled
  fields, heading levels not skipped, WCAG AA text contrast, a `main`
  landmark, unique ids (`HC301`–`HC307`, read from the page). After the
  screenshot the walk also presses Tab through the page: `HC308` tab order
  (hidden focus, big jumps back, positive `tabindex`, controls left out or
  mouse-only), `HC309` visible focus with at least 3 : 1 contrast (each stop
  screenshotted focused and unfocused), `HC310` no keyboard trap (a modal
  dialog may keep focus), `HC311` a skip link or main content within three
  stops, `HC312` names from Chrome's accessibility tree (what a screen
  reader announces). `HC313` landmarks (one `main`, labelled repeats) and
  `HC314` ARIA (unknown roles and attributes, references to missing ids,
  `aria-hidden` over focusable content) are read from the page. The first
  five focus stops are kept as screenshots (step attachments of kind
  `focus`, "Keyboard focus · HC309" on the canvas, linked to the check; the
  Health tab shows them under `HC309` and in the tab order) and the canvas
  can draw the tab order on the capture. The walk only moves focus: nothing is clicked or
  typed, and the page is left unfocused at the top. Stack steps walk the
  keyboard on their first five pages. Still a subset of WCAG 2.2 AA; it
  does not replace an audit with a screen reader.
- `perf` (`HC4xx`): LCP ≤ 2.5 s, CLS ≤ 0.1, TTFB ≤ 800 ms, page weight ≤ 3 MB,
  measured in this walk's browser since the page load (lab values: the
  machine and network of the walk matter; compare runs, not absolutes).
  Override a limit with an own criterion with the check's number as an AC
  id (`AC401` for `HC401`), e.g.
  `{ id: AC401, text: LCP within 4 s, check: { type: deterministic, assert: perf_lcp, max: 4000 } }`.
- `console` (`HC501`): the evaluator reads the step's console errors with its
  purpose and decides whether they touch what the step accepts (pass: only
  third-party noise; needs review: unsure; fail: relevant). Without errors it
  passes without a call. Keep `no_console_errors` where any error must fail.

- `errors` (`HC6xx`) is for error pages. It checks:
  - a real 4xx/5xx status (a "soft 404" answering 200 fails);
  - a link to the home page and navigation or search;
  - no stack trace, SQL error or framework debug page;
  - a plain-language message with a way forward (semantic);
  - no console errors. The document's own error status is not counted.

## Error pages

Every site has them and they are easy to forget. Give each one its own
step with `packs: [errors]`:

- **404:** use `path: /no-such-page-{random}`. `{random}` becomes a new
  token on every walk, so no cache or an accidentally created page makes it
  pass. `kaloko draft` adds this step on its own.
- **Exact status:** override HC601 with your own AC601, for example
  `{ id: AC601, text: Answers 410, check: { type: deterministic, assert: http_status, value: 410 } }`.
  `http_status` also takes `min`/`max`; the default is 200–299.
- **Every step:** each capture records the document's HTTP status. The
  canvas shows 3xx–5xx on the node, so a normal step that suddenly answers
  500 stands out. On a stack, `http_status` with `min: 200, max: 299` finds
  broken pages among hundreds.
- **5xx and maintenance pages:** you cannot trigger them on production.
  Use a test route the project provides (for example `/500` on a review
  app), the static error page the server serves (`/500.html` answers 200,
  so override AC601 with `value: 200`), or a local environment where the
  person agrees to stop a dependency. Say which one you used.
- **Access errors:** 401/403 for a signed-out visitor on a protected
  address, and an expired link (410). Walk these with the right session.

## Many pages of one template

When the plan says "every article / product / landing page must …", do not
write one step per page. Use one `kind: stack` step whose `items` come from
a sitemap, a listing, a file or a script, with the criteria every page must
meet. The canvas shows it as a stack with an index. The plan keeps one
`### <step-id>` section for it, naming the source and the limit. See
[stacks.md](stacks.md).

## Capture quality

The default capture is WebP at 1× — right for daily acceptance, small and fast on the canvas. For
documentation, manuals and training material set print quality on the scenario or on single steps:

```yaml
capture:
  format: png          # lossless
  scale: 2             # 2× device pixels, crisp in a PDF
  mask: ["[data-qa=email]", ".customer-name"]   # personal data hidden in the image, HTML, outline, trace and video
  annotate: true       # numbered marks on the elements of criteria with `highlight`, in criteria order
```

A node's `capture:` overrides the scenario's. Crops for a manual take padding in step scripts:
`await crop('#checkout-summary', 'Order summary', { padding: 16 })`. Print quality costs storage (a
2× PNG is several times a 1× WebP), so keep it for documentation scenarios, not for every run. The
canvas still loads a small WebP thumbnail; the lightbox and `latest.image` serve the full file.
Masks cover every output of the step: the screenshot gets a striped box, the HTML and the page outline get
`[hidden]` of the same length, traces, recordings and captured e-mails are covered too; checks still read the real
page. On data copied from production add `pii: redact` to the scenario (automatic detection of e-mails, phones,
birth numbers, IBANs, addresses) or `pii: pseudonymize` (consistent fake values, readable screens). An environment
with `pii: required` refuses a run without it, and in a run that hides personal data `kaloko share` stops on an
unmasked e-mail or phone number and names the step and element (other runs are shared with a warning): mask it and capture again, list a company contact under `pii.allow` in the config, and
use `--allow-pii` only when a person says the value may go up.

## Keeping plan and scenario aligned

`kaloko validate <scenario.yml> --coverage` compares `AC<n>` lines under each
`### <step-id>` heading of the plan (`source`) with the scenario: planned
criteria without a check fail the command, checks without a planned criterion
are listed. The canvas shows the same card ("Plan coverage") and marks
criteria whose verdict differs between runs on the same commit as flaky;
treat a flaky criterion as a selector or timing problem to fix in the
scenario, not as a verdict.

When a step is shaped by files no route reaches (a payment library, a shared
price component), name them on the step with `affects: [lib/payments/**]`, so
`kaloko walk --affected` walks it when they change; `affects: always` marks
steps every walk needs (sign-in, consent). See
[execution.md](execution.md#only-what-changed).

## Naming and linkage

When the work has a repository and an issue number, make them visible:

- scenario `id` carries the ticket (`TASK-1273-club-activation`, `WEB-12-checkout`); the CLI derives the issue number from it or from the branch (`feat/1273-…`) and links it to the repository's origin (`acme/shop#1273`);
- set `issue: { number, repo?, url? }` explicitly when the id or branch cannot carry it (for example a Plane item);
- the project is the repository name unless `project:` in `kaloko.config.yml` says otherwise; a single flow may sort itself elsewhere with `project: <slug>` in its scenario (optional). Projects are records of the organization: `kaloko projects` or MCP `list_projects` show the slugs to use; admins create them in Settings → Projects or assign a scenario in the overview, which wins over the scenario file;
- the canvas header, the organization overview and `kaloko feedback` show `repo#number · title`, so name the scenario `title` for humans, not for the ticket;
- requirement IDs from the team's tracker or QMS go into `refs:` on the scenario, a step or a criterion (`refs: [URS-12, FS-3.4]`, free text, never invented); they flow into the acceptance record and the trace matrix ([evidence.md](evidence.md)).

## Session and consent

Default, unless the plan says otherwise: a run starts as a new visitor
(`walk` clears cookies and storage before the first step; agents call
`kaloko session reset`). When the site shows a consent dialog:

1. the first screen is captured with the dialog still open — it is part of
   what a new visitor sees, with one criterion that it appears;
2. the next step accepts it (`steps/consent.mjs`, installed by `kaloko init`,
   handles common consent libraries and captures the same screen without the
   dialog; criterion: the dialog is gone);
3. every later screen runs without the dialog. Do not repeat consent
   criteria on them — a returning dialog is visible on the canvas anyway.

Skip the consent step when the site has no consent dialog. Change the order
in `ACCEPTANCE.md` when the plan tests consent itself (rejecting, settings,
per-category choices) or needs another session state (signed-in user,
returning visitor). The plan is the source of truth; this is only the default.

## Writing criteria

Each criterion gets exactly one check:

- `deterministic` for anything countable or exact: presence, counts, text,
  prices, attributes, the URL, computed styles, values in the page,
  overflow, console errors, title/meta/canonical.
- `semantic` for judgement: clarity, separation of consents, whether copy
  fits the purpose. Write the question in English, yes = met, one condition
  per question. Add `true`/`false` for edge cases and `scope` (CSS selector)
  to send only the relevant region.
- `manual` when neither works; a reviewer decides on the canvas.

A semantic question with two conditions ("says that the draft is live **and**
shared, so everyone sees changes", "says how to publish **and** what
publishing saves") lands in the middle of the score range and stays
`needs_review` even when the page is clear, because the evaluator weighs the
part it is less sure about. Split it into one criterion per condition, scope
it to the element that should say it (`scope: ".draft-panel"`, not `body`),
and put the expected wording into `true`:

```yaml
- { id: AC6, text: Says the draft is live, check: { type: semantic, question: "Does the draft panel say that changes appear live for everyone who has the draft open?", scope: ".draft-panel", true: "Yes: it states that others see changes as they happen." } }
- { id: AC7, text: Says how to publish, check: { type: semantic, question: "Does the draft panel say how to publish a new version?", scope: ".draft-panel" } }
- { id: AC8, text: Says what publishing saves, check: { type: semantic, question: "Does the draft panel say what publishing a version saves?", scope: ".draft-panel" } }
```

When the exact wording is fixed and matters, a `text_matches` check is better
than a question.

Numbers, dates and counts never go to `semantic`. Add `highlight` when the
check selector is not the element a reviewer should see.

Text checks (`text_matches`, `text_absent`, `title_matches`) run a JavaScript
regex on the element's `innerText`, which follows CSS `text-transform`: a
button styled uppercase reads `VYTVOŘIT`. Add `flags: i` to ignore case
(also `m`, `s`) instead of writing `[Vv][Yy]…`. Keep patterns specific: a
white-label check for `vyvolej` also matches the Czech verb "Vyvolej si";
anchor it (`vyvolej\.to`).

`text_equals` compares the whole text of an element (whitespace collapsed,
`flags: i` ignores case) with `value`: a total, a status, a label.
`attr_matches` runs `pattern` on an attribute (`selector`, `attr`). Both pass
when one match passes; `all: true` asks every match.

### URL, computed styles and values in the page

Never make a step script compute a check and leave a `data-qa-*` marker for
a criterion to find. The marker proves only that the script ran. Check the
URL, the style or the value directly:

```yaml
# the URL after the step (part: href (default), path, query, hash, host, origin)
- { id: AC1, text: Lands on the thank-you page, check: { type: deterministic, assert: url_matches, part: path, pattern: '^/(cs|en)/thanks$' } }
# exact path; ignore_query drops ?… and #…; a value with https:// compares the whole URL
- { id: AC2, text: Stays on the cart, check: { type: deterministic, assert: url_equals, value: /cart, ignore_query: true } }
# computed CSS (getComputedStyle) of the matched elements
- { id: AC3, text: Primary button in brand colour, check: { type: deterministic, assert: style_equals, selector: button.primary, property: background-color, token: color.brand.primary, all: true } }
- { id: AC4, text: Body text at least 16 px, check: { type: deterministic, assert: style_equals, selector: main p, property: font-size, op: '>=', value: 16px, all: true } }
- { id: AC5, text: Error text red, check: { type: deterministic, assert: style_equals, selector: .field-error, property: color, value: '#d92d20' } }
- { id: AC6, text: Promo banner hidden, check: { type: deterministic, assert: style_matches, selector: .promo, property: display, pattern: '^none$' } }
# a read-only expression in the page
- { id: AC7, text: Three items in the cart, check: { type: deterministic, assert: js_equals, expression: "document.querySelectorAll('.cart-item').length", value: 3 } }
- { id: AC8, text: Cart kept for the next visit, check: { type: deterministic, assert: js_equals, expression: "JSON.parse(localStorage.getItem('cart') || '[]').length", op: '>=', value: 1 } }
- { id: AC9, text: Purchase sent to analytics, check: { type: deterministic, assert: js_equals, expression: "window.dataLayer?.some((e) => e.event === 'purchase')", value: true } }
```

- `url_matches` and `url_equals` read the URL the browser shows after the
  step, redirects included. The evidence names the URL.
- `style_equals` compares `property` (a longhand: `background-color`, not
  `background`) with `value` or `token`. Colours compare in one form, so
  `red`, `#ff0000` and `rgb(255, 0, 0)` are equal; transparency counts.
  Lengths compare in px (`rem` uses the page's root size), with
  `tolerance: 1` for rounding; `op: '<' | '<=' | '>' | '>=' | '=='` compares
  numbers. Other values (`display`, `font-weight`, `font-family`) compare as
  text without quotes or case. Visible matches count; when none is visible
  (a check for `display: none`), every match does. `style_matches` runs
  `pattern` on the computed value.
- `token: color.brand.primary` takes the expected value from the project's
  DTCG token set (`kaloko tokens push`, or `tokens.json` of the design
  folder) when `kaloko evaluate` runs, or from the page's
  `--color-brand-primary` custom property during the walk. The evidence
  reads `color is rgb(46, 107, 255) = color.brand.primary (#2e6bff)`.
- `:hover` and `:focus` states are not supported: the check reads the page
  as the step left it. Hover or focus the element in the step script when
  that state is what you accept, and say so in the criterion text.
- `js_equals` evaluates one `expression` in the page (2 s limit; promises are
  awaited) and compares the result with `value` (a number value accepts
  `"3"`; `null` matches a missing `localStorage` key), with `op` and a
  number, or with `pattern` (objects as JSON). Without `value` and
  `pattern` the result must be truthy. Only reading is allowed: no
  assignment, no `++`/`--`, no `new` except `new URL(…)`, and calls only
  from a list of reading methods (`querySelector(All)`, `getAttribute`,
  `getItem`, `getComputedStyle`, `filter`, `some`, `JSON.parse`, …).
  `kaloko validate` refuses anything else (`setItem`, `click`, `fetch`).
  The guard is a convention, not a sandbox: a getter in the page can still
  run code, so read data the page exposes (storage, `dataLayer`, the DOM)
  and nothing that acts. Prefer `style_*`, `text_*` and `count` when they
  can say the same.

On `kaloko evaluate --recheck` the URL checks run again from the stored URL.
The computed styles and expression results are stored with the capture, so a
recheck decides again from them when the criterion still reads the same
selector and property (or the same expression), for example after you fix
the expected value. A new selector, property or expression needs the live
page: the criterion is "not evaluated" with that reason until the step is
captured again.

Two checks need the network and run next to the capture, once per page:

- `links_ok`: every same-origin link (`selector`, default `a[href]`) answers
  below 400 after redirects. `max` caps the links per page (default 100),
  `pattern` skips matching paths. Redirects are listed in the evidence.
  Links are followed only on a readonly environment or scenario; elsewhere
  the criterion is not evaluated unless the check sets `follow: true`. Links
  that look like actions (log out, unsubscribe, delete, remove, tokens,
  switching organization) are never requested.
- `hreflang_pairs`: at least `min` languages (default 2); the page's own
  language points to the page itself; every other version answers 200
  without a redirect and links back. This is what search engines require
  of hreflang; a count of `link[hreflang]` does not prove it.

Both are GETs from a separate request context that starts with a copy of
the walk's cookies and the environment's gate and never writes back (a
`?lang=` link cannot switch the language of the next step). They are cached
per environment, locale and sign-in state, so a stack of hundreds of pages
fetches its shared navigation once. A recheck
from stored HTML keeps their last result; capture again to refresh them.

Describe every relevant variant as nodes and `alt` edges, even when a given
run covers only part of it. Decisions are `kind: decision` nodes.

## People in the flow

When a flow involves more than one person (a guest who buys, a member who
shares a link, the friend who arrives through it, an operator in the console),
list them in `ACCEPTANCE.md` under "People in the flow": one line per person
with who they are, what test data they need, and what they must not see.
In `scenario.yml` declare them as `sessions` and give every non-decision node
a `session`. `kaloko walk` keeps one browser context per session and locale,
so nobody signs anybody out; step scripts receive `session` (`key`, `title`,
`mailbox`, `account`) and `session.credentials` from
`environments.<env>.accounts.<account>` (see environments.md).
E-mail nodes default to the session's `mailbox`. `blocked_on: [production]`
skips a session's nodes there. The canvas shows a chip with the person on
every step, groups the step list by person and draws hand-offs between
people as dashed arrows. Sessions run one after another, never in parallel,
and never share cookies.

## Ignore regions

Clocks, ads, carousels and "3 minutes ago" change on every capture and make
pixel diffs noisy. List them on the step and both the canvas diff and the
design pixel check (`AC801`) leave them out:

```yaml
- id: home
  ignore:
    - { selector: "#clock" }                       # every visible match
    - { selector: ".ad-slot", viewports: [desktop] }
    - { rect: [0, 620, 1280, 240], viewport: desktop } # page pixels of one viewport
```

Do not guess them: `kaloko walk --stability 3` notes what moves while the
page sits still, and `kaloko stability` compares the step with earlier runs
and writes suggestions (see [execution.md](execution.md)). Reviewers can also
draw a region on a screenshot on kaloko.app; `kaloko stability --pull` writes
those into `ignore:`. Ignore only noise; a region that matters to a criterion
stays in.
