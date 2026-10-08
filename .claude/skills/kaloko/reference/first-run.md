# First run in a new project

Use this when the project has no `kaloko.config.yml` yet, or the organization
has no shared run of its own. The goal is one real flow on the canvas, shared,
with a person who knows where to approve it.

## Where the organization stands

- `GET /api/v1/orgs/<org>/getting-started` (MCP tool `get_started`) answers
  `stage` (`empty`, `sample`, `active`), the sample run's URL, how many real
  runs exist, the next steps and a prompt to start from.
- Every new organization has a **sample run**: a tea-shop checkout in Czech
  and English on desktop and mobile, with one failing step per language, one
  overflow on the phone and one criterion waiting for a person. It does not
  count toward the plan and expires after 30 days. `<service>/<org>/sample`
  opens it; it carries a short guide for the person (open a step, approve,
  return with a note, share).
- If the person has never reviewed a run, send them the sample link first:
  they learn the canvas there, not on your first draft. When it is gone,
  `POST /api/v1/orgs/<org>/sample` (MCP `add_sample_run`, needs an upload or
  full token) adds it again. Do not delete it unless asked
  (`DELETE /api/v1/orgs/<org>/sample`).

## From zero to a first shared run

1. `npm install --save-dev kaloko`, then
   `npx kaloko init --agent claude --org <org> --project <slug> --project-name "<name>"`
   (it prints the sample link and these steps). Ask the person how the project
   should be called on Kaloko when you do not know; the slug is lowercase
   (`eco-podcasty`), the name is what people see (`ECO Podcasty`). Fill
   `environments` in `kaloko.config.yml` with the URL the app runs on. When
   the repository holds several sites, see [Several sites in one
   repository](#several-sites-in-one-repository) first.
2. `npx kaloko login`: the person approves a token in the browser. Ask them
   to; never create or paste tokens yourself. Then `npx kaloko projects sync`
   puts the project of the config on Kaloko with its name (a first
   `kaloko share` would create it too).
3. `npx kaloko doctor` and fix what it marks ✕.
4. Draft the first scenario:
   - public pages: `npx kaloko draft <url> [url…]` writes a read-only
     production scenario and a plan; sharpen purposes and criteria;
   - a task or the main flow of the app: write `ACCEPTANCE.md` and
     `qa/scenario.yml` as in [acceptance.md](acceptance.md). Pick the flow a
     person would show a client (sign-up, checkout, the main form), not every
     page.
5. `npx kaloko validate qa/scenario.yml`, then
   `npx kaloko start --scenario qa/scenario.yml --env local`, `kaloko walk`,
   `kaloko build`. Fix scenario mechanics until every step has a capture.
6. Ask before `kaloko share` (see *Ask first* in SKILL.md). After sharing,
   give the person the canvas URL and say what to look at: the failing
   criteria with their evidence and the steps that need a decision.
7. Read `kaloko feedback` when they have looked; fix what they returned and
   walk again.

Done means: the scenario validates, the run is shared, its URL and summary
line are in your reply (and in the issue or PR the work belongs to), and the
person knows whether the sample or this run is what they should open.

## Several sites in one repository

A monorepo (`apps/*` with their own dev server), a Rails app with engines or
several Folio sites, or routes split by host: `kaloko init` lists the sites
it found and drafts no steps, because routes of the whole repository mix the
sites (favicons, ad endpoints and API routes of another site end up as
"pages").

1. Ask the person which site the work is about before `init` or a walk. Do
   not pick one yourself.
2. Run init for that site, best against the running site so the pages come
   from its sitemap or its navigation:
   - `npx kaloko init --site eco-podcasty --base-url http://eco-podcasty.localhost:3000`
   - `npx kaloko init --site apps/web` (a workspace app: its own routes and dev
     server; `--base-url` still reads the running site when it is up)
   Only the host of `--base-url` is asked, with short time limits; offline the
   code is read.
3. Read the comment at the top of `qa/flows/main-pages.yml`: it says where the
   pages came from and which paths were skipped and why. Sharpen the steps;
   add pages the person names.
4. When the site is not running and has no routes of its own (a Folio site),
   `npx kaloko init --site <name> --skeleton` writes a scenario with a TODO;
   fill it with the pages the person names.

One config can serve one site. For a second site of the same repository use
another config (`--config kaloko.<site>.config.yml`) with its own `project:`.
