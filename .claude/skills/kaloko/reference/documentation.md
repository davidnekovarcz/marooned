# Documentation from runs

A run is also a library of reference captures: every step, locale and
viewport has a screenshot and the HTML. On the Business plan the service
gives each step a stable address, lists what changed, and calls you when a
run is accepted, so a manual, a course or product documentation can be
rebuilt from the newest accepted run instead of screenshotting by hand.

## Prepare the run

- Walk the scenario as usual and let a person accept the run on the canvas;
  documentation should come from accepted (or baseline) runs only.
- Tag the release (`git tag v2.4.0`) before `kaloko start`, or pass
  `--app-version 2.4.0`; the version lands in the manifest as `app_version` and in every
  latest-capture answer, so the documentation can say which version it shows.
- Accepted and baseline runs do not expire on Business and Enterprise.

## Stable URLs

With an organization token (`Authorization: Bearer kal_…`, a read-only
viewer token is enough):

```
GET /api/v1/orgs/<org>/scenarios/<scenario>/steps                      step index with links
GET /api/v1/orgs/<org>/scenarios/<scenario>/steps/<step>/latest.json   metadata (run with app_version, captured_at, page URL, size)
GET /api/v1/orgs/<org>/scenarios/<scenario>/steps/<step>/latest.image  the screenshot (latest.webp or latest.png when you know the format)
GET /api/v1/orgs/<org>/scenarios/<scenario>/steps/<step>/latest.html   the captured HTML (served sandboxed)
GET /api/v1/orgs/<org>/scenarios/<scenario>/changes                    steps changed since the previous accepted run
```

Add `?locale=cs&viewport=desktop` (defaults: the run's first locale and
viewport) and `&accepted=1` to use the newest accepted run instead of the
newest run. Files answer with an `ETag`; send `If-None-Match` and a 304 means
nothing to download.

## Only rebuild what changed

`changes` (MCP `list_step_changes`) compares the newest run with the previous
accepted one, or with `?since=<run id>`. A step is listed when it is new, its
image bytes differ, or its status changed; `removed` lists steps that are
gone. Timestamps or animations make a page count as changed, so keep
captures stable (fixed test data, no clocks on screen) for documentation
scenarios.

## Webhooks

Settings → Integrations → Webhooks (admin): an https URL and the events
`run.accepted` and/or `run.shared`. Each call is a JSON POST
`{ id, type, created_at, org, data: { run, steps, steps_url, changes_url } }`
with `Kaloko-Signature: t=<unix time>,v1=<hex HMAC-SHA256 of "<t>.<body>">`
signed with the webhook's secret (copy it from Settings). The old
`QAwalk-Signature` header is still sent with the same value, so existing
receivers keep working; read `Kaloko-Signature` in new code. Verify the
signature and the time (reject older than 5 minutes), answer 2xx within 5
seconds, and do the work asynchronously. Also over the API:
`GET|POST /api/v1/orgs/<org>/webhooks`, `DELETE …/webhooks/<id>`.

## Export into a folder

```bash
npx kaloko export steps --scenario checkout --accepted --out docs/assets/checkout
```

writes `steps/<step>/<locale>/<viewport>.<ext>` and `.html` plus
`index.json` (run with app_version, captured_at, page URL per file). Run it again and
files from an unchanged run are kept, so a documentation repository sees only
real changes. `examples/docs-pipeline.mjs` in the Kaloko repository shows a
complete loop that rebuilds a Markdown manual and touches only changed steps.

## Done means

The manual or course references the exported files (or the stable URLs), says
which application version it shows, and a re-run after a new accepted run
changes only the pages of steps listed by `changes`.
