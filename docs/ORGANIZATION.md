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

## Mirror `frontend/` → [notomer/proxkey-website](https://github.com/notomer/proxkey-website)

From the monorepo root, copy `frontend/` into the sibling checkout used as the standalone website repo (default `../proxkey-website`). `rsync --delete` stays aligned with the monorepo while **excluding** the mirror’s `.git`, `node_modules`, build outputs, Supabase CLI temp files, and local `.env` files.

```bash
pnpm run website:sync:dry    # preview
pnpm run website:sync

PROXKEY_WEBSITE_DIR=~/src/proxkey-website pnpm run website:sync
```

Then commit and push in the website repo as usual.
