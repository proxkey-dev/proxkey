# ProxKey

[![CI](https://github.com/proxkey-dev/proxkey/actions/workflows/ci.yml/badge.svg)](https://github.com/proxkey-dev/proxkey/actions/workflows/ci.yml)

Monorepo for [ProxKey](https://proxkey.dev): engineering triage—ingest incidents, CI failures, and logs; produce structured packets with severity, evidence, and next actions.

## Structure

```text
proxkey/
├── frontend/          # Vite + React app, dashboard, product docs; Fastify API in frontend/server/
├── apps/
│   ├── api/           # Platform HTTP API (Fastify)
│   └── worker/        # Background jobs (BullMQ)
├── packages/
│   ├── config/        # Shared TS config
│   ├── db/            # Prisma schema & client (@proxkey/db)
│   ├── types/         # Shared types
│   └── proxkey-js/    # Public SDK (@proxkey/proxkey-js)
├── cli/               # `proxkey` npm CLI
├── infra/             # Dockerfiles, nginx for SPA image
├── docs/              # Org/repo split map and shared notes
└── packaging/         # Homebrew formulae
```

Split targets for the [proxkey-dev](https://github.com/proxkey-dev) org are documented in [docs/ORGANIZATION.md](docs/ORGANIZATION.md). Adjust the CI badge above if the GitHub repo slug is not `proxkey-dev/proxkey`.

## Requirements

- **Node.js** 20+ ([`.nvmrc`](.nvmrc))
- **pnpm** 9 (`packageManager` in [`package.json`](package.json))

## Quick start (platform)

```bash
pnpm install
pnpm run build          # packages + api + worker
pnpm run lint && pnpm run typecheck && pnpm run test
pnpm run dev:api        # API dev server
```

Docker (Postgres + Redis + API + worker) from repo root:

```bash
cp .env.example .env    # if present; adjust DATABASE_URL / secrets as needed
docker compose up -d
```

## Frontend + dashboard API

The marketing shell and authenticated dashboard live under `frontend/`. See [frontend/README.md](frontend/README.md) for Auth0, Prisma, Railway/Vercel-style deployment, and npm scripts.

From monorepo root you can run the production wiring helper:

```bash
pnpm run frontend:cli-setup           # Railway + Auth0 (see script for modes)
pnpm run frontend:cli-setup:railway
pnpm run frontend:cli-setup:auth0
```

Mirror split repos from [`scripts/repos-sync.config.json`](scripts/repos-sync.config.json) (website + optional CLI checkout):

```bash
pnpm run repos:sync:dry
pnpm run repos:sync
pnpm run repos:sync:push            # commit + push each mirror (optional)

pnpm run website:sync:dry           # only proxkey-website
pnpm run website:sync
```

Details: [docs/ORGANIZATION.md](docs/ORGANIZATION.md).

## CLI & SDK

| Artifact | Path | Publish |
|----------|------|--------|
| CLI `proxkey` | [`cli/`](cli/README.md) | Tag `cli/v*` → [publish-cli workflow](.github/workflows/publish-cli.yml) |
| SDK `@proxkey/proxkey-js` | [`packages/proxkey-js`](packages/proxkey-js/) | npm from package directory |

## CI / CD

- **[CI](.github/workflows/ci.yml)** — platform (`pnpm`), full `frontend/` checks (with Postgres), CLI build/test.
- **[Deploy](.github/workflows/deploy.yml)** — build and push images to `ghcr.io/proxkey-dev/proxkey-{api,worker,web}` on pushes to `main` (optional SSH deploy when configured).

## Contributing / security

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
