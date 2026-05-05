# ProxKey Backend

ProxKey is implemented here as a secure, fault-contained modular monolith backend.

Priority order:

1. Security and tenant isolation
2. Authorization correctness
3. Fault containment and graceful failure
4. Speed to market
5. Performance

Stack:

- TypeScript
- Fastify
- PostgreSQL
- Prisma
- Zod
- Cookie-based auth with `httpOnly` session cookies
- Argon2id password hashing
- Pino via Fastify structured logging
- Helmet
- Global and triage-specific rate limiting
- Docker Compose for local Postgres
- Vitest

## What Is Implemented

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/bootstrap`
- `POST /api/auth/logout`
- `GET /api/auth/config`
- `GET /api/me`
- `POST /api/reports`
- `GET /api/reports`
- `GET /api/reports/:id`
- `POST /api/packets`
- `GET /api/packets`
- `GET /api/packets/:id`
- `GET /api/clusters`
- `GET /api/clusters/:id`
- `POST /api/packets/:id/export`
- `POST /api/packets/:id/feedback`
- `POST /api/triage/run`
- `POST /api/triage/generate`
- `GET /api/triage/:reportId`
- `PATCH /api/triage/:reportId`
- `POST /api/incident-attribution/rank`
- `POST /api/codebase/scan`
- `POST /api/cli/ingest`
- `GET /api/dashboard/inbox`
- `GET /api/dashboard/stats`
- `GET /api/integrations/catalog`
- `GET /api/integrations`
- `POST /api/integrations/connect`
- `DELETE /api/integrations/:provider`
- `GET /api/billing/plan`
- `GET /api/billing/usage`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `GET /api/employees`
- `POST /api/employees`
- `PATCH /api/employees/:id`
- `DELETE /api/employees/:id`
- `GET /api/api-keys`
- `POST /api/api-keys`
- `DELETE /api/api-keys/:id`
- `POST /api/leads`
- `POST /api/demo/triage`
- `GET /health`
- `GET /api/health`

Notes:

- Packets are backed by reports, triage results, packet clusters, export history, feedback history, artifacts, and audit logs.
- The triage pipeline normalizes source evidence, classifies issue type, scores severity, clusters duplicates, recommends ownership, and produces export-ready packet payloads.
- `POST /api/incident-attribution/rank` scores recent deploys against incident signals using graph distance, temporal correlation, and a probabilistic unknown bucket.
- `POST /api/packets/:id/export` prepares structured payloads for Markdown, JSON, GitHub, Jira, Linear, Slack, incident, and webhook targets. Provider OAuth and remote ticket creation are left for provider-specific follow-up work.
- GitHub, Jira, Linear, Slack, Email, Sentry, Datadog, PagerDuty, Splunk, and Webhook have metadata-only connection records.
- Billing, uploads, vector search, and real third-party export delivery are intentionally not implemented.

## Project Layout

```text
server
├── docker-compose.yml
├── prisma
│   ├── initdb
│   ├── schema.prisma
│   └── seed.ts
├── src
│   ├── index.ts
│   └── proxkey
│       ├── auth.ts
│       ├── config.ts
│       ├── queue.ts
│       ├── server.ts
│       ├── triage.ts
│       └── worker.ts
└── .env.example
```

## Setup

```bash
cd server
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:push
npm run db:seed
npm run dev
```

Server default:

- API: `http://localhost:4000`
- Postgres: `localhost:5433`

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run test
npm run prisma:generate
npm run prisma:push
npm run db:seed
```

## Environment Variables

Required:

- `DATABASE_URL`
- `CONTENT_ENCRYPTION_KEY`

Important:

- `CORS_ORIGINS`
- `SESSION_TTL_HOURS`
- `BODY_LIMIT_BYTES`
- `COOKIE_DOMAIN` when sharing cookies across subdomains
- `COOKIE_SAME_SITE` set to `none` when the frontend and backend are deployed on different sites
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `TRIAGE_RATE_LIMIT_MAX`
- `LLM_PROVIDER`
- `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` for OpenAI-compatible providers such as Groq
- `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL` for direct OpenAI configuration or legacy compatibility
- `REDACT_EMAILS`
- `REDACT_PHONES`

`CONTENT_ENCRYPTION_KEY` must be a base64 value that decodes to 32 bytes.

## Railway Deployment

This backend is set up to deploy cleanly to Railway as a dedicated backend service.

Important deployment shape:

- Frontend: `https://app.yourdomain.com`
- Backend: `https://api.yourdomain.com`
- Use HTTPS for both
- Keep frontend and backend on the same parent domain for cookie auth

Why this matters:

- The backend uses secure cookie auth.
- In production the session cookie is marked `Secure`.
- Cookies will work reliably when the frontend and backend are same-site subdomains.

### Railway Service Settings

For the backend service in Railway:

- Root Directory: `server`
- Optional config-as-code file path: `server/railway.toml`
- Healthcheck path: `/health`

This repo is a monorepo:

- repo root = React/Vite frontend
- `server/` = Fastify backend

If you do not set the Railway Root Directory to `server`, Railway will detect the frontend at the repo root, try to build that instead, and may run `npm ci` against the root lockfile rather than the backend service.

`railway.toml` configures:

- build command
- pre-deploy schema sync
- start command
- restart policy
- healthcheck

### Required Railway Variables

Set these in the backend service variables tab:

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=postgresql://...
CORS_ORIGINS=https://app.yourdomain.com
TRUST_PROXY=true
CONTENT_ENCRYPTION_KEY=REPLACE_WITH_BASE64_32_BYTE_KEY
SESSION_TTL_HOURS=168
BODY_LIMIT_BYTES=262144
COOKIE_DOMAIN=
COOKIE_SAME_SITE=lax
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
TRIAGE_RATE_LIMIT_MAX=5
LLM_PROVIDER=mock
REDACT_EMAILS=false
REDACT_PHONES=false
```

If using OpenAI remotely:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

Recommended Groq-first setup:

```env
LLM_PROVIDER=groq
AI_PROVIDER=groq
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=your_groq_api_key
AI_MODEL=llama-3.3-70b-versatile
```

The backend treats Groq as an OpenAI-compatible provider. If you later want to swap to another OpenAI-compatible platform such as Together, keep the same code path and change only `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`.

Generate `CONTENT_ENCRYPTION_KEY` locally:

```bash
openssl rand -base64 32
```

If your deployed frontend is on a different site from the backend, set:

```env
COOKIE_SAME_SITE=none
```

That keeps secure cookie auth working across cross-site `fetch(..., { credentials: 'include' })` requests.

### First Deploy

Recommended:

1. Create a Railway PostgreSQL service.
2. Attach or copy its `DATABASE_URL` into the backend service.
3. Deploy the backend service from this repo.
4. Add a custom backend domain such as `api.yourdomain.com`.
5. Point the frontend to that domain with `VITE_API_BASE_URL`.

Do not run the seed script in production unless you explicitly want demo users.

For a new production environment, create the first owner account through `POST /auth/register`.

### CLI Deployment With a Token

Railway's docs state:

- use `RAILWAY_TOKEN` for a Project Token
- use `RAILWAY_API_TOKEN` for an account/workspace token

Deploy the backend directory only:

```bash
export RAILWAY_TOKEN=YOUR_PROJECT_TOKEN
railway up --path-as-root /Users/omer/Local_Repo/proxkey/frontend/server
```

If the token value you pasted elsewhere was intended to be secret, rotate it before using it.

## Curl Examples

Register:

```bash
curl -i \
  -c cookies.txt \
  -X POST http://localhost:4000/auth/register \
  -H 'content-type: application/json' \
  -d '{
    "email":"owner@example.com",
    "password":"ChangeMe123!",
    "name":"Owner",
    "organizationName":"Acme Ops"
  }'
```

Login:

```bash
curl -i \
  -c cookies.txt \
  -b cookies.txt \
  -X POST http://localhost:4000/auth/login \
  -H 'content-type: application/json' \
  -d '{
    "email":"owner@example.com",
    "password":"ChangeMe123!"
  }'
```

The auth responses return `csrfToken`. Use that value for all mutating requests.

Create a report:

```bash
curl -i \
  -b cookies.txt \
  -X POST http://localhost:4000/reports \
  -H 'content-type: application/json' \
  -H 'x-csrf-token: REPLACE_WITH_CSRF_TOKEN' \
  -d '{
    "title":"Checkout timeout",
    "rawText":"Authorization: Bearer sk_live_secret checkout fails after submit",
    "sourceType":"INCIDENT",
    "metadata":{"channel":"support"}
  }'
```

List reports:

```bash
curl -i \
  -b cookies.txt \
  http://localhost:4000/reports
```

Run triage with idempotency protection:

```bash
curl -i \
  -b cookies.txt \
  -X POST http://localhost:4000/reports/REPORT_ID/triage \
  -H 'x-csrf-token: REPLACE_WITH_CSRF_TOKEN' \
  -H 'idempotency-key: checkout-timeout-001'
```

Run the standalone triage agent directly against raw text:

```bash
curl -i \
  -X POST http://localhost:4000/api/triage \
  -H 'content-type: application/json' \
  -d '{
    "input":"App freezes after login on iOS 18.4. Happens randomly after latest build. Customer says it started yesterday."
  }'
```

Expected response shape:

```json
{
  "ok": true,
  "result": {
    "summary": "Login flow intermittently freezes after authentication redirect.",
    "severity": "high",
    "component": "Authentication",
    "repro_steps": [
      "Open the app",
      "Enter valid credentials",
      "Tap login",
      "Wait for redirect",
      "Observe freeze"
    ],
    "missing_info": ["Device model", "OS version", "Build number", "Crash logs"],
    "suggested_owner": "Client Platform / Auth",
    "next_action": "Request sysdiagnose and compare against the last known healthy build.",
    "confidence": 0.82
  }
}
```

Read audit logs:

```bash
curl -i \
  -b cookies.txt \
  http://localhost:4000/audit-logs?page=1&pageSize=20
```

Use a different organization context:

```bash
curl -i \
  -b cookies.txt \
  -H 'x-organization-id: ORG_ID' \
  http://localhost:4000/organizations/current
```

## Testing

The test suite is built around `Fastify.inject` plus a real Postgres database.

Default test database:

- `postgresql://proxkey:proxkey@localhost:5433/proxkey_test?schema=public`

Run:

```bash
docker compose up -d
npm install
npm run prisma:generate
DATABASE_URL=postgresql://proxkey:proxkey@localhost:5433/proxkey_test?schema=public npm run prisma:push
DATABASE_URL=postgresql://proxkey:proxkey@localhost:5433/proxkey_test?schema=public npm run test
```

Covered test areas:

- registration
- login
- password hashing
- invalid login rejection
- report creation
- owner report access
- cross-tenant isolation
- viewer triage denial
- member triage success
- invalid payload rejection
- oversized payload rejection
- redaction
- invalid JSON retry handling
- failed LLM fallback to `FAILED`
- duplicate triage idempotency
- audit log creation

## Security Model

The backend treats cross-tenant leakage as the main early-stage risk.

Security rules enforced by design:

- User identity is derived only from the session cookie.
- Organization access is derived only from `OrganizationMember`.
- Org-scoped routes resolve organization context before service logic runs.
- Report and triage queries use `organizationId` in the database filter, not just `id`.
- Request body, params, and query are validated with Zod before service logic.
- Session cookies are `httpOnly`.
- Mutating cookie-authenticated routes require CSRF tokens.
- Passwords are hashed with Argon2id.
- Raw report text is encrypted at rest in the application layer.
- LLM input uses `redactedText`, not raw secrets.
- Logging redacts cookies, tokens, secrets, passwords, and report bodies.
- Audit log metadata is redacted before persistence.
- CORS is allowlist-based, not wildcard-based.
- Rate limiting is global, with a stricter triage limiter.

Role model:

- `OWNER`: full organization control, role management, deletion, audit access
- `ADMIN`: invites, report management, triage, audit access
- `MEMBER`: create reports, view org reports, run triage, edit own reports
- `VIEWER`: read-only

## Fault-Containment Model

The backend does not assume failures are rare or harmless. It forces failures into known states.

Key containment choices:

- Route handlers stay thin and pass into services.
- Centralized error classes control HTTP mapping and safe messages.
- Unexpected errors never return raw stack traces.
- Every request gets a request ID that is echoed in logs and error responses.
- Triage state transitions are explicit:
  - `SUBMITTED -> TRIAGING`
  - `TRIAGING -> TRIAGED`
  - `TRIAGING -> FAILED`
  - `TRIAGED -> EXPORTED`
- Invalid state transitions are rejected.
- LLM calls are wrapped behind a provider interface.
- Invalid model JSON is retried once with a correction prompt.
- If the LLM still fails, the report is forced to `FAILED`.
- Reports are never intentionally left in `TRIAGING`.
- Idempotency keys prevent duplicate triage result creation for repeated clicks.
- Sensitive multi-record operations use database transactions.
- Readiness checks verify database connectivity before reporting ready.

## Future Integrations

Clean placeholders exist for:

- OpenAI provider
- Anthropic provider placeholder
- mock LLM provider for tests
- placeholder export provider for Jira/Linear/GitHub-style handoff

The current export endpoint is intentionally safe-by-default until a real integration is added.
