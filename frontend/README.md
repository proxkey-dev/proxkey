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

## Auth0 setup

The active ProxKey shell uses Auth0 for web identity and keeps ProxKey’s own user, org, role, plan, API key, and triage state in Postgres.

Frontend env:

- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_AUTH0_CALLBACK_URL`

Backend env:

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_CLI_CLIENT_ID`
- `AUTH0_ISSUER_BASE_URL`

Runtime flow:

- Auth0 Universal Login signs the browser in with Authorization Code + PKCE.
- The frontend fetches an Auth0 access token for `VITE_AUTH0_AUDIENCE`.
- The frontend calls `POST /api/auth/bootstrap` with `Authorization: Bearer <access_token>`.
- The Fastify backend validates the RS256 JWT via Auth0 JWKS, links or creates the local ProxKey user/org, and enforces product authorization from Postgres.
- `proxkey login` detects Auth0 mode from `GET /api/auth/config` and uses the Auth0 device authorization flow when `AUTH0_CLI_CLIENT_ID` is configured.
- CLI sessions store the Auth0 access token and refresh token locally so the CLI can refresh without a browser round-trip when Auth0 returns `offline_access`.
- CI should keep using ProxKey-issued API keys via `proxkey auth set-key` or `PROXKEY_API_KEY`.

The Auth0 Deploy CLI was installed user-globally with:

```bash
npm install -g auth0-deploy-cli --prefix /Users/omer/.npm-global
export PATH="/Users/omer/.npm-global/bin:$PATH"
```

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

- Browser auth uses Auth0 bearer tokens for the web app.
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
