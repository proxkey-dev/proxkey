# ProxKey

ProxKey is an AI engineering triage platform. It ingests messy bug reports, CI failures, logs, QA notes, and support escalations, then turns them into engineering-ready triage packets with severity, evidence, repro steps, missing information, owner suggestions, and next actions.

The core product loop in this repo is:

`signup -> workspace -> onboarding -> create packet -> AI result -> dashboard`

## Repo layout

- `src/`: active Vite/React product shell
  The current route surface lives under `src/pages/proxkey/`.
- `public/`: static assets shipped by the Vite app
- `server/`: Fastify + Prisma dashboard/API backend (split into a dedicated Backend repo when ready)
- `workers/`: Cloudflare demo workers kept out of the frontend source tree
- `docs/`: setup guides, deployment runbooks, and archived implementation notes
- `supabase/`: migrations and SQL helpers

Related repositories under [proxkey-dev](https://github.com/proxkey-dev): [Frontend](https://github.com/proxkey-dev/Frontend) (this tree), Backend (`apps/api`, `packages/*`, `infra/` in the platform monorepo), CLI (`cli/`), SDK (`packages/proxkey-js`). If you have the full monorepo checked out, see `docs/ORGANIZATION.md` at its root for the split map.

## Local setup

1. Install frontend dependencies:

```bash
cd /Users/omer/Local_Repo/proxkey/frontend
npm install
```

2. Install backend dependencies:

```bash
cd /Users/omer/Local_Repo/proxkey/frontend/server
npm install
```

3. Create env files:

```bash
cp /Users/omer/Local_Repo/proxkey/frontend/.env.example /Users/omer/Local_Repo/proxkey/frontend/.env
cp /Users/omer/Local_Repo/proxkey/frontend/server/.env.example /Users/omer/Local_Repo/proxkey/frontend/server/.env
```

4. Generate Prisma client and apply schema:

```bash
cd /Users/omer/Local_Repo/proxkey/frontend/server
npm run prisma:generate
npm run prisma:push
```

5. Start the backend:

```bash
cd /Users/omer/Local_Repo/proxkey/frontend/server
npm run dev
```

6. Start the frontend:

```bash
cd /Users/omer/Local_Repo/proxkey/frontend
npm run dev
```

## Authentication

The dashboard supports **Sign in with GitHub** (session cookie via `GET /api/auth/github`), **email/password** registration and login against the Fastify API (`/api/auth/register`, `/api/auth/login`), and **API keys** for automation. User, org, role, and plan data live in Postgres.

Frontend env: `VITE_API_BASE_URL` must point at the backend.

Backend: configure `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` for the GitHub OAuth flow; set `DASHBOARD_SESSION_SECRET` (or `JWT_SECRET`) in production.

CLI: `proxkey login` prompts for email and password against `/api/auth/login`. Use `proxkey auth set-key` or `PROXKEY_API_KEY` for non-interactive API access.

## Key scripts

Frontend:

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run ci:check`

Backend:

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run db:seed`

## CI

GitHub Actions runs production checks on pull requests and pushes to `main`: deterministic npm
installs, env-example validation, secret-file hygiene, frontend and backend typechecks, ESLint,
Prettier, backend tests, frontend/backend builds, production dependency audits, and pull request
dependency review.

Recommended branch protection for `main`:

- Require the `Production Checks` and `Dependency Review` status checks.
- Require pull request review before merge.
- Require branches to be up to date before merge.
- Block force pushes and branch deletion.

CLI:

- `npm run build`
- `npm run dev`

## Auth and billing model

- Browser sessions use GitHub OAuth or email/password tokens issued by the API.
- The frontend no longer persists browser session tokens in `localStorage`.
- API keys are hashed server-side and shown once at creation time.
- Free and Founder plans hard-stop at the monthly packet cap.
- Team and Growth overages are controlled by `ENABLE_OVERAGES=true`.
- If Stripe is not configured, billing endpoints return `billing_not_configured` and the product stays on the current plan.

## CLI quickstart

Published CLI:

```bash
npm install -g proxkey
proxkey config set api-base-url https://api.proxkey.dev
proxkey login
proxkey triage --file ./logs/build.log
```

Headless or CI auth:

```bash
proxkey auth create-key ci-bot --scope packets:write --scope packets:read
proxkey auth set-key pk_live_your_key_here
```

Local CLI development (from the monorepo root; use your clone path):

```bash
cd /Users/omer/Local_Repo/proxkey/cli
npm install
npm run build
node ./dist/index.js help
node ./dist/index.js config set api-base-url http://localhost:4000
node ./dist/index.js login
node ./dist/index.js triage --file ./logs/build.log
```

## Deployment

Launch instructions, domain setup, CORS/cookie guidance, Railway/Vercel steps, and the smoke test checklist live in:

- [docs/deployment/LAUNCH_DEPLOYMENT.md](/Users/omer/Local_Repo/proxkey/frontend/docs/deployment/LAUNCH_DEPLOYMENT.md)

Additional repo notes:

- Setup guides live in [docs/setup](/Users/omer/Local_Repo/proxkey/frontend/docs/setup).
- Demo worker notes live in [docs/workers](/Users/omer/Local_Repo/proxkey/frontend/docs/workers).
- Historical design and feature experiments live in [docs/archive](/Users/omer/Local_Repo/proxkey/frontend/docs/archive).
