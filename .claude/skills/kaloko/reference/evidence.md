# Quality evidence for your own documentation

Use this when a team's own repository turns Kaloko runs into its documents: test protocols, reports, trace
matrices, release summaries for its quality management system (ISO 9001, ISO 13485, IEC 62304, ISO 27001, or GxP
under 21 CFR Part 11 and EU GMP Annex 11, the strictest case). Kaloko provides the evidence and a way to check it;
the team's own templates and skills write the documents. Kaloko never formats anything for a particular QMS, and you do not put
the team's SOP structure into Kaloko.

The background for people (what a record proves, the two signing paths, known gaps) is in Kaloko's help, page
*Quality evidence for your QMS* (it maps the frameworks and has a GxP section). Evidence is a Business feature.
Kaloko provides evidence; it never makes a team compliant or certified, so never write that it does.

## The contract

Everything below is `qawalk.evidence.v1` (`schemas/evidence.v1.json` in the `kaloko` package, every field
described). Within v1 fields are only added; read the fields you need and ignore the rest.

- `acceptance`: `none`, `accepted` or `returned`. Write your document from this field, never from the presence of
  others.
- `signing`: `in_kaloko` when a signature made in Kaloko stands, `none` otherwise. With `none` the approval, if any,
  is signed elsewhere; your document says so ("executed in Kaloko; approval recorded in <your eQMS>").
- `record.sha256` and `record.kind` (`acceptance` or `execution`): the signed record the evidence came from. Put the
  hash into your document so a reader can tie it to the package.
- `scenario` (`version`, `file`, `sha256`, `refs`), `environment`, `git`, `tools` (CLI, Node.js, OS, browsers,
  service version).
- `steps[].criteria[]`: the criterion text as walked, `refs`, and `results[]` per locale and viewport with
  `assessed_by` (`person`, `deterministic`, `ai`, `none`) and `assessor` (an e-mail or a model id). `advisory: true`
  means an AI result no person decided: never present it as a person's verdict.
- `steps[].decision`, `verdict`, `approvals`: people's decisions apart from tokens' and agents'
  (`counts_as_person`).
- `signatures[]` (name, e-mail, `signed_at`, `time_zone`, `local_time`, `meaning`, `auth`, `withdrawn`) and
  `decision_changes[]` with reasons.
- `audit[]`: the run's audit trail; `trace[]`: the trace matrix, one row per requirement, criterion, step, locale and
  viewport (columns in `TRACE_COLUMNS` order, the same as `trace.csv`).
- A release (`kind: release`) has `runs[]` (each a run evidence), `missing[]` with reasons and one `trace[]`.

## Getting it

```bash
npx kaloko evidence <run-id> --json > evidence.json            # one run, any shared run
npx kaloko evidence --release 2.4.0 --product lims --json > release.json
npx kaloko evidence <run-id> --csv > trace.csv                 # the trace matrix only
npx kaloko signoff <run-id> --package --out evidence/          # the signed zip, checked on download
npx kaloko signoff --verify evidence/kaloko-evidence-<run-id>.zip   # check it again later, no token needed
```

Over the API with a read token: `GET /api/v1/orgs/<org>/runs/<id>/evidence`, `…/evidence.zip`, `…/trace.csv`,
`…/audit.csv`, and `GET /api/v1/orgs/<org>/evidence?product=<p>&version=<v>`. Over MCP: `get_evidence` with `run_id`, or
`product` and `version`.

## When it is ready

An organization admin adds a webhook with the event `evidence.ready` (Settings → Integrations → Webhooks). It fires
when a run is shared, accepted or returned, and when a release is recorded or updated. It is signed like every Kaloko
webhook (`Kaloko-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">`); check the signature and the age of `t`
before you trust it. The body:

```json
{ "id": "evt_…", "type": "evidence.ready", "created_at": "2026-10-07T10:00:00.000Z", "org": "acme",
  "data": { "kind": "run", "reason": "accepted", "run": { "id": "2026-10-07-batch-x1y2z3", "scenario": "BATCH", "environment": "validation", "project": "lims", "verdict": "accepted" },
            "acceptance": "accepted", "signing": "none", "schema": "qawalk.evidence.v1",
            "evidence_url": "https://kaloko.app/api/v1/orgs/acme/runs/…/evidence", "package_url": "…/evidence.zip", "trace_csv_url": "…/trace.csv" } }
```

The URLs need a token (`Authorization: Bearer …`); the webhook never carries the evidence itself.

A neutral client-side job, for example a small service or a CI job triggered by the webhook:

1. Check `Kaloko-Signature` with the webhook's secret; drop events older than five minutes.
2. Download `package_url` with a read token into your own storage.
3. Run `npx kaloko signoff --verify <zip>`; stop and alert on any failure.
4. Read `evidence.json` from the zip and hand it to your generator with your templates.
5. Store the generated document next to the package and the record's SHA-256; your eQMS takes it from there.

## Rules for an agent

- Never accept, approve or sign for a person. Tokens and agents cannot sign; where an organization signs in Kaloko,
  only a person does, in the app.
- Never present `advisory` results as decisions, and never drop the AI model name from a result.
- Do not turn the signature policy on or off; that is an admin's decision in Settings → Security.
- Add `refs:` to scenarios, steps and criteria when the team gives you requirement IDs; do not invent them.
- Keep the package as you got it. To change anything, generate a new document; the package stays the evidence.
