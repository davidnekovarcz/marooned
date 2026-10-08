# Visual changelog and docs with step references

The project keeps `CHANGELOG.md` (and guides in `docs/`) in the repository. You write and update them as part of
normal work; Kaloko turns step references into pictures from accepted runs and shows the changelog as a page that
clients, support and marketing can read.

## Step references

A picture in Markdown names a step instead of a PNG file:

```markdown
![Payment](kaloko:checkout/payment)                       newest accepted capture
![Payment](kaloko:checkout/payment?version=2.4.0)         the capture of release 2.4.0
![Payment](kaloko:checkout/payment?version=prev)          the release before the one this entry belongs to
![Payment](kaloko:checkout/payment?locale=cs&viewport=mobile&state=dark)
![Payment](kaloko:checkout/payment?media=video)           the step's recording plays on the picture
![Pay](kaloko:checkout/payment#pay-button)                a named detail of the step (details: in the scenario)
![Payment](kaloko:payment)                                a step of the product's default_scenario
```

`<scenario>` is the scenario id, `<step>` the node id. Without `locale` and `viewport` the reader's language and
the product's default screen are used. `state` picks a capture variant (`dark`, `webkit`, `reduce`: the values in
capture keys like `mobile.webkit.dark`). When the accepted run has a recording of the step (`kaloko walk --record`),
docs, changelog and training mode show the picture with a play button and play the recording on a click; exports
carry it, the PDF and the "What's new" mail show the picture. `media=video` says the step needs its recording
(`kaloko docs check` warns under `no_recording` when the run has none: walk the step with `--record` and have the
run accepted); `media=image` never plays it. Use `media=video` for interactions a picture cannot show (drag and drop,
a dialog, a language switch), not for every step. Check a reference with MCP `resolve_step_image` or
`GET /api/v1/orgs/<org>/steps/resolve?ref=…`: it answers the signed image URL (and `video` with `mp4`, `webm` and `duration_ms` when it plays), the run and how the version was found
(`release`, `app_version`, `reference_env`, `accepted`; `exact: false` means a fallback).

## Details for guides

When a guide talks about one control, show that control in its part of the page instead of the whole screen. Declare
it on the step in the scenario and refer to it with `#<id>`:

```yaml
details:
  - id: pay-button                                   # letters, digits, - and _; used in references and file names
    name: { en: Pay button, cs: Tlačítko Zaplatit }  # one text or one per locale
    selector: "#pay"                                 # the first match is outlined
    context: card                                    # optional: section | card | page | a CSS selector of an ancestor
    padding: 24                                      # optional, px around the context (default 16)
    states: [error]                                  # optional: only in these states of the step
```

Without `context` the picture is the nearest section, landmark or card around the element that is at least
480 × 240 px (90 % of the width on a phone), at most one screen around the element, with a ring drawn around the
element. Every walk takes each detail in every locale and viewport, masked like the screenshot, as an attachment of
kind `detail` (canvas: Page tab → Step attachments → Details for guides, with the reference). Only screen steps take
details. A reference to a detail no accepted run has yet shows the whole screen; `kaloko docs check` warns under
`missing_details` (the scenario does not declare it) and `no_detail` (no accepted run has it: walk and accept).
Prefer a detail over a crop when the text names one button, field or message; keep the whole screen for orientation.

Never invent a step id or a version. Use ids from the scenario files and versions from `CHANGELOG.md` or git tags.

## After a user-visible change

1. Walk the affected steps and share the run as usual; a person accepts it on the canvas.
2. `kaloko changelog draft` prints the Unreleased entry: merged pull requests and commits since the last release,
   grouped Added / Changed / Fixed / Removed, plus before/after pictures of the screens that accepted runs show
   differently (it needs a token for the pictures). `--apply` writes it into `CHANGELOG.md`.
3. Edit the draft for people: what they can do now or what looks different, one change per line, no commit jargon.
   Delete internal items (refactors, tests, CI). Keep the step references; move a picture under the line it shows.
   Remove the `<!-- … -->` hints.
4. Commit `CHANGELOG.md` with the change. At release time `kaloko release <version>` (ask first: it records the
   release on Kaloko) turns Unreleased into the version, records its pictures and prints the changelog page.

`--since v2.3.0` drafts from another tag; `--product shop` picks a product when the config has several.

## Templates

A changelog entry (Keep a Changelog):

```markdown
## [2.4.0] - 2026-10-12

### Added

- You can pay with Apple Pay in the checkout. ([#412](https://github.com/acme/shop/pull/412))
  ![Payment before](kaloko:checkout/payment?version=prev) ![Payment after](kaloko:checkout/payment)

### Fixed

- The cart total no longer jumps while prices load on phones.
  ![Cart](kaloko:checkout/cart?viewport=mobile)
```

Release notes for a client (a sibling file, or the text of a release on your Git host):

```markdown
# What's new in the web shop, October

Customers can pay with Apple Pay. The button sits above the card form on phones and computers.

![Payment](kaloko:checkout/payment?locale=cs)

Also fixed: the cart total no longer jumps on phones.
```

A how-to guide (`docs/how-to/pay-with-apple-pay.md`):

```markdown
# Pay with Apple Pay

1. Open the cart and choose **Checkout**.
   ![Cart](kaloko:checkout/cart)
2. Choose **Apple Pay** above the card form and confirm on your phone or Mac.
   ![Payment](kaloko:checkout/payment)
```

Rules: write for the person using the product; one change per line; before/after pictures for changes people see;
no internal names, prices or numbers you cannot show.

## Living docs

Guides live in the docs folder (`docs.dir`, default `docs/`; per product `products.<p>.docs.dir`), sorted the
Diátaxis way. Pick the folder by what the reader wants, not by the feature:

| Folder | The reader wants | Shape |
|---|---|---|
| `tutorials/` | to learn by doing, start to finish | one path that always works, a result at the end |
| `how-to/` | to get one task done | numbered steps, one picture per step people look for |
| `reference/` | to look a fact up | tables and lists, no story |
| `explanation/` | to understand why | prose, few pictures |

`index.md` (or `README.md`) is the page of its folder. Front matter is optional: `title` (else the first `# `
heading), `order` (sidebar position). `kaloko init --docs=full` creates the folders with a template in each
README (inside a comment, so it never shows).

A tutorial:

```markdown
---
title: Your first order
order: 1
---
# Your first order

In ten minutes you will have placed an order and seen it in your account.

1. Open the shop and put a tea in the cart.
   ![Cart](kaloko:checkout/cart)
2. Choose **Checkout** and pay with a test card.
   ![Payment](kaloko:checkout/payment)

You have placed your first order. Next: [track it](../how-to/track-an-order.md).
```

A reference page:

```markdown
# Order states

| State | What it means |
|---|---|
| Paid | The payment went through; the order waits for packing. |
| Shipped | The parcel left the warehouse. |
```

An explanation: plain paragraphs that say why ("Card payments are confirmed the next morning, so a cancelled order
costs the customer nothing"), with a picture only when it shows the point.

Link pages with relative `.md` links (`[track it](../how-to/track-an-order.md)`); Kaloko and every export rewrite
them. Keep one task per how-to; split a page that needs two "and then" headings.

### Training guides

A how-to or tutorial is also a walkthrough: on Kaloko, "Walk through it step by step" shows one step at a time,
full screen, with the step's words as the caption, and readers tick "I tried it". Each list item (or paragraph)
with a picture becomes one step; a picture on its own line belongs to the words above it; a before/after pair shows
the after. So for guides people train with: one action per item, the picture right under it, words that make sense
without the paragraphs around them.

### Translations

Translations sit next to the original: `pay.md` and `pay.cs.md`. `docs.languages: [en, cs]` names the languages;
the first is the language of the originals. Pictures follow the language of the text (a Czech page shows Czech
screens) unless a reference names `locale=`.

When you change an original, update its translations in the same change. Translate the words, keep the step
references as they are. To say which version of the original a translation follows, put the first characters of
the original's SHA-256 in the translation's front matter (`source_hash: 1a2b3c4d`; `shasum -a 256 pay.md`);
without it, `kaloko docs check` compares git dates. It reports missing and outdated translations as warnings.

### Stale sections and `kaloko docs check`

`kaloko docs publish` sends the folder to Kaloko as the docs of `latest` (`--version 2.4.0` for a release;
`kaloko release` publishes the folder for its version by itself). When a page's text changes, Kaloko remembers the
screen behind each of its references. When an accepted run later shows a different screen, the section reads
"the screen changed in 2.4 — check the text" for the people who write the docs.

Before a pull request that changes screens, and in CI:

1. `kaloko docs check` (add `--json` to read it as data). Errors: broken references, steps the scenario files do
   not have, references without an accepted picture, stale sections. Warnings: missing or outdated translations,
   user-visible changelog items without a picture (mark one with `<!-- no picture -->` when there is nothing to
   show). Exit code 1 on errors; `--strict` also on warnings.
2. For each stale section, open the step (`resolve_step_image` or the link on the page), compare, and rewrite the
   words that no longer fit. Editing the text clears the note at the next `kaloko docs publish`.
3. If the text still fits, say so to the person; with their go-ahead `kaloko docs publish --reviewed` clears the
   notes without a text change. Never use `--reviewed` to silence notes you have not read.

MCP: `docs_check` (the same report for the published docs), `get_docs` (the sidebar, or a page with its sections,
stale sections and training steps).

### Exports

`kaloko export docs --format md|docusaurus|vitepress|mkdocs|html|pdf|json [--product p] [--version v] [--lang cs]`
writes the docs and the changelog with the pictures as files: Markdown with an `assets/` folder (any static site),
a Docusaurus, VitePress or MkDocs folder with sidebars and front matter, offline HTML, a PDF (printed by the
browser), or the changelog as JSON (`schemas/changelog.v1.json`). `--local` exports the files in the repository
instead of what was published; `--what docs|changelog` exports one of them. The docs and changelog pages offer the
same downloads. An existing docs site keeps its own build: export into its folder and commit the result, or run the
export in its CI.

### Release tools in CI

When release-please, changesets or semantic-release makes the releases, Kaloko follows them:
`kaloko ci github --release` writes `.github/workflows/kaloko-release.yml`, which runs
`kaloko release <version> --no-write` whenever a GitHub release is published (all three tools publish one). It
reads the entry the tool wrote, records the release with its pictures and publishes the docs of that version.
`kaloko ci github --release --snippet` prints the step to put after the tool's own step instead (release-please:
`if: steps.release.outputs.release_created`; changesets: `if: steps.changesets.outputs.published == 'true'`;
semantic-release: right after `npx semantic-release`). On GitLab, call `kaloko release <version> --no-write` in
the release job. Ask before writing a workflow.

### "What's new" e-mail

Readers subscribe per product on its changelog or docs page (Business). When a release is recorded, they get its
entry with pictures in their language. Nothing to do in the repository beyond writing the entry for people.

## Products, modules and versions

Without `products:` in `kaloko.config.yml` the project is the product and `CHANGELOG.md` in the root is its
changelog. Pick the pattern that fits; tag new scenarios accordingly without asking each time:

1. **One app, one team**: no products. Optional `docs: { changelog: CHANGELOG.md }`.
2. **Monorepo with several apps**: one product per app, each with its version file and changelog; every scenario
   says `product: <slug>`.
   ```yaml
   products:
     shop:
       name: { en: Web shop, cs: E-shop }
       version: { source: package.json, path: apps/shop/package.json }
       docs: { changelog: apps/shop/CHANGELOG.md }
       project: eshop
       reference_env: staging
     admin:
       version: { source: git-tag, pattern: "admin-v*" }
   ```
3. **Agency**: a project per client, a product per client deliverable; client guests of the project read only that
   product's changelog.
4. **Large app with modules**: one product with `modules: [checkout, account, …]`; scenarios carry
   `product:` and `module:`; one combined release changelog with a section per module if the team wants it.

The version comes from what the repository already uses: release-please, changesets, semantic-release,
`package.json` (or pyproject/Cargo/gemspec), else git tags `v*`. When a release tool writes `CHANGELOG.md`, Kaloko
reads its entry and never rewrites the file; put your draft into the pull request or release notes instead.
`reference_env` says which environment the pictures come from (default: any accepted run).

`kaloko doctor` warns when a product's version cannot be read or a scenario names no product while several exist.

A product shows in the app (Products in the main menu, `/<org>/products`) once it is on Kaloko. `kaloko release` and
`kaloko docs publish` put it there; to put the products of the config there before their first release, run
`kaloko products sync` (`--product p` for one, `--dry-run` to see what it would send). It records no release, and
`publish:` still needs an admin of the product's projects. `kaloko products list` shows the products on Kaloko with
their newest version and docs, and names those of the config that are not there yet. After adding or renaming a
product in the config, run `kaloko products sync` and say so in your summary.

## Readers

The changelog page (`/<org>/products/<product>/changelog`, or `/<org>/projects/<project>/changelog`) and the docs
(`…/docs`) are read by everyone who sees one of the product's projects, guests included. An admin of those projects may open it to
readers from the organization's verified domains or publish it (`/p/<org>/<product>/changelog` with an Atom feed;
not indexed until the organization allows it). `publish:` in the config only asks for it; an admin confirms on the
page. Never publish without the person asking.

## MCP

`list_products` (the products the caller reads, with the newest release, docs and readers), `get_changelog` (releases with entries; `resolve: true` adds the pictures), `draft_changelog_entry` (the service's
half of a draft: changed screens with before/after references), `resolve_step_image` (one reference),
`docs_check` (what needs attention in the published docs), `get_docs` (the docs, or one page).
