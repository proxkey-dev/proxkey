# ProxKey organization layout

Use **one Git remote** for this full tree when developing here; nested `.git` directories under `frontend/` break monorepo clones. Optional splits below describe how code maps to separate GitHub repos under [proxkey-dev](https://github.com/proxkey-dev).

Source currently lives in one workspace; mirror it into [proxkey-dev](https://github.com/proxkey-dev) repositories as follows.

| Concern | GitHub repo (target) | Paths in this workspace |
| --- | --- | --- |
| **Website (split mirror)** | [notomer/proxkey-website](https://github.com/notomer/proxkey-website) | Same sources as `frontend/`, maintained as a standalone repo (personal account). Canonical monorepo: [proxkey-dev/proxkey](https://github.com/proxkey-dev/proxkey). |
| **Frontend** | [proxkey-dev/Frontend](https://github.com/proxkey-dev/Frontend) | `frontend/` in monorepo — Vite/React app, `public/`, demo `workers/`, `frontend/docs/`. |
| **Backend (core API)** | e.g. `proxkey-dev/Backend` or `Platform` | `apps/api`, `apps/worker`, `packages/*`, `infra/` Dockerfiles used by the pnpm build. |
| **Dashboard API** (today) | Same as Backend or a split service repo | `frontend/server/` — Fastify + Prisma app deployed beside the marketing/dashboard UI. |
| **CLI** | e.g. [proxkey-dev/CLI](https://github.com/proxkey-dev/CLI) | `cli/` — npm package name `proxkey`. Publish workflow: `.github/workflows/publish-cli.yml`. Tag convention: `cli/v*`. |
| **TypeScript SDK** | e.g. `proxkey-dev/proxkey-js` | `packages/proxkey-js` (`@proxkey/proxkey-js`). |
| **Docs** | Same as Frontend or a dedicated Docs repo | Runbooks and setup: `frontend/docs/`. Monorepo-wide notes: `docs/` (this file). |
| **Packaging** | CLI or release repo | `packaging/homebrew/`. |

## Removed / consolidated

- **`mvp/`** — Python prototype CLI; superseded by `cli/`.
- **`apps/web`** — Empty Vite stub; production SPA is `frontend/`.
- **`website/cli`** — Duplicate CLI; canonical implementation is `cli/`.
- **`frontend/packages/proxkey-js`** — Duplicate SDK; use `packages/proxkey-js`.
- **Root `supabase/.temp`** — Stale CLI cache only.

## Publishing the CLI

From the monorepo root (after pointing `cli/package.json` `repository` at the CLI repo):

```bash
cd cli && npm ci && npm run build && npm publish --access public
```

Or push tag `cli/v0.x.x` on `main` so GitHub Actions runs `publish-cli.yml`.

## Mirror repos (split checkouts)

Mirrors are defined in [`scripts/repos-sync.config.json`](../scripts/repos-sync.config.json). Defaults:

| Id | Source | Destination (default) | Remote |
| --- | --- | --- | --- |
| `proxkey-website` | `frontend/` | `../proxkey-website` (`PROXKEY_WEBSITE_DIR`) | [notomer/proxkey-website](https://github.com/notomer/proxkey-website) |
| `proxkey-cli` | `cli/` | `../proxkey-cli` (`PROXKEY_CLI_DIR`) | Optional sibling clone; **skipped** if the folder does not exist |

From monorepo root:

```bash
pnpm run repos:sync:dry          # preview all mirrors
pnpm run repos:sync              # rsync all (CLI mirror skipped until ../proxkey-cli exists)

pnpm run repos:sync:push         # sync then git commit + push each mirror (needs clean working tree)

pnpm run website:sync             # only proxkey-website
pnpm run website:sync:push
```

`rsync --delete` keeps the mirror aligned with the monorepo. Protected on the receiver: `.git/`, dependency dirs, build outputs, Supabase CLI temp, local `.env` files (see presets in `scripts/sync-repos.mjs`).

Commit message for `--push`:

```bash
SYNC_COMMIT_MESSAGE="sync: your note" pnpm run repos:sync:push
```
