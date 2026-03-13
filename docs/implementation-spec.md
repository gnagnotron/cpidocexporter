# SAP CPI Documentation Automation - Implementation Spec

## 1. Metadata scope

The generated documentation includes:

- iFlow catalog: id, name, version, package, deployment metadata.
- Endpoints and adapters extracted from artifact resources.
- Integration variables and parameters, excluding secure/sensitive values.
- Error handling and retry markers (exception/retry artifacts).
- Dependency map across design-time artifacts.

## 2. API and OAuth2 mapping

### Authentication

- OAuth2 `client_credentials` against `SAP_TOKEN_URL`.
- Required env vars: `SAP_CLIENT_ID`, `SAP_CLIENT_SECRET`.
- Access token is reused for all CPI API calls in one run.

### CPI endpoints used

- `GET /api/v1/IntegrationDesigntimeArtifacts?$format=json&$top=<N>&$skip=<M>`
  - Purpose: paginated iFlow catalog.
- `GET /api/v1/IntegrationDesigntimeArtifacts(Id='<id>',Version='<version>')/$value`
  - Purpose: iFlow detail payload used for adapters, variables, dependencies, and error handling markers.

### Resilience strategy

- Timeout configurable by `SAP_API_TIMEOUT_MS`.
- Retry for `429`, `5xx`, and transport errors.
- Exponential backoff: 500ms, 1000ms, 2000ms, ... up to `SAP_API_MAX_RETRIES`.
- Pagination via `$top/$skip`, page size from `SAP_API_PAGE_SIZE`.

## 3. Canonical JSON model

The canonical model has:

- `schemaVersion`, `generatedAt`
- `summary` (counts)
- `integrations[]` with normalized metadata
- `dependencyGraph[]` edges
- `metrics` for observability

File outputs:

- `output/latest.json` latest successful run data
- `output/last-good.json` fallback baseline

## 4. HTML rendering design

Main sections:

- Summary KPIs
- Dependency map table
- iFlow catalog section
- Per-iFlow expandable blocks for:
  - endpoints/adapters
  - variables
  - error handling and retry
  - dependencies

Design constraints:

- Responsive layout for desktop/mobile.
- No sensitive values rendered.
- Stable structure for diff readability across runs.

## 5. Daily scheduler

- Internal scheduler using `node-cron`.
- Configured by `CRON_EXPRESSION` and `TIMEZONE`.
- Default: `0 30 2 * * *` in `Europe/Rome`.
- Retention cleanup deletes dated HTML reports older than `RETENTION_DAYS`.

## 6. Security controls

- Secrets only from environment variables (`.env` for local dev).
- `.env` excluded by `.gitignore`.
- Log masking for bearer tokens and `client_secret` fragments.
- Variables marked secure/sensitive are excluded from rendered docs.
- Least-privilege service account is required.

## 7. Observability

Structured logs include:

- run start/end
- retries with status code and backoff
- partial detail fetch warnings
- success/failure summaries

Metrics captured:

- `durationMs`, `iflowCount`, `apiCalls`, `retries`, `warnings`, `errors`

Optional alerting:

- Webhook notifications via `ALERT_WEBHOOK_URL` for success/failure.

## 8. Quality gate and fallback

Quality gates:

- canonical model shape must be valid
- required integration fields and arrays present

Fallback behavior:

- on run failure, renderer uses `output/last-good.json` if available
- preserves a consistent `output/index.html` for consumers

## 9. Operational runbook linkage

Operational procedures are in:

- `runbook/operations.md`

## 10. Verification checklist

- API test: valid token + catalog fetch + details for sample iFlow.
- Output test: verify all sections in generated HTML for at least five iFlows.
- Scheduler test: verify three consecutive daily runs in non-prod.
- Resilience test: simulate timeout/rate-limit and confirm retry + alert.
- Security test: ensure no secrets in logs/output and scoped API permissions.
