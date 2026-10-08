# CI and pull request previews

Kaloko runs in CI with the same commands as on a laptop. `kaloko ci` writes the
workflow; you only add a token. Writing or replacing a CI workflow changes the
repository's pipeline: ask the person first.

```bash
kaloko ci github [--scenario qa/flows/checkout.yml,qa/flows/signup.yml]   # .github/workflows/kaloko.yml
kaloko ci gitlab                                                       # kaloko.gitlab-ci.yml (include it)
kaloko ci github --print                                               # show it, write nothing
```

What the generated workflow does on every preview deployment of a pull
request (Vercel, Netlify and Cloudflare Pages report their previews as GitHub
deployments; `--trigger pull_request` runs on every push instead and waits for
the deployment):

1. installs the project (`npm ci`, or pnpm, yarn, bun by the lockfile) and the
   Chromium of kaloko's Playwright (`kaloko browser install --with-deps`), plus
   WebKit and Firefox when a scenario or `walk.browsers` names them
   (`--browsers chromium,webkit`; see [devices.md](devices.md));
   `KALOKO_BROWSER_CHANNEL=chromium` makes the run use it, so no separate CI
   config is needed;
2. `kaloko ci preview-url --wait 600 --github-env` finds the preview URL, the
   pull request and its base branch and puts them into `KALOKO_PREVIEW_URL`,
   `KALOKO_PR`, `KALOKO_BASE`;
3. for each scenario: `kaloko affected --fail-if-none` skips it when the change
   does not reach any of its steps (workflows written earlier say `--check`,
   which works the same and prints a note), otherwise `start --env preview`,
   `walk --ephemeral --affected` and `share --pr` (one comment per scenario,
   updated on later pushes).

`kaloko ci` also adds the `preview` environment to `kaloko.config.yml` with
`base_url: ${KALOKO_PREVIEW_URL}`. Scenarios that list `environments:` must
include `preview`, or `start` refuses them; the command says which.

## Secrets

- `KALOKO_TOKEN`: a token with the tester role and the upload scope (Settings →
  API tokens; on Enterprise a service account's token, which no person owns).
- `TYPESAFE_API_KEY` only when semantic criteria should use your own evaluator
  key instead of the organization's allowance.
- Vercel deployment protection: a `VERCEL_AUTOMATION_BYPASS_SECRET` secret and
  the commented `access.headers` block of the preview environment.
- GitLab: `KALOKO_GITLAB_TOKEN` (project access token, `api` scope) for the
  merge request note; set `KALOKO_PREVIEW_URL` in the job when the review app
  URL is known (`https://$CI_COMMIT_REF_SLUG.review.example.com`), or rely on
  `CI_ENVIRONMENT_URL`.

## Where the preview URL comes from

`kaloko ci preview-url` takes the first of: `KALOKO_PREVIEW_URL`; the
`deployment_status` event; `VERCEL_BRANCH_URL`/`VERCEL_URL`,
`DEPLOY_PRIME_URL`/`DEPLOY_URL` (Netlify), `CF_PAGES_URL`,
`CI_ENVIRONMENT_URL` (GitLab), `RENDER_EXTERNAL_URL`; then the commit's GitHub
deployments, skipping production, polled every 10 s up to `--wait` (seconds,
or with a unit: `--wait 10m`). Only the URL goes to stdout, so
`export KALOKO_PREVIEW_URL="$(kaloko ci preview-url)"` works in any CI;
`--json` prints the URL, its source and the pull request as one JSON object.

## Affected steps in CI

`walk --affected` needs the history: check out with `fetch-depth: 0` (GitHub)
or `GIT_DEPTH: "0"` (GitLab). The base is `--base`, else `KALOKO_BASE`,
`GITHUB_BASE_REF`, the merge request target, then `origin/main`. URLs captured
in the newest shared run of the scenario count too, so a fresh CI checkout
maps routes as well as a laptop with earlier runs. See
[execution.md](execution.md#only-what-changed).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | done |
| `1` | checks found problems, or the command failed (an HTTP error from the service other than 401 too) |
| `2` | usage error: unknown command or option, missing argument |
| `3` | the Kaloko service cannot be reached (no connection: offline, DNS, refused, cut off); retrying may help |
| `4` | no token, or an invalid, expired or revoked one: `kaloko login`, or a new `KALOKO_TOKEN` secret |

A CI step can tell a broken workflow line (2) or a missing secret (4) from a
failing check (1), and retry only on 3. Checks keep 1: `docs check`, `drift`,
`design lint`, `affected --fail-if-none`, `validate`. `kaloko help <command>`
or `kaloko <command> --help` shows the options of one command.

## Machine output

`--json` on a command that prints data makes stdout one JSON document and
nothing else: progress, notes and warnings go to stderr. An error is one line
on stderr, `{"error":{"message":"…","code":"…","next":"…"}}`, with the exit
code above (`code` is `usage`, `unreachable`, `no_token`, `unauthorized`, a
service reason such as `plan`, or `failed`). Commands with `--json` include
`start`, `status`, `evaluate`, `build`, `share` (run id and canvas URL),
`validate`, `scenarios`, `runs`, `review`, `feedback`, `auth list`,
`browser status`, `ci preview-url` and `affected`.

```bash
url=$(npx kaloko share --json | jq -r .url)
```

`kaloko runs --all` follows the service's pages to the last run; `--limit N`
stops after N and prints the cursor to go on with (`--cursor`) on stderr.

## Done means

The workflow file and the config change are committed after the person agreed,
the secret is named for the person to add, and you report the first run's PR
comment or why it did not appear (no preview deployment, missing token).
