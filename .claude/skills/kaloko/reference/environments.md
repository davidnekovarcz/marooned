# Environments

Profiles live in `kaloko.config.yml` under `environments`. The CLI enforces
them; do not work around a block.

- `local`, `review`, `staging`: you may create the test data a scenario
  needs (users with roles, carts, orders in test payment mode).
- `production`: always readonly, regardless of config. Only scenarios with
  `readonly: true`, as an ordinary visitor or customer. No admin, no sign-in
  to back offices, no data creation, no orders. Typical: SEO checks, landing
  pages, checkout up to payment.

Test data preparation for review and staging belongs to the project's CI
prepare step; assume it exists and create only what the scenario itself needs.

Pull request previews (Vercel, Netlify, Cloudflare Pages, review apps) are an
environment whose URL comes from CI: `preview: { base_url: ${KALOKO_PREVIEW_URL} }`,
which `kaloko ci github|gitlab` adds and `kaloko ci preview-url` fills; see
[ci.md](ci.md).

An environment says where the product runs. In which browsers, on which devices and in which colour scheme it is
walked is the run's matrix: `browsers`, `color_schemes`, `reduced_motion` and device presets in `viewports` of the
scenario, defaults in `walk:` of the config, `--browsers` and friends on `kaloko start`; see
[devices.md](devices.md). App devices (emulators, simulators, phones) are named per environment under
`app.<platform>.devices`; see [apps.md](apps.md).

## Who does what

Kaloko needs evidence in its format: captures of screens and e-mails in a run.
How you get to them depends on the project's stack, and that part is yours.

- **The CLI handles the standards**: HTTP Basic and header tokens in front of
  an environment, client certificates, a saved browser session, the readonly
  policy, Mailpit, and e-mails as `.eml`, `.html`, `.json` or `.txt`.
- **You arrange the rest for this project** with its own tools and common
  practice: how test users are created and signed in, where the application's
  e-mails end up, how a review app's URL is known. Write that down once in the
  project (config, step scripts, a mail adapter, a project skill) so the next
  run does not rediscover it.
- **You ask the person** for secret values and for anything only a person can
  do (an SSO or MFA sign-in, VPN access, a new test account in a system you
  cannot reach).

## Access to an environment

Three layers, each in its own place:

| Layer | Examples | Where |
|---|---|---|
| Gate in front of the whole environment | HTTP Basic, Cloudflare Access service token, Vercel protection bypass, a custom header, mutual TLS | `environments.<env>.access` |
| Sign-in to the application | form login, SSO/OAuth, MFA/TOTP | scenario `sessions` + `environments.<env>.accounts` + step scripts |
| Network | VPN, IP allowlist | not config: the machine running the agent must have access; say so when it does not |

```yaml
environments:
  staging:
    base_url: https://staging.example.com
    access:
      origins: [https://staging.example.com, https://api.staging.example.com]  # default: base_url origins
      basic: { user_env: STAGING_USER, password_env: STAGING_PASSWORD }
      headers:
        CF-Access-Client-Id: { env: CF_ACCESS_CLIENT_ID }
        CF-Access-Client-Secret: { env: CF_ACCESS_CLIENT_SECRET }
      client_certificate: { cert_file: certs/qa.pem, key_env: QA_CLIENT_KEY }
    accounts:
      member: { user: member@example.test, password_env: STAGING_MEMBER_PASSWORD }
      admin: { user_env: STAGING_ADMIN_USER, password_env: STAGING_ADMIN_PASSWORD, totp_env: STAGING_ADMIN_TOTP }
      sso: {}
  review:
    base_url: https://${REVIEW_HOST}      # review apps: CI provides the variable
```

Rules:

- Secrets never go into `kaloko.config.yml`, a scenario or a step script.
  Every `*_env` and `{ env: NAME }` names a variable; the values live in the
  environment, the project `.env` (ignored by git) or `~/.config/kaloko/.env`.
  Choose names that fit the project; ask the person for the values.
- The gate is sent only to `access.origins`, never to third parties (analytics,
  CDNs, payment providers). List an API on another host explicitly;
  `https://*.example.com` covers subdomains.
- The CLI applies the gate and the readonly policy to every browser context it
  creates: the shared browser, `walk` sessions and one-off captures. A context
  you create yourself over CDP does not get them; work in the shared browser's
  default context, or use `walk`.
- Values the CLI knows as secrets are replaced by `[redacted]` in captured HTML,
  page text and console entries. Screenshots are not redacted: do not capture
  a screen that shows a secret.
- `kaloko doctor` checks that the variables are set, that the gate lets you in
  (HTTP 401/403 is a failure) and that each account can sign in or has a
  saved session.

## Accounts and sign-in

A scenario session's `account` is a key; `environments.<env>.accounts.<key>`
maps it to credentials in that environment. Step scripts receive them as
`session.credentials` (`user`, `password`, `totp()`, `storage_state`) and sign
in the way the application does it:

```js
export default async ({ page, url, session }) => {
  const { user, password } = session.credentials
  await page.goto(url('sign-in'))
  await page.fill('input[type=email]', user)
  await page.fill('input[type=password]', password)
  await page.click('button[type=submit]')
  if (await page.locator('input[autocomplete=one-time-code]').isVisible()) await page.fill('input[autocomplete=one-time-code]', session.credentials.totp())
}
```

SSO or MFA that a script cannot pass: ask the person to run
`kaloko auth save --env <env> --account <key>` once. They sign in in a
visible browser; the session is saved under the output directory (owner-only,
git-ignored, never uploaded) and `walk` loads it into that account's sessions.
When the application asks for sign-in again, the session expired: ask for a
new `auth save`. `kaloko auth list` shows the saved sessions and their age.

Prefer, in this order: a test account the project already has for QA; a
seeded or API-created account on non-production environments; a saved
session. Never use a real person's account.

## E-mails

Flows that send e-mails need the message as an `email` step. Where the
message is depends on the stack:

- **Mailpit** (built in): `mail: { provider: mailpit, url, auth, address }`.
  `auth` takes `basic` and `headers` like `access`. `address` with `{run}`
  gives every run its own recipient, so shared mailboxes stay apart.
- **Anything else** (letter_opener, Mailosaur, MailSlurp, IMAP, a log, the
  application's own API): write a small adapter and set
  `mail: { provider: script, script: qa/mail/inbox.mjs, options: {...} }`.
  Its default export is `async ({ to, subject, since, options, root, env })`
  and returns the newest matching message
  `{ id, subject, from, to: [address], date, html, text }` or `null`;
  `kaloko mail` and `walk` poll it. The package ships an example to copy:
  `node_modules/kaloko/templates/mail/letter-opener.mjs`.
- **One-off or unusual**: get the message yourself and hand it over:
  `kaloko mail --step <id> --file message.eml` (also `.html`, `.json` with the
  message shape, `.txt`).

`kaloko mail` and `walk` take only messages received after the run started
(adapters get it as `since`), so a staging mailbox that collects everyone's
mail cannot hand over an old message silently. `--since <ISO date>` moves the
boundary, `--any-time` drops it, and `--id <message id>` takes one exact
message (subjects repeat). The canvas shows when the message arrived and warns
when it predates the run.

Pick what fits the project and keep it in the project; do not change how the
application sends mail just for QA unless the person agrees (switching a Rails
app from letter_opener to SMTP locally, for example).
