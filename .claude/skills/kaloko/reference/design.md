# Design with Kaloko

Kaloko hosts designs as live HTML steps of the same scenario that development and QA use. You design with
whatever skill, model and style the person uses; Kaloko keeps the draft, the versions, the comments and the
design reference, and checks the implementation against it. This reference says how to fit your work into
that. It says nothing about how a design should look.

## Design environments

A design environment is a folder the CLI serves while it walks:

```yaml
# kaloko.config.yml
environments:
  design: { kind: design, serve: design }
```

`kaloko start --scenario qa/flows/checkout.yml --env design` starts a run of it. The scenario is the one the
implementation uses: same step ids, same criteria. Design steps meet the acceptance criteria too (headings,
labels, semantic questions), so a design is accepted before anyone builds it. Checks against the design
reference (`design_pixels`, `design_structure`) are left out on a design environment.

## The bundle

```
design/
  tokens.json                  token set (W3C DTCG), optional
  _shared/app.css              shared files: fonts, styles, images, scripts
  cart/index.html              one folder per step id
  cart/cs/index.html           optional override for a locale
  payment/index.html
```

- Plain HTML, CSS, JS and assets only (`qawalk.bundle.v1`: html, css, js, mjs, json, svg, woff2, woff, png,
  jpg, webp, avif, gif, mp4, webm, txt). No build step on the service side: build locally, keep the output.
- A step's revision is its page, the files next to it and everything its page references (stylesheets,
  images, fonts, module imports, `fetch('./fixtures/x.json')`). Links to other steps are not files it needs.
- Live steps run sandboxed on their own origin with `connect-src 'self'`: no real APIs. Use JSON fixtures in
  the bundle.
- Web fonts and images from a service (Google Fonts, Adobe Fonts, the company CDN) load only from origins an
  organization admin allows in Settings → Security. List the ones the design uses on the environment
  (`design: { kind: design, serve: design, origins: [https://fonts.googleapis.com, https://fonts.gstatic.com] }`);
  `kaloko design lint` warns about each the organization does not allow yet, so tell the person to ask an admin.
  Scripts never load from those origins.
- Links between steps are plain relative links to the page: `<a href="../payment/index.html">`. The canvas
  follows them; `data-kaloko-go="payment"` (or `data-qawalk-go`) moves to that step whatever the `href` says.
- Reference token values as CSS custom properties named after the token path (`color.accent` →
  `var(--color-accent)`), so Dev mode, the step spec and the token check see which token a value comes from.
  Define interaction states in CSS (`:hover`, `:focus-visible`, `:active`, `:disabled`): Dev mode and the spec
  read them from the stylesheet.
- Write pages by the portable HTML rules ([portable-html.md](portable-html.md)): relative URLs only, bundled
  fonts, no CDNs, state in the URL instead of storage, deterministic content, viewport meta and `lang`.
  `kaloko design lint` checks the folder; `kaloko sync` runs it first and stops on errors (things that break on
  the live step), warnings are printed.

## Variants of one template (stack steps)

A step that comes in variants of one template (an e-mail per reason support can pick, a landing per city, a card per
plan) is one stack step ([stacks.md](stacks.md)), not one step per variant in a lane of its own:

```yaml
- id: credit
  kind: stack
  title: Credit from support
  items: { urls: [refund, late, damaged] }   # folders of the step; without folder names: every subfolder with a page
  fields: [{ id: reason, label: Reason, from: .reason }]
  criteria: [...]                            # every variant meets them
```

```
design/credit/index.html                  optional overview (the step's entry; links into the variants)
design/credit/refund/index.html           one folder per variant: its page and the files next to it
design/credit/refund/cs/index.html        a locale override of one variant
design/credit/late/index.html
```

- `items.urls` that name folders (`refund`, `./refund/`, `refund/index.html`) list the variants in that order. App
  paths (`/credit?reason=refund`), other sources or no list: every subfolder with an `index.html` is a variant,
  sorted by name. Locale folders, `dark/` and folders starting with `_` are never variants.
- One revision covers the whole step folder; changing a variant is a new revision of the step. The walk captures
  every variant in every viewport (`items.viewports` narrows it) with the index fields and criteria, and reuses
  captures per revision and variant.
- `kaloko sync` sends the variants' captures with the step; the published version shows the stack index with every
  variant and its verdict, and each variant opens live in the lightbox.
- `kaloko design lint` reports a variant folder without its `index.html` as an error.
- `kaloko export live` and `export design` write the variant folders; the design export adds
  `screenshots/<step>/<variant>/<locale>/<viewport>.webp`.
- Not for steps whose variants are different screens of a flow: those stay separate steps.

## Devices, dark mode and app screens

Design steps can target device presets and colour schemes like any run ([devices.md](devices.md)):

```yaml
# the design scenario (the same one development uses)
viewports: [iphone-15, pixel-8, ipad-landscape, laptop]
color_schemes: [light, dark]
```

- On a design environment a phone or tablet preset is the whole screen (393 × 852 on an iPhone 15), rendered with
  the preset's touch, pixel ratio and user agent, so `(pointer: coarse)` and `(hover: none)` apply. The step detail
  draws the device frame; *Safe areas* shows the notch, the home indicator and where the first screen ends.
- Dark mode: write `@media (prefers-color-scheme: dark)` in the step's CSS, and the dark captures show it. A step
  whose dark screen is a different page gets `<step>/dark/index.html` (or `<step>/<locale>/dark/index.html`); dark
  captures render that page, and it travels with the revision.
- Token modes follow the scheme: with a `theme` modifier (or `light`/`dark` groups) in the token set, Dev mode, the
  step spec and the token check of a dark capture name the dark tokens, and drift compares dark with dark.
- Browsers: design steps render in Chromium. Check the implementation in WebKit and Firefox instead.

## Step states and token modes

A step lists its other states in the scenario (`states: [empty, error, loading]`; any name of letters, digits, `-`
and `_` works). Draw each one so it can be reviewed and built:

- A state is a page next to the step's page: `<step>/<state>.html`, per locale `<step>/<locale>/<state>.html`. It
  travels with the step's revision like the dark page; give it its own fixtures (`<step>/empty.json`, or a literal
  `fetch('./fixtures/cart-empty.json')`) so the closure finds them.
- Without that page the walk opens `<step>/index.html?state=<name>` and says so. Use it when one page switches its
  states in JS (`new URLSearchParams(location.search).get('state')`); the fixture must still be next to the page or
  fetched by a literal path.
- Captures of a state are keyed `<viewport>.state-<name>` (`mobile.dark.state-empty`). Criteria with
  `states: [empty]` are judged on that state only; other criteria on every state.
- The canvas shows a State switcher next to the language; review mode and the grid follow it. A step without the
  state shows its default capture with a note.

Token modes: when the token set has two or more modes (resolver contexts or mode groups), every step renders in each
mode. The walk sets the mode's tokens as custom properties on `:root` after the page's own styles and
`data-kaloko-mode="<mode>"` on `<html>`; a page that switches themes by class can read the attribute. Captures are
keyed `<viewport>.mode-<name>`; the environment's `default_token_mode` (older name `tokens_mode`; else the first mode) is the default with the plain
key, and the canvas switches modes like colour schemes. A set with only `light`/`dark` modes follows the colour
scheme instead (`color_schemes: [light, dark]`), unless `token_modes` names them. `token_modes: [brand-a, brand-b]` (environment, scenario or `kaloko start
--token-modes`) picks modes; `false` turns it off. Live view shows the default mode; other modes are screenshots.

**Native app screens as portable HTML.** A mockup of an iOS or Android screen is a full-screen page:

- Size it to the screen, not to a document: `html, body { height: 100% }` and the main area `min-height: 100dvh`.
  Do not draw the status bar or the home indicator; the frame does.
- Keep content out of the safe areas with
  `padding-top: max(env(safe-area-inset-top), var(--kaloko-safe-top, 0px))` (and `-bottom`, `-left`, `-right`).
  On the phone `env()` gives the inset; in Kaloko `--kaloko-safe-*` does, because desktop browsers report 0. Add
  `viewport-fit=cover` to the viewport meta.
- Use the roles and names the app will have: `<nav aria-label="Tabs">` with buttons for a tab bar, `<header>` with
  an `<h1>` for the navigation bar, `<button>` and labelled inputs. The step spec and the checks match the
  implementation by role and name, and React Native `accessibilityLabel` or Android `contentDescription` are those
  names.
- Touch targets of at least 44 × 44 pt (iOS) or 48 × 48 dp (Android); the app pack checks them on the real app.
- One design serves both platforms unless they really differ. When they do, give the platform its own scenario
  step or its own viewport set (`viewports: [iphone-15]` in one scenario, `[pixel-8]` in another), not user-agent
  sniffing in the page.
- System fonts are not portable (`-apple-system` renders differently on each machine): bundle the font the app
  uses, as the portable HTML rules say.

## Sync and publish

- `kaloko walk` renders only revisions whose captures are missing (same files, same capture).
- `kaloko status` shows each step: synced, changed here, changed in the draft, conflict; and its step status.
- `kaloko sync` saves your changed steps into the shared draft and takes steps others changed. A step changed
  on both sides is a conflict: name it with `--mine <step>` or `--theirs <step>`; never delete to resolve.
- `kaloko share` on a design environment publishes a version of the flow (`v4 · 3 changed, 17 unchanged`).
  A version counts as a shared run. Publish when the person asks, not after every change.
- Every version gets notes on what changed since the previous one; see
  [What changed in a version](#what-changed-in-a-version).
- Step status (`in progress`, `ready for review`, `ready for dev`) is set in the canvas or with MCP
  `set_step_status`; `ready for dev` notifies followers.
- Set `KALOKO_AGENT=<your name>` so people see your writes as yours in presence, history and audit.

## The loop

1. Design or change steps in the folder with the person's design skill.
2. `kaloko walk` (and `kaloko evaluate` if the step has semantic criteria), `kaloko sync`.
3. Read `kaloko feedback` on the design environment: open comments, pinned ones with their element
   (`on main > label`). People comment in the canvas; they may be looking right now.
4. Change what the comments ask, sync again, then answer in the comment thread (MCP `add_draft_comment`).
5. When the person is happy, `kaloko share --name "…"` publishes a version.

## Present the prototype

The canvas plays design steps full screen: *Prototype* in the top bar or the step detail, or `P`. Each step runs as
its live page in a device frame (phone for mobile viewports, a window for desktop; switchable), clicks on links and
`data-kaloko-go` move between steps, `←` `→` walk the flow, `Esc` leaves. The address (`#present=<step>&vp=mobile`)
opens straight into the presentation of that step: share it with the person who reviews.

- Live pages need the user-content origin of the service; where it is not available (a self-hosted instance
  without it, a step never rendered live) the presentation shows the screenshots.
- From the local preview and an offline export, the steps open from the run's merged folder (`live/site/`), so plain
  relative links click through there too.
- A link's query and hash travel to the next step (`../payment/index.html?plan=pro#card`): enough for one value.
  For more, use the prototype state below.

### Prototype state

Steps of a prototype share a small store, so a cart filled on one step shows on the next. The frame helper of the
live step provides `window.kaloko.state`; the canvas keeps it for the viewer in their browser tab, per draft or
version, and never sends it to the service. *Start over* in the presentation clears it.

```html
<!-- payment/index.html: the seeds are what the step shows when nothing set it yet -->
<script type="application/json" id="seed" data-kaloko-state>{ "cart": [{ "name": "Tea", "price": 120 }] }</script>
<script>
  const render = (s) => { /* draw s.cart */ }
  // first the step's own seeds, so it looks right alone (from disk, in a capture, in an export)
  render(JSON.parse(document.getElementById('seed').textContent))
  // then what the prototype remembers: the helper loads after the page's scripts and the state comes a moment later
  addEventListener('kaloko:state', (e) => render(e.detail.state))
</script>
```

- `kaloko.state.get(key)`, `set(key, value)` (JSON, up to 64 kB; `null` removes the key), `update(key, fn)`,
  `subscribe(fn)` (called with the whole state now and on every change; returns an unsubscribe function), `reset()`,
  `ready` (a promise of the first state). The `kaloko:state` event on `window` carries the same state; scripts that
  run before the helper use it.
- The seeds in `<script type="application/json" data-kaloko-state>` fill keys that nothing has set yet. Give every
  step that reads state seeds that make it look right on its own: reviewers open steps directly, captures render
  each step alone, and the local preview and exports have no helper, so `window.kaloko` is missing there.
- Write with `set` or `update` on the step where the person acts (`update('cart', (c) => [...(c || []), item])`),
  read on the next. Keep it small: ids, counts and form values, not page markup.

## What changed in a version

When a version is published, Kaloko writes a short note per changed step against the previous version of the
branch: a new or removed step, the text that changed (from the step spec), the viewports whose screenshot looks
different, a new token set, or "looks the same; only the page code changed". Reviewers read it in the version's
side panel and in the step detail; followers get the summary in their inbox.

- Read what it would say before you publish: `kaloko share --notes-preview` (MCP `get_version_notes` with
  `version: draft`).
- Say why, not only what: write a file with a summary first and then `step-id: what changed and why` lines, and
  publish with `kaloko share --notes notes.md` (or `--notes -` from standard input; MCP `publish_version` takes
  `notes`). Your text replaces the generated one for the steps you name; the other steps keep theirs.
- Fix them afterwards with MCP `set_version_notes` or `PUT …/scenarios/<id>/versions/v4/notes`. Plain language for
  the people who review the design: what they will notice, not file names.

## Import from Figma

Teams whose design lives in Figma can make it the design reference without redrawing it:

```bash
export FIGMA_TOKEN=figd_…   # Figma → Settings → Security → Personal access tokens (file content: read-only)
kaloko design import figma "https://www.figma.com/design/<key>/Shop?node-id=12-0" --scenario qa/flows/checkout.yml
```

- Frames match steps by name: a frame named after the step id or title, with a viewport or locale in it
  (`Payment / mobile`, `payment@desktop`, `Košík [cs]`). Several frames of one step without a viewport in the name
  take the viewport of their width. Anything else: `--map frames.json` (`{ "Frame 12": "payment" }`, or
  `{ "step": "payment", "viewport": "mobile", "locale": "cs" }`, or `{ "skip": true }`). `--frames a,b` and
  `--page <name>` narrow the import; `--dry-run` shows the matches without writing.
- Each step gets `<step>/index.html` with the frame's PNG (1× and 2×) and, under it, the frame's text layers as
  real text with Figma's typography and colors (`var(--token)` where a layer uses a variable or style), so
  `kaloko spec` and `kaloko drift` have elements to compare. `figma.json` says which frame a page came from.
- Variables become `tokens.json` (W3C DTCG; extra modes such as dark as mode groups); without variables, the color
  and text styles the frames use. A `tokens.json` you wrote yourself stays unless you pass `--tokens write`.
- Steps written by hand are not replaced without `--force`. Importing again replaces what the last import wrote;
  unchanged frames give the same files, so the next version shows them unchanged.
- No API token: export the frames from Figma as PNG (1× and 2×) or SVG into a folder and import the folder
  (`kaloko design import figma ./export`); a `*.tokens.json` in it becomes the token set.
- Then walk and share as usual, or add `--publish` (start, walk and share in one go). Once a person accepts the
  version, set it as the design reference: implementation runs with `packs: [design]` are checked against the
  frames (`design_pixels`) and the text styles and tokens (`kaloko drift`).
- One way only: prototype links, components, auto layout and interactions do not come over, and nothing goes
  back to Figma. A frame wider or narrower than its viewport is compared as it is; draw a frame per viewport for a
  clean pixel comparison.

## Screen library

The newest screenshot of every step across the organization's flows, searchable: `/<org>/screens` on the service,
`kaloko screens [words]` (`--project`, `--locale`, `--viewport`, `--status fail`, `--designs` for design versions,
`--json`), MCP `search_screens`. Search matches step and flow titles, ids, paths, URLs, page titles and the H1,
without caring about diacritics. Use it to find where a pattern is already used before designing a new one, and
link the screens you reuse in your notes.

## References

- The design reference is an accepted version: `kaloko reference --design --version 4` (a person accepts the
  version first; ask before setting a reference).
- The baseline stays the last good implementation run: `kaloko reference --baseline --run <id>`.
- Changing the design reference changes what implementation runs are checked against: tell the team.

## Handoff

Development builds from the design reference:

- `kaloko export live [--version n] --out design/` writes the live files into a folder.
- MCP `get_step` (scenario, step, `ref: design`) returns the file list, a signed entry URL, the token set, the
  page structure and open comments; `list_step_changes` names the steps that changed since the last reference.
- MCP `get_step_spec` (or `kaloko spec <step>`) returns what to build, element by element, with tokens; see
  [Implement from the approved design](#implement-from-the-approved-design).
- Translate to the project's stack with the project's own skills; keep the step ids and the token names.

## Implement from the approved design

Use this when you build or change a screen that has an approved design step (a design reference, or a version
the person names). The step spec says what was approved in the terms you write code in: elements in page order
with role, accessible name and selector, and their colors, typography, spacing, radius, shadow and layout, each
value with the DTCG token it comes from. People see the same data in the canvas: *Dev mode* (`D`) in the step
detail.

1. **Read the spec** of each step you build: `kaloko spec <step>` (default `--ref design`; `--ref v4`, `draft` or a
   run id), or MCP `get_step_spec`. `--json` gives `qawalk.spec.v1` (`schemas/spec.v1.json`).
2. **Implement with the tokens.** A line such as `button "Pay" 120×44 bg #2e6bff=color.brand.primary · pad 12px
   20px=space.3 space.5` means `background: var(--color-brand-primary); padding: var(--space-3) var(--space-5)`
   (the custom property is the token path with dots as dashes) or the project's own token mechanism. `not a token;
   nearest x` means the design itself used a raw value: ask the designer before you copy it, and say so in the PR.
   `:hover`, `:focus`, `:active` and `:disabled` lines are states to build; `(light)` names the mode of a value.
   Keep the roles and names: they are how the implementation is matched with the design.
3. **Walk it** with `packs: [design]` on the implementation steps; the capture then stores the implementation's
   spec next to the screenshot.
4. **Check drift**: `kaloko drift [step]` compares the walked run with the design reference of the linked design
   branch and exits 1 while something differs. A shared run: MCP `get_step_drift` (`run`: id or `latest`).
   Findings name the element, the expected token and value, and what the page has; `typed raw` means the value
   is right but should come from the token; `not found` means the design's element (by role and name) is missing.
5. **Fix and repeat** until drift is clean or what is left is a decision for a person (a missing element on
   purpose, a raw value the designer accepted); report those in the PR instead of hiding them.

Specs exist for captures made with the current CLI: walk the design and sync again if `kaloko spec` says there is
none. The pixel, structure and token checks of the design pack (`AC801`–`AC803`) still run in `kaloko evaluate`;
drift is the per-element view an agent can act on.

## Your data is yours

Everything exports in open formats, readable without Kaloko:

| What | Command | Contents |
|---|---|---|
| a design version (or `--draft`, default the design reference) | `kaloko export design [--version n] --out dir/` or `--out v4.zip` | the live files in the folder layout, `tokens.json` (DTCG), `scenario.yml` (`qawalk.scenario.v1`), `screenshots/<step>/<locale>/<viewport>.webp`, `kaloko.json` (what is where) and `index.html`, a start page that opens from disk |
| the live files only (the handoff) | `kaloko export live [--version n] --out design/` | the design folder as the designer wrote it |
| a shared run | `kaloko export run --run <id>` | `run.json`, every capture, the live HTML of design steps (per revision and merged in `live/site/`), comments and verdicts, and `index.html`: the canvas, offline from `file://` |

The flag forms from before (`kaloko export --design`, `--live`, `--run <id>`) still work.
When someone asks for the design or the evidence outside Kaloko, export; do not screenshot the canvas.

## Tokens

- The set is W3C DTCG. Both value styles are read: strings (`"#2E6BFF"`, `"16px"`) and the current format's
  objects (`{ "colorSpace": "srgb", "components": [...], "hex": "#2e6bff" }`, `{ "value": 16, "unit": "px" }`),
  composite types (typography, shadow, border, transition, gradient), aliases `{group.token}` and
  `{ "$ref": "#/json/pointer" }`, `$extends`, `$root` and `$deprecated`. New sets: prefer the object values.
- Modes (light, dark): a DTCG resolver `design/tokens.resolver.json` (sets plus a `theme` modifier whose
  contexts point at files) wins over `tokens.json`; `push` inlines its files. Older sets with top-level
  `light`/`dark` groups still work. `default_token_mode` (or `tokens_mode`) in the environment picks the mode the checks use.
- `kaloko tokens validate` reports names with `{`, `}` or `.`, references that point nowhere and values that
  cannot be read; `push` refuses a set with problems, so does the service.
- `kaloko tokens push` stores the set as the project's next token set version; `pull` gets it.
- `kaloko tokens check` lists raw colors, fonts, sizes, spacing and radii in the design folder that are not in
  the set, with the nearest token; a value that only a deprecated token has is named with its note.

## Checking implementation

Turn on `packs: [design]` (usually `[design, a11y]`) for the steps in the implementation scenario:

| Id | Checks |
|---|---|
| AC801 | pixels: under 3 % differ from the design reference (same algorithm as the canvas) |
| AC802 | structure: headings, landmarks, actions and form fields as in the reference |
| AC803 | tokens: authored colors, fonts, sizes, spacing and radii come from the token set |

The design checks count for acceptance. Contrast and the other accessibility basics come from the `a11y` pack
(`packs: [design, a11y]`) as health: advisory, reported apart (see [evaluation.md#health](evaluation.md#health)).

`kaloko evaluate` fetches the design reference (of the design branch linked to the git branch, if any) and
fills the checks. Findings name what differs and the token to use; fix the implementation, not the reference.

## Canvas edits

People can change a step's text and assign tokens in the canvas inspector. Each edit is a new revision; a file
shared by several locales changes for all of them. `kaloko sync` pulls the edit into the folder as a
`<style data-qawalk-edits>` block and changed text: fold the rules into the real stylesheet when you next touch
the step, then sync.

## Branches

- `kaloko branch create redesign --git feat/redesign` starts a branch of the draft; `--from v4` starts from a
  version. Work on it with `--branch redesign` on `sync`, `status` and `share`.
- The folder mirrors one branch at a time; switching (`kaloko sync --branch main`) takes that branch's steps
  and never pushes the other branch into it.
- Merging is the person's decision: `kaloko branch merge redesign`; steps changed on both sides need
  `--take-branch <step>` or `--keep-main <step>`.

## HTML view

Experimental, Business plan. `html_view: true` on an app environment keeps a static, script-free copy of each
captured page (secrets and hidden values removed) that opens in the canvas like a live step, so the inspector
works on the real product. It is refused on production pages behind a sign-in. `kaloko export live --views
--run <id> --out design/` turns those copies into design steps: a redesign that starts from the product.

## Bring your own design skill

Any skill works if it writes the bundle layout above:

- a design skill of Claude or another agent: ask it to write `design/<step>/index.html` per scenario step and
  shared files into `design/_shared/`;
- a brand or design-system skill: have it produce `tokens.json` and the shared CSS;
- a Figma export through the person's own tooling (for example a Figma MCP server): convert frames to HTML
  per step, then walk and sync;
- hand-written HTML is fine.
