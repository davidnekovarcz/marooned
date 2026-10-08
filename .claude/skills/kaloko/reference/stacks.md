# Stack steps: many pages of one template

A stack step (`kind: stack`) stands for many pages that share a template: the
articles of a magazine, product or category pages, an SEO catalogue of
landing pages, pages after a migration. The walk captures every page with
the step's criteria and a few index fields; the canvas shows one node drawn
as a stack. Clicking it opens an index of the pages with search, filters,
sorting, thumbnails and CSV export, and each page opens in the lightbox.

## When to use it

- One template, many instances with different content, and the question is
  whether *all of them* hold up. Examples: "every article has one H1, a
  title of 10–70 chars and a cover image", "no product page returns 404",
  "every city landing has a description and a canonical".
- An SEO audit or design of a page catalogue: list the pages, see the gaps
  per page, and export the failing ones for the content team.
- A redesign or migration: walk the old URL list against the new site.

Not for a flow of different screens: those stay separate steps. A stack
step does not click through anything. It opens each page by URL. Use a
step script only to prepare each page, for example to dismiss a dialog
(see below).

## Declaring it

```yaml
- id: articles
  kind: stack
  title: Magazine articles
  purpose: Every article reads well and is findable.
  packs: [seo]                              # health checks of every page (advisory)
  items:
    sitemap: /sitemap.xml                   # or urls / file / crawl / script (exactly one)
    match: '^/clanky/'                      # regex on the path with its query; exclude: '…' drops pages
    limit: 800                              # default 500, at most 10000
    semantic_sample: 20                     # semantic criteria on the first 20 pages only
    # viewports: [desktop]                  # default: the first viewport of the scenario
  fields:                                   # index columns (max 12); default title, h1, words, http
    - { id: title, label: Title, from: title }
    - { id: words, label: Words, from: words }
    - { id: http, label: HTTP, from: http }
    - { id: author, label: Author, from: .author }
    - { id: cover, label: Cover, from: "article img@src" }
    - { id: links, label: Links, from: "count:main a" }
  # capture: { full_page: true }            # default for stacks is the first screen only
  criteria:
    - { id: AC1, text: Has a cover image, check: { type: deterministic, assert: exists, selector: "article img" } }
    - { id: AC2, text: Reads as an article, check: { type: semantic, question: Does the page read as a complete magazine article? } }
```

Item sources:

- `urls: [/a, /b]` is a short fixed list.
- `file: qa/data/products.csv` is a list next to the scenario. Accepted
  formats are text with one path per line, CSV (first column), or JSON:
  `["/a"]` or `[{ path, title, key, purpose }]`, where `key` gives a stable id.
- `sitemap: /sitemap.xml` also follows a sitemap index (up to 50 sitemaps).
- `crawl: { from: /clanky, links: "a.card", next: "a.next", pages: 20 }`
  collects links from a listing and follows its pagination.
- `script: qa/steps/items.mjs` uses the default export
  `({ page, env, locale, url }) => [paths | { path, title, key, purpose }]` for
  anything else, such as an API or a search.

An item's `purpose` (for example its title and meta description) is what the
semantic evaluator reads as `screen_purpose` for that page instead of the
step's generic purpose, so one question asked of forty different pages is
judged against each page's own intent. A script also decides which pages
belong to which locale: return only the pages of `locale` when the pages
are language-specific (`/cs/…` in cs, the rest in en), so no page is judged
in the wrong language.

Pages are deduplicated. External URLs are allowed (e.g. an old domain).
`{locale}` in any source string is replaced by the walked locale. This is
how one sitemap with every language is split:
`match: '^/guides/.*lang={locale}'`, or `sitemap: /{locale}/sitemap.xml`.

Field sources: `title`, `h1`, `description`, `canonical`, `lang`, `url`,
`path`, `words` (words in main/article/body), `http` (the navigation
status), `count:<selector>`, `<selector>` (text) and `<selector>@<attr>`.

A step `execution.script` still works. It is called with `item` in the
context, opens `item.url` itself and may call `capture()`. Without a script,
the walk opens each page and captures it.

## Cost and size: choose deliberately

- Deterministic criteria and packs run on every page. They are cheap.
- Semantic criteria go to the evaluator. On a stack they run only on the
  first `semantic_sample` pages (default 20). The other pages show the
  criterion as not evaluated. Raise the sample only when the question
  really differs between pages, and tell the person what it costs
  (one call per page and viewport).
- Stacks capture the first screen of each page (fast, small). Set
  `capture: { full_page: true }` when the criteria are about the whole page.
- Walking takes about 1–2 s per page. For a first look, use
  `kaloko walk --limit 50`. Re-walk chosen pages with
  `--items clanek-7,clanek-12` (matches the id or the path).
- A shared run holds at most 20000 files and 300 MB. Each page stores about
  four files, so a stack of a few thousand first-screen pages fits. Split
  larger catalogues by section (`match`), one stack per section.

## Reading the results

- `kaloko build` writes `steps/<step>/items.json` (`qawalk.stack.v1`)
  with every page's fields, status, failing criteria and evidence. The
  preview inlines it, so the local `index.html` works offline.
- The node shows the page count, a pass/fail bar and a few thumbnails, with
  failing pages first. Each criterion carries counts (for example "3/31
  pages" in the report).
- In the index:
  - status chips, a criterion filter, search over path, title and fields,
    sort by any field, list or grid view;
  - keyboard: `/` searches, arrows move, Enter opens, Esc closes;
  - "Download CSV" exports the filtered rows;
  - a page link (`#step=<stack>~<page>`) opens that page directly.
- Over MCP: `get_run_summary` includes the stack summary.
  `get_stack_items {run_id, step, status?, criterion?, query?, offset, limit}`
  lists pages with fields, failing criteria, evidence and screenshot URLs.
  This is the way to hand an agent "fix these 37 articles".

## Report

Say how many pages were walked, how many fail and on which criteria (with
two or three example paths), whether the limit cut the list, and that
semantic criteria covered only the sample. Put the full list in the CSV or
the MCP result rather than in the issue.

## Design environments

On a design environment a stack step is a template with its variants: each variant is a folder of the step,
`design/<step>/<variant>/index.html`, listed by `items.urls` or discovered from subfolders, and every variant is
captured in every viewport. See [design.md](design.md#variants-of-one-template-stack-steps).

Not yet supported for stacks: comparison with a baseline run per page and
the documentation layer (latest captures per step).
