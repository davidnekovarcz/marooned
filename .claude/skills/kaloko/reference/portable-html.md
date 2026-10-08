# Portable interactive HTML

Design steps are live pages. The same files have to work in three places:

- **on the live origin** of the canvas (`<revision>.kaloko-usercontent.com`): a sandboxed frame with an opaque origin and
  `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none';
  worker-src 'none'; form-action 'none'` (no popups, no modals, no service workers);
- **from disk** (`file://`): the local preview, `kaloko export design`, and anyone who unzips an export;
- **in another tool**: the export is the handoff and the way out of Kaloko.

`kaloko design lint` checks a design folder against the rules below; `kaloko sync` runs it first and stops on errors
(`--no-lint` skips it, `kaloko walk` prints a summary). Errors break for certain on the live step; warnings make the
prototype fragile or the captures unstable. `kaloko design lint --all` also lists information, `--strict` fails on
warnings, `--json` gives every finding with file, line, rule and fix.

## Files

- Everything a page needs is in the design folder, referenced with **relative paths** (`../_shared/app.css`). No
  `https://`, no protocol-relative `//cdn…`, no paths starting with `/` (on the live origin `/` is the origin root, from
  disk it is the disk root). Errors: `external-url`, `root-relative`, `outside-folder`, `missing-file`.
- **No CDNs.** Download libraries into `_shared/` and link them relatively. Fonts are bundled as **woff2**, subset to
  the characters used, with `@font-face` in the shared CSS.
- **Font and asset origins** are the one exception, for stylesheets, fonts and images only: an organization admin
  allows origins such as `https://fonts.googleapis.com`, `https://fonts.gstatic.com`, `https://use.typekit.net` or
  the company CDN in Settings → Security, and live steps load them. Declare the ones the design uses on the design
  environment (`origins: [https://fonts.googleapis.com, https://fonts.gstatic.com]`); `kaloko design lint` then
  takes them instead of an `external-url` error and warns (`origin-not-allowed`) about each the organization does
  not allow yet. Scripts, module imports, `fetch` and video never load from them. A bundled font still works from
  disk and from an export; prefer it when you can.
- Only bundle file types (html, css, js, mjs, json, svg, woff2, woff, png, jpg, webp, avif, gif, mp4, webm, txt).
  Convert TTF/OTF fonts and other formats (`file-type`).
- **Size budget:** a file over 1 MB or a step over 5 MB (with the shared files) warns (`large-file`); 10 MB per file
  and 40 MB per step are the limits (`too-large`). Images as webp/avif at the size shown.

## Links between steps

- Link steps with **plain relative links to the page itself**: `<a href="../payment/index.html">`, from a locale page
  `../../payment/cs/index.html`. A link to a folder (`../payment/`) opens nothing from disk or a zip
  (`directory-link`); a link to a page that does not exist warns (`broken-link`).
- The canvas follows such links in the presentation and the Live view, and `data-kaloko-go="payment"` (or the older
  `data-qawalk-go`) moves to a step whatever the `href` says. Keep a real `href` next to it so the page also works
  from disk.
- No `target="_blank"`, `window.open`, `top.location` (`new-window`, `top-navigation`): the frame may not open
  windows or navigate the canvas.
- Forms do not submit (`form-action 'none'`): handle `submit` in a script (`event.preventDefault()`) and go on with a
  link or `data-kaloko-go` (`form-action`).

## State and data

- **State between steps lives in `window.kaloko.state` or the URL**, not in storage: `localStorage`,
  `sessionStorage`, IndexedDB and cookies throw in the sandboxed frame and are empty for every other viewer
  (`storage`). For a cart, a chosen plan or details filled in on an earlier step use the prototype state
  ([design.md → Prototype state](design.md#prototype-state)); for a single value the query and hash do
  (`?plan=pro#card`): a link's query and hash travel to the next step in the presentation, and work from disk.
  Wrap any storage access you keep in `try/catch` with a fallback.
- **No network:** real APIs, `XMLHttpRequest`, `WebSocket`, `EventSource` do not connect (`websocket`). Put data in
  JSON fixtures of the bundle and `fetch('./fixtures/cart.json')`.
- **No code from strings:** `eval`, `new Function`, `setTimeout('…')` are blocked (`eval`). No service workers
  (`service-worker`), no iframes, `object` or `embed` (`embedded-frame`). `alert`, `confirm` and `prompt` are blocked
  (`modal`): use an in-page `<dialog>`.

## Deterministic content

Captures are cached by content and compared in pixels. A page that changes on every render makes unchanged steps look
changed (`nondeterministic`):

- fixed dates (`new Date('2026-01-15T10:00')`), no `Date.now()` or `new Date()` for visible text;
- fake data from a seeded generator, not `Math.random()` or `crypto.randomUUID()`;
- animations that end, or none at the moment of capture; content that does not depend on load timing.

## Document basics

Every page starts like this (`doctype`, `charset`, `viewport-meta`, `lang`, `title`):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment · Checkout</title>
  <link rel="stylesheet" href="../_shared/app.css">
</head>
```

- Images have `alt` (`alt=""` for decoration) (`img-alt`); real buttons, labels for fields, one `<h1>`, landmarks.
- Respect `prefers-reduced-motion` when anything animates (`reduced-motion`):
  `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important } }`
- The mobile viewports render at their real width: the viewport meta and fluid layout matter.

## Tokens

- `tokens.json` (W3C DTCG) in the folder root; values as **CSS custom properties** in the shared CSS
  (`--color-accent: #2e6bff`) and used with `var(--color-accent)`, so the inspector names them and `kaloko tokens check`
  sees raw values (`tokens-unused`, `no-tokens`).
- Name custom properties after the token path with dots as dashes (`color.accent` → `--color-accent`).

## Done means

`kaloko design lint` shows no error and no warning you cannot explain, the pages open from the folder by
double-click and click through, and `kaloko walk` renders the same in every viewport.
