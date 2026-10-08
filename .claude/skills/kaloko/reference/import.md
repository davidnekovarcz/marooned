# Importing screenshots, walkthroughs and traces

Agents and test tools already leave screenshots behind: Cursor and
Antigravity walkthroughs, Claude Code screenshots, Playwright reports and
traces. `kaloko import` lays them out as a run, so they are reviewed and
signed off on the canvas like a walk.

```bash
kaloko import shots/                         # into the current run (kaloko start first)
kaloko import playwright-report/ --scenario qa/flows/checkout.yml --env staging
kaloko import test-results/checkout/trace.zip --map "click Pay=payment"
kaloko import walkthrough.md --adhoc         # no scenario: an ad-hoc flow of the screens
kaloko evaluate && kaloko preview            # then kaloko share, as usual
```

Where the screens go: the current run, or a new run of `--scenario`, or with no
run (or `--adhoc`) an ad-hoc flow written to `qa/flows/import-<title>.yml`: one
manual screen per image, in order, read-only.

## Sources

- **A folder with `steps.json`** (also `walkthrough.json`, `kaloko-import.json`):
  ```json
  { "title": "Checkout", "tool": "cursor",
    "steps": [
      { "title": "Cart", "image": "01-cart.png", "step": "cart", "url": "https://shop.test/cart",
        "notes": "Two items, total 41 €", "locale": "en", "viewport": "desktop" },
      { "title": "Payment", "image": "02-payment.png" }
    ] }
  ```
  Only `image` is required. `step` names the scenario step; `viewport` and
  `locale` must be in the run's scope or are chosen for you.
- **A Markdown walkthrough** (`walkthrough.md`, `README.md`, any `.md` in the
  folder): every image `![alt](file.png)` in order, titled by the heading above
  it, with the text between as notes. Links to `.webm`/`.mp4` are recordings.
- **A plain folder of images**: in file name order (`01-…`, `02-…`), titled by
  the name. A folder of folders (Playwright `test-results/`) reads each
  sub-folder as one test.
- **Playwright**: the JSON reporter's file (`--reporter=json`), an HTML report
  folder (`playwright-report/`) or a `trace.zip`. Screenshot attachments become
  screens; a test without them contributes its trace: one screen after each
  page action (goto, click, fill, press …).

`--format folder|markdown|playwright-json|playwright-html|trace` overrides the
detection.

## Mapping to steps

In this order: the item's `step`, `--map "Title=step,…"` (a title, group or
file name containing the label), the URL path against step paths, then the
title against step ids and titles. A second screen for the same step, locale
and viewport becomes an attachment of the step. Unmatched screens are listed
with the command that maps them; nothing is dropped silently. The viewport is
the run viewport closest to the image width (2× and 3× screenshots count by
their CSS width).

## What an imported screen is

The image, encoded like a walked capture, with the tool and the source file.
There is no page behind it: deterministic criteria stay "not evaluated" until
the step is walked, and semantic questions are not asked without page text, so
a person decides on the canvas. Recordings are kept in the run folder
(`imported/`) and are not uploaded yet.

Report it as imported evidence, not as a walk: name the tool and say which
steps still need a real walk.
