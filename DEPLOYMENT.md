# DCLA Deployment

This repository deploys the Vite client to Netlify and the NestJS API to
Render. Production configuration must be supplied through each platform's
environment settings. Do not commit `.env` files or credentials.

## Runtime Version

Use Node.js `20.19.0` for both services. The package manifests reject older
Node 20 releases because Vite 7 requires Node 20.19 or newer.

## Netlify Client

The root [`netlify.toml`](./netlify.toml) is the authoritative client build
configuration:

- Base directory: `client`
- Build command: `npm run build`
- Publish directory: `dist`
- Required production variable: `VITE_API_URL`

`VITE_API_URL` must be the HTTPS Render API URL ending in `/api`, for example
`https://<render-service>.onrender.com/api`. It is public browser
configuration, not a secret. Production builds fail when it is missing or
invalid. Development retains `http://localhost:3000/api` as its default.

The catch-all rewrite serves `/index.html` with status 200 and `force = false`.
Netlify therefore serves existing static assets normally while direct React
Router paths such as `/transactions`, `/member-management`, and `/collections`
receive the SPA shell.

## Render API

Configure the backend as a Render Web Service:

- Root directory: `server`
- Runtime: Node.js
- Node version: `20.19.0`
- Build command: `npm ci --include=dev && npm run build`
- Pre-deploy command: `npm run migration:run`
- Start command: `npm run start:prod`
- Health check path: `/health/ready`

The process binds to `0.0.0.0` and Render's `PORT`. `/health` is process
liveness only. `/health/ready` executes `SELECT 1` and returns 503 without
database details when PostgreSQL is unavailable. Use readiness for the Render
health check so new instances receive traffic only after the database is
reachable.

Required production variables:

- `NODE_ENV=production`
- `PORT` (provided by Render)
- `DATABASE_URL`
- `DATABASE_SSL_CA_BASE64`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_URL`
- `TYPEORM_SYNC=false`
- `TYPEORM_RUN_MIGRATIONS=false`

Keep DCLA-06 disabled during the initial schema/application deployment:

- omit `NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION`
- omit `OVERDUE_CHARGE_POLICY_ACTIVATION_DATE`
- set `LOAN_CHARGE_SCHEDULER_ENABLED=false`

After schema and application verification, controlled enrollment requires both:

- `NEW_LOAN_OVERDUE_CHARGE_POLICY_VERSION=DCLA_2026_V1`
- `OVERDUE_CHARGE_POLICY_ACTIVATION_DATE=YYYY-MM-DD`

Only loans released on or after that date are stamped as eligible; existing rows
remain `NULL` and are never backfilled. Keep the scheduler disabled during the
first enrolled-loan smoke test. Then run the manager manual sweep and, after
reconciliation is verified, set `LOAN_CHARGE_SCHEDULER_ENABLED=true`. Optional
worker tuning uses `LOAN_CHARGE_POLL_INTERVAL_MS` (default one hour) and
`LOAN_CHARGE_BATCH_SIZE` (default 100). Multiple instances coordinate sweeps
through a PostgreSQL advisory lock, while deterministic ledger keys prevent
duplicate accruals.

`CLIENT_URL` is a comma-separated exact-origin allow-list. Every production
origin must use HTTPS and contain no path, query, or credentials. Keep access
and refresh JWT secrets distinct.

SMS is optional. Keep `SMS_ENABLED=false` and `SMS_WORKER_ENABLED=false` when
it is not configured. Enabling SMS requires `UNISMS_API_SECRET` and
`UNISMS_SENDER_ID`; configure `UNISMS_WEBHOOK_SECRET` before enabling the
UniSMS webhook integration.

## PostgreSQL TLS

Production requires certificate verification. Download the database CA
certificate from the Supabase Dashboard SSL Configuration panel, encode the
PEM file as base64, and store the result in Render's secret
`DATABASE_SSL_CA_BASE64` variable. Never commit the certificate value or the
database URL. Startup and migration discovery fail if the production CA is
missing or malformed. Keep SSL query parameters out of `DATABASE_URL`; the
application rejects them in production so the URL parser cannot override the
verified-CA settings.

The configured Supabase shared session pooler on port 5432 is appropriate for
a persistent backend. Preserve the provider-issued hostname in
`DATABASE_URL`; certificate hostname verification depends on it.

## Migrations

Render's single pre-deploy command runs compiled pending TypeORM migrations
before new instances start. A migration failure blocks the deployment.
Application startup never runs migrations and production always forces
`synchronize: false`; setting either production TypeORM flag to `true` fails
startup.

Do not put the savings opening-balance cutover in build, pre-deploy, or start
commands. It is a separately reviewed maintenance operation.

## Savings Ledger Cutover

Use a maintenance window for the future savings cutover:

1. Enable Render maintenance mode and prevent all user/API financial traffic.
2. Stop or scale down normal web instances and confirm no worker can mutate
   financial state. Retain one controlled shell/job path for the commands.
3. Take and verify a database backup.
4. Deploy migrations and code while writes remain paused.
5. Run `npm run savings:ledger-cutover -- --dry-run` from the deployed
   `server` directory.
6. Review every blocker and invariant before applying anything.
7. Run `npm run savings:ledger-cutover -- --apply --confirm=savings-opening-v1`
   only after explicit approval.
8. Verify balances and ledger state, then restore instances, disable
   maintenance mode, and resume traffic.

The apply command remains explicit and is never part of deployment automation.

## Proxy and Rate Limiting

In production Express trusts exactly one proxy hop, the Render load balancer,
so `request.ip` resolves the forwarded client address used by login throttling.
Do not expose the service outside Render's ingress while this setting is in
use.

Login throttling is process-local. Its counters are not shared between Render
instances and reset when an instance restarts. Keep it enabled, and supplement
it with a Render/edge/WAF rate-limit rule for `POST /api/auth/login` before
scaling to multiple instances. No platform rule is configured by this
repository.

## HTTP Security

Helmet remains enabled for standard API security headers. CORS allows only the
configured frontend origins; requests without an `Origin` header remain
available to non-browser clients. NestJS production error responses do not
include stack traces by default, and health responses never return database or
environment details.
