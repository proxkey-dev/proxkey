# Contributing

## Repository layout

This is a **pnpm workspace** for the platform (`apps/*`, `packages/*`) plus standalone npm trees under `frontend/` and `cli/`. CI runs checks for all of these; keep lockfiles committed (`pnpm-lock.yaml`, `frontend/package-lock.json`, `frontend/server/package-lock.json`, `cli/package-lock.json`).

## Before you open a PR

1. Install dependencies: `pnpm install` at the repo root.
2. Run platform checks: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
3. For UI or dashboard API changes, run the checks under `frontend/` (see `frontend/package.json` → `ci:check`) or rely on CI.

## Monorepo Git

Use a **single** Git repository at the workspace root. A nested `.git` inside `frontend/` breaks clones (Git treats it as an embedded repository). This layout assumes one remote for the full tree unless you intentionally split repos per [docs/ORGANIZATION.md](docs/ORGANIZATION.md).

## Style

Match existing formatting (Prettier where configured, ESLint rules per package). Prefer focused PRs with a clear description of behavior changes.
