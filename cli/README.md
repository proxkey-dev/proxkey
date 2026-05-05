# ProxKey CLI

ProxKey CLI is the command-line interface for sending support issues, CI failures, QA notes, logs, and incident context to the ProxKey backend for automated engineering triage.

It is built for engineering teams that want a consistent way to submit raw operational context from local machines, internal workflows, and CI/CD pipelines. ProxKey CLI supports interactive login, API key authentication, backend configuration, report export, and automation-friendly analysis commands.

## What It Does

With ProxKey CLI, you can:

- connect to a ProxKey backend
- authenticate as a user or service account
- submit logs and issue context for triage
- analyze CI and incident-related files
- export generated reports in portable formats
- manage API keys for bots, CI agents, and internal tooling

Typical use cases include:

- sending a failed build log to ProxKey from a local machine
- attaching incident notes to a triage request
- analyzing CI output in a GitHub Actions or other pipeline job
- exporting triage output as Markdown for tickets, docs, or follow-up communication
- creating scoped API keys for automation

## Install

Install globally with npm:

```bash
npm install -g proxkey
```

You can also install it with other package managers:

```bash
pnpm add -g proxkey
yarn global add proxkey
bun add -g proxkey
```

After installation, verify the CLI is available:

```bash
proxkey version
```

You can also inspect the available commands at any time:

```bash
proxkey help
```

### Run Without Installing

Use `npx` when you want a one-off command without installing the CLI globally:

```bash
npx proxkey@latest help
npx proxkey@latest version
```

If you want to call the installed binary name explicitly:

```bash
npx --package proxkey proxkey help
```

### Homebrew

After the Homebrew tap has been published, install the CLI with:

```bash
brew install proxkey
```

For local formula testing from this repository:

```bash
npm run build --prefix cli
node scripts/generate-homebrew-formula.mjs --local
brew tap-new yourname/proxkey-local --no-git
cp packaging/homebrew/proxkey-local.rb "$(brew --repository yourname/proxkey-local)/Formula/proxkey-local.rb"
brew install yourname/proxkey-local/proxkey-local
```

## Quick Start

A typical setup flow looks like this:

1. Point the CLI at your backend

Set the backend URL once:

```bash
proxkey config set api-base-url https://api.proxkey.dev
```

This stores your configuration in:

```text
~/.proxkey/auth.json
```

You usually only need to do this once per machine or environment.

2. Authenticate

For interactive use:

```bash
proxkey login
```

For headless environments such as CI:

```bash
proxkey auth set-key pk_live_your_key_here
```

3. Confirm your session

```bash
proxkey whoami
proxkey status
```

4. Ingest logs and analyze the incident

```bash
proxkey ingest --source github-actions --file ./logs/build.log --service api
proxkey incident analyze --ingest latest
```

You can still use the legacy one-shot analysis alias:

```bash
proxkey ci analyze --file ./logs/incident.txt --json
```

## CLI UX Design

ProxKey is designed as a compact incident co-pilot for engineers working in terminals and CI logs. The CLI should return the smallest useful answer first: what happened, how confident ProxKey is, why it thinks that, and what to do next.

Primary commands:

```text
proxkey ingest
proxkey incident analyze
proxkey status
```

Supporting commands:

```text
proxkey login
proxkey auth set-key <key>
proxkey config set api-base-url <url>
proxkey export --format markdown <report-id>
```

### Command Structure

```bash
# Ingest a CI/CD log and store a local redacted record.
proxkey ingest --source github-actions --file ./logs/build.log --service api --env production

# Pipe logs directly from another tool.
npm test 2>&1 | proxkey ingest --source generic --service web

# Analyze the latest ingested log.
proxkey incident analyze --ingest latest

# Analyze a specific ingest.
proxkey incident analyze --ingest ing_20260501143012_a13f9c

# Analyze an incident note or raw log without saving an ingest first.
proxkey incident analyze --file ./incident.md --service checkout --env production

# Machine-readable output for automation.
proxkey ingest --file ./logs/build.log --json
proxkey incident analyze --ingest latest --json

# Health and local workspace state.
proxkey status
```

`proxkey ci analyze --file <path>` is kept as an alias for `proxkey incident analyze --file <path>` so existing CI scripts continue to work.

### Sample Output: Ingest

```text
$ proxkey ingest --source github-actions --file ./logs/build.log --service api --env production
proxkey ingest
id          ing_20260501143012_a13f9c
source      github-actions
service     api
env         production
result      failed
confidence  88%
lines       1842
stored      .proxkey/ingests/ing_20260501143012_a13f9c.json

api github-actions failed; strongest signal is database failure in Database.

Signals
  database failure    12  L388  PrismaClientInitializationError: P1001 cannot reach database server
  timeout              3  L411  timed out waiting for migration lock
  deploy failure       2  L512  health check failed after deploy

Reasoning
  - The log contains a non-zero process exit marker.
  - database failure is the highest-weighted signal with 12 matches.
  - Multiple signal families matched: database, timeout, deploy.

Next
  proxkey incident analyze --ingest ing_20260501143012_a13f9c
```

### Sample Output: Incident Analysis

```text
$ proxkey incident analyze --ingest latest
proxkey incident
severity    SEV-2
component   Database
confidence  92%
ingest      ing_20260501143012_a13f9c

SEV-2 Database: Database connectivity, migration, or query failure is blocking the run.

Likely cause
  Database connectivity, migration, or query failure is blocking the run.

Impact
  Production impact is plausible and should be treated as active until disproven.

Evidence
  L388  PrismaClientInitializationError: P1001 cannot reach database server
  L411  timed out waiting for migration lock
  L512  health check failed after deploy

Reasoning
  - The log contains a non-zero process exit marker.
  - database failure is the highest-weighted signal with 12 matches.
  - Multiple signal families matched: database, timeout, deploy.
  - Analysis is linked to ingest ing_20260501143012_a13f9c from github-actions.

Next
  1. Check database availability and connection limits for the affected environment.
  2. Verify migration state, locks, and recent schema changes.
  3. Rerun the failed job after confirming the database dependency is healthy.

Missing
  - last successful run
```

### Sample Output: Status

```text
$ proxkey status
proxkey status
api          https://api.proxkey.dev (operational)
auth         api key stored
repo config  .proxkey/config.json
ingests      4 saved, latest ing_20260501143012_a13f9c failed 88%
database     connected
ai           ready
```

If the API is down or not configured, `proxkey status` still reports useful local state:

```text
proxkey status
api          http://localhost:4000 (unreachable)
auth         not logged in
repo config  not configured
ingests      1 saved, latest ing_20260501143012_a13f9c failed 88%
```

### Implementation Notes

The CLI is implemented in Node/TypeScript in `src/index.ts`. The requested commands work locally without requiring a ProxKey backend:

- `ingest` reads logs from `--file`, stdin, or inline text, redacts common secrets, extracts failure signals, computes confidence, and stores bounded records in `.proxkey/ingests`.
- `incident analyze` reads a saved ingest or raw file, derives severity, likely cause, impact, evidence, reasoning, missing information, and next actions.
- `status` checks API reachability when available and always shows auth, repo config, and recent local ingests.

## Backend Configuration

The CLI can be pointed at any compatible ProxKey backend.

Set a default backend URL:

```bash
proxkey config set api-base-url https://api.proxkey.dev
```

That setting is persisted locally and reused for future commands.

You can also override the backend URL for an individual command:

```bash
proxkey login --api-base-url https://api.proxkey.dev
```

This is useful when:

- testing against staging or local environments
- switching between production and development backends
- running commands in temporary or isolated automation workflows

## Authentication

ProxKey CLI supports both interactive login and API key-based authentication.

### Interactive Login

For local developer use, run:

```bash
proxkey login
```

If the backend exposes Auth0 device login through `GET /api/auth/config`, `proxkey login` will automatically use that flow.

### API Key Authentication

For CI, bots, or other non-interactive environments:

```bash
proxkey auth set-key pk_live_your_key_here
```

This lets your automation submit packets and run analysis commands without requiring an interactive session.

### Check Identity And Auth State

To inspect the current session:

```bash
proxkey whoami
proxkey status
```

These commands are useful for troubleshooting local auth problems and confirming which user or key is active.

## Common Commands

Below are some common commands you would want users to discover quickly.

### General

```bash
proxkey help
proxkey version
proxkey status
proxkey whoami
```

### Triage And Analysis

```bash
proxkey ingest --source github-actions --file ./logs/build.log --service api
proxkey incident analyze --ingest latest
proxkey incident analyze --file ./logs/incident.txt --json
```

### Exporting Reports

```bash
proxkey export --format markdown <report-id>
```

### API Key Management

```bash
proxkey auth create-key ci-bot --scope packets:write --scope packets:read
proxkey auth list-keys
proxkey auth revoke-key <api-key-id>
```

## Example Workflows

### Analyze A Failed Build Log Locally

```bash
proxkey ingest --file ./logs/build.log --service api
proxkey incident analyze --ingest latest
```

Use this when a local build, test run, or script has failed and you want ProxKey to process the raw output.

### Analyze CI Output In JSON Format

```bash
proxkey ci analyze --file ./logs/incident.txt --json
```

This is useful for automation, structured downstream processing, or piping results into another internal tool.

### Export A Report To Markdown

```bash
proxkey export --format markdown <report-id>
```

This is useful when you want to:

- paste the output into an issue tracker
- attach it to an incident document
- share triage findings with teammates
- store analysis results in internal documentation

### Create A Dedicated CI Key

```bash
proxkey auth create-key ci-bot --scope packets:write --scope packets:read
```

This lets you issue narrowly scoped credentials for automation instead of reusing personal auth.

## Environment Variables

The CLI also supports environment-variable based overrides.

### `PROXKEY_API_BASE_URL`

Overrides the configured backend URL.

Example:

```bash
export PROXKEY_API_BASE_URL=https://api.proxkey.dev
```

This is helpful in CI or ephemeral environments where you do not want to persist configuration to disk.

### `PROXKEY_API_KEY`

Overrides the stored auth token or API key.

Example:

```bash
export PROXKEY_API_KEY=pk_live_your_key_here
```

This is especially useful for:

- GitHub Actions
- CI/CD runners
- containerized workflows
- temporary test environments

## Configuration Storage

By default, the CLI stores persistent configuration in:

```text
~/.proxkey/auth.json
```

This may include backend connection configuration and local authentication state, depending on how the CLI is used.

For shared systems or CI runners, environment variables are generally the safer option.

## Homebrew Release Flow

If you want to distribute the CLI through Homebrew, generate a formula from the npm package tarball:

```bash
node scripts/generate-homebrew-formula.mjs
```

This writes:

```text
packaging/homebrew/proxkey.rb
```

Recommended flow:

1. publish the npm package
2. generate the formula
3. copy the generated formula into your Homebrew tap
4. publish or update the tap
