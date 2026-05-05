#!/usr/bin/env bash
# Production wiring: Railway backend (frontend/server) + Auth0 SPA URLs (optional).
#
# Prerequisites:
#   railway login   OR   RAILWAY_TOKEN (project token) for non-interactive / CI
#   railway link from frontend/ (repo root for this app), NOT frontend/server — Railway service root_dir is "server"
#     Example: cd frontend && railway link -p <project-id> -s backend -e production
#
# Secrets: copy frontend/server/railway-secrets.example → frontend/server/.env.railway.local
#
# Usage (from monorepo root or frontend/):
#   npm run prod:cli-setup --prefix frontend
#   bash frontend/scripts/production-cli-setup.sh          # railway vars + deploy + auth0
#   bash frontend/scripts/production-cli-setup.sh railway   # railway only
#   bash frontend/scripts/production-cli-setup.sh auth0     # Auth0 SPA URLs only
#   DRY_RUN=1 bash frontend/scripts/production-cli-setup.sh railway
#
# Env overrides:
#   RAILWAY_TOKEN, RAILWAY_SERVICE, RAILWAY_ENVIRONMENT (production | staging | …)
#   AUTH0_TENANT (e.g. proxkey.us.auth0.com) → passed as auth0 --tenant

set -euo pipefail

WEBSITE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$WEBSITE_ROOT/server"

# Public defaults (match frontend/.env.production)
: "${PRODUCTION_MARKETING_ORIGIN:=https://proxkey.dev}"
: "${PRODUCTION_APP_ORIGIN:=https://app.proxkey.dev}"
: "${PRODUCTION_API_ORIGIN:=https://api.proxkey.dev}"
: "${AUTH0_DOMAIN:=proxkey.us.auth0.com}"
: "${AUTH0_AUDIENCE:=https://api.proxkey.dev}"
: "${AUTH0_SPA_CLIENT_ID:=YfIIMjNlzpDeoQUfqTTW1B9fq4r61J5f}"

# First CORS origin = GitHub OAuth redirect base (see server/src/proxkey/dashboard-api.ts)
: "${CORS_ALLOWED_ORIGINS:=${PRODUCTION_MARKETING_ORIGIN},https://www.proxkey.dev,${PRODUCTION_APP_ORIGIN}}"

DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Usage: production-cli-setup.sh [all|railway|auth0]

  all     Set Railway variables, deploy frontend/server, then update Auth0 SPA URLs (default)
  railway Set Railway variables for the API service and run railway up
  auth0   Update Auth0 SPA app callbacks, web origins, and logout URLs (auth0 CLI)

Env / files:
  Optional secrets file: frontend/server/.env.railway.local (auto-sourced if present)
  Railway vars: DASHBOARD_SESSION_SECRET auto-generated if unset. DATABASE_URL omitted → leaves Railway Postgres URL untouched.
  GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET optional until you create a GitHub OAuth app (callback …/github/callback).

  RAILWAY_TOKEN      Project token (CI); skips interactive railway login check when set
  RAILWAY_SERVICE    railway -s <name-or-id>
  RAILWAY_ENVIRONMENT railway -e <env>
  AUTH0_TENANT       auth0 --tenant <domain>
  DRY_RUN=1          Print actions only
EOF
}

load_secrets() {
  local f="$SERVER_DIR/.env.railway.local"
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    echo "Loaded $f"
  fi
}

require_railway() {
  if ! command -v railway &>/dev/null; then
    echo "Install Railway CLI: https://docs.railway.com/develop/cli" >&2
    exit 1
  fi
  if [[ -n "${RAILWAY_TOKEN:-}" ]]; then
    export RAILWAY_TOKEN
    return 0
  fi
  if ! railway whoami &>/dev/null; then
    echo "Run: railway login  (or set RAILWAY_TOKEN for a project deploy token)" >&2
    exit 1
  fi
}

ensure_dashboard_secret() {
  if [[ -z "${DASHBOARD_SESSION_SECRET:-}" ]]; then
    DASHBOARD_SESSION_SECRET="$(openssl rand -base64 32)"
    echo "Generated DASHBOARD_SESSION_SECRET (not printed). Set DASHBOARD_SESSION_SECRET yourself to pin it across runs."
  fi
}

railway_cmd() {
  local -a args=()
  [[ -n "${RAILWAY_SERVICE:-}" ]] && args+=(-s "$RAILWAY_SERVICE")
  [[ -n "${RAILWAY_ENVIRONMENT:-}" ]] && args+=(-e "$RAILWAY_ENVIRONMENT")
  if ((${#args[@]})); then
    railway "${args[@]}" "$@"
  else
    railway "$@"
  fi
}

auth0_cmd() {
  if [[ -n "${AUTH0_TENANT:-}" ]]; then
    auth0 --tenant "$AUTH0_TENANT" "$@"
  else
    auth0 "$@"
  fi
}

do_railway_variables() {
  if [[ "$DRY_RUN" != "1" ]]; then
    require_railway
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY_RUN: would cd $WEBSITE_ROOT && railway …"
    echo "DRY_RUN: railway variable set … (stdin) DASHBOARD_SESSION_SECRET, JWT_SECRET; optional DATABASE_URL, GITHUB_*"
    echo "DRY_RUN: railway variable set --skip-deploys NODE_ENV=production HOST=0.0.0.0 …"
    return
  fi

  ensure_dashboard_secret
  local jwt="${JWT_SECRET:-$DASHBOARD_SESSION_SECRET}"
  local issuer="${AUTH0_ISSUER_BASE_URL:-https://${AUTH0_DOMAIN}/}"

  cd "$WEBSITE_ROOT"
  echo "Setting Railway variables (secrets via stdin where needed)…"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo -n "$DATABASE_URL" | railway_cmd variable set DATABASE_URL --stdin --skip-deploys
  else
    echo "Leaving DATABASE_URL unchanged (not set in env / .env.railway.local)."
  fi
  echo -n "$DASHBOARD_SESSION_SECRET" | railway_cmd variable set DASHBOARD_SESSION_SECRET --stdin --skip-deploys
  echo -n "$jwt" | railway_cmd variable set JWT_SECRET --stdin --skip-deploys
  if [[ -n "${GITHUB_CLIENT_ID:-}" && -n "${GITHUB_CLIENT_SECRET:-}" ]]; then
    echo -n "$GITHUB_CLIENT_SECRET" | railway_cmd variable set GITHUB_CLIENT_SECRET --stdin --skip-deploys
  else
    echo "Skipping GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (unset). Connect GitHub will return 503 until you add them in Railway."
  fi

  local github_pair=( )
  if [[ -n "${GITHUB_CLIENT_ID:-}" ]]; then
    github_pair=("GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID")
  fi

  railway_cmd variable set --skip-deploys \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    "CORS_ALLOWED_ORIGINS=$CORS_ALLOWED_ORIGINS" \
    "APP_BASE_URL=$PRODUCTION_MARKETING_ORIGIN" \
    "APP_URL=$PRODUCTION_MARKETING_ORIGIN" \
    "API_BASE_URL=$PRODUCTION_API_ORIGIN" \
    "AUTH0_DOMAIN=$AUTH0_DOMAIN" \
    "AUTH0_AUDIENCE=$AUTH0_AUDIENCE" \
    "AUTH0_ISSUER_BASE_URL=$issuer" \
    "AUTH0_CLIENT_ID=$AUTH0_SPA_CLIENT_ID" \
    "${github_pair[@]}"
}

do_railway_up() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY_RUN: would run: railway up (from $WEBSITE_ROOT — Railway root_dir server)"
    return
  fi
  require_railway
  cd "$WEBSITE_ROOT"
  echo "Deploying from $WEBSITE_ROOT (server/railway.toml; Docker build from server/)…"
  railway_cmd up
}

do_auth0() {
  if ! command -v auth0 &>/dev/null; then
    echo "auth0 CLI not found; install: brew install auth0/tap/auth0-cli" >&2
    exit 1
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    local tenant_note=""
    [[ -n "${AUTH0_TENANT:-}" ]] && tenant_note="auth0 --tenant ${AUTH0_TENANT} "
    echo "DRY_RUN: ${tenant_note}apps update $AUTH0_SPA_CLIENT_ID --callbacks … --origins … --logout-urls …"
    return
  fi
  if ! auth0_cmd tenants list &>/dev/null; then
    echo "Run: auth0 login  (use AUTH0_TENANT if you use multiple tenants)" >&2
    exit 1
  fi

  local callbacks="${PRODUCTION_MARKETING_ORIGIN}/callback,${PRODUCTION_APP_ORIGIN}/callback,http://localhost:3000/callback,http://localhost:5173/callback"
  local origins="${PRODUCTION_MARKETING_ORIGIN},https://www.proxkey.dev,${PRODUCTION_APP_ORIGIN},http://localhost:3000,http://localhost:5173"
  local logouts="${PRODUCTION_MARKETING_ORIGIN},${PRODUCTION_APP_ORIGIN},https://www.proxkey.dev,http://localhost:3000,http://localhost:5173"

  echo "Updating Auth0 SPA app $AUTH0_SPA_CLIENT_ID (callbacks, origins, web origins, logout URLs)…"
  auth0_cmd apps update "$AUTH0_SPA_CLIENT_ID" \
    --callbacks "$callbacks" \
    --origins "$origins" \
    --web-origins "$origins" \
    --logout-urls "$logouts"
}

print_post() {
  cat <<EOF

Next steps (manual):
  1. GitHub → Developer settings → OAuth Apps: create an app; callback URL
     ${PRODUCTION_MARKETING_ORIGIN}/github/callback — then set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET on the Railway service.
  2. Prisma: production DB predates migrate history (P3005). Baselining: https://pris.ly/d/migrate-baseline — or keep deploy without preDeploy migrate (current railway.toml).
  3. Railway → API service → Networking: attach custom domain ${PRODUCTION_API_ORIGIN#https://}
  4. Vercel/host: build the SPA from frontend/ with VITE_API_BASE_URL=${PRODUCTION_API_ORIGIN} (see frontend/.env.production)
  5. Smoke: curl -sI ${PRODUCTION_API_ORIGIN}/api/auth/github | head -1   (expect 302 once GitHub OAuth is set, or 503 if unset — not 404)
EOF
}

main() {
  local mode="${1:-all}"
  case "$mode" in
    -h | --help | help) usage; exit 0 ;;
  esac

  load_secrets

  case "$mode" in
    all)
      do_railway_variables
      do_railway_up
      do_auth0
      print_post
      ;;
    railway)
      do_railway_variables
      do_railway_up
      print_post
      ;;
    auth0)
      do_auth0
      print_post
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
