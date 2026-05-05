#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { createHash, randomBytes } from 'crypto'
import readline from 'readline/promises'

type CommandName = 'help' | 'version' | 'login' | 'logout' | 'init' | 'scan' | 'ingest' | 'incident' | 'triage' | 'ci' | 'auth' | 'config' | 'connect' | 'export' | 'status' | 'whoami'
type AuthType = 'local' | 'auth0' | 'api-key'
type CliPlan = 'FREE' | 'FOUNDER' | 'TEAM' | 'GROWTH' | 'ENTERPRISE'
type ApiKeyScope = 'packets:write' | 'packets:read' | 'usage:read'
type IntegrationProvider = 'github' | 'jira' | 'linear' | 'slack' | 'sentry' | 'datadog' | 'pagerduty' | 'splunk'
type IngestSource = 'github-actions' | 'gitlab-ci' | 'circleci' | 'buildkite' | 'jenkins' | 'vercel' | 'generic'
type IngestResult = 'failed' | 'passed' | 'warning' | 'unknown'
type SignalKind = 'error' | 'test-failure' | 'dependency' | 'database' | 'network' | 'auth' | 'timeout' | 'deploy' | 'security' | 'warning'

type CliConfig = {
  apiBaseUrl: string
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: string
  email?: string
  authType?: AuthType
  auth0Domain?: string
  auth0ClientId?: string
  auth0Audience?: string
  auth0Scope?: string
}

type RemoteAuthConfig = {
  strategy: 'local' | 'auth0'
  auth0: null | {
    domain: string
    audience: string
    cliClientId: string | null
    cliEnabled: boolean
    scope: string
  }
}

type Auth0DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

type Auth0TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

type Auth0BootstrapResponse = {
  authenticated: boolean
  user: {
    email: string
  }
  organization: {
    id: string
    name: string
  } | null
}

type LaunchPacket = {
  id?: string
  title: string
  summary: string
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4'
  confidence: number
  affected_component: string
  user_impact: string
  environment: string
  reproduction_steps: string[]
  expected_behavior: string
  actual_behavior: string
  evidence: string[]
  suspected_root_causes: string[]
  missing_information: string[]
  recommended_next_actions: string[]
  suggested_owner: string
  engineering_handoff: string
  support_response: string
  tags: string[]
}

type LogSignal = {
  kind: SignalKind
  label: string
  count: number
  confidence: number
  sample: string
  line: number
  component: string
  severityWeight: number
}

type IngestRecord = {
  id: string
  createdAt: string
  source: IngestSource
  service?: string
  environment?: string
  branch?: string
  commit?: string
  cwd: string
  file?: string
  sha256: string
  bytes: number
  lines: number
  result: IngestResult
  confidence: number
  summary: string
  signals: LogSignal[]
  reasoning: string[]
  redactedText: string
  truncated: boolean
}

type IncidentAnalysis = {
  id: string
  createdAt: string
  severity: LaunchPacket['severity']
  component: string
  confidence: number
  summary: string
  likelyCause: string
  impact: string
  evidence: Array<{ line: number; text: string }>
  reasoning: string[]
  nextActions: string[]
  missingInformation: string[]
  sourceIngestId?: string
}

const AUTH0_SIGNUP_HINT = 'No ProxKey workspace exists for this Auth0 identity yet. Start with sign up.'
const AUTH0_DEFAULT_SCOPE = 'openid profile email offline_access'
const DEFAULT_API_BASE_URL = 'https://api.proxkey.dev'
const MAX_STORED_LOG_CHARS = 80_000
const PLAN_VALUES: CliPlan[] = ['FREE', 'FOUNDER', 'TEAM', 'GROWTH', 'ENTERPRISE']
const API_KEY_SCOPES: ApiKeyScope[] = ['packets:write', 'packets:read', 'usage:read']
const INTEGRATION_PROVIDERS: IntegrationProvider[] = ['github', 'jira', 'linear', 'slack', 'sentry', 'datadog', 'pagerduty', 'splunk']
const INGEST_SOURCES: IngestSource[] = ['github-actions', 'gitlab-ci', 'circleci', 'buildkite', 'jenkins', 'vercel', 'generic']
const BOOLEAN_FLAGS = new Set(['--json', '--no-save', '--verbose', '--help', '-h', '--version', '-v'])

function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.proxkey', 'auth.json')
}

function getRepoConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, '.proxkey', 'config.json')
}

function getRepoStateDir(cwd = process.cwd()): string {
  return path.join(cwd, '.proxkey')
}

function getIngestDir(cwd = process.cwd()): string {
  return path.join(getRepoStateDir(cwd), 'ingests')
}

function getIngestPath(id: string, cwd = process.cwd()): string {
  return path.join(getIngestDir(cwd), `${id}.json`)
}

function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJson(filePath: string, value: unknown): void {
  ensureDirectory(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function getCliVersion(): string {
  return readJson<{ version?: string }>(path.join(__dirname, '..', 'package.json'))?.version ?? '0.1.0'
}

function isEnvTokenOverride(): boolean {
  return Boolean(process.env.PROXKEY_API_KEY)
}

function saveGlobalConfig(config: CliConfig): void {
  writeJson(getGlobalConfigPath(), config)
}

function loadConfig(): CliConfig {
  const repo = readJson<Partial<CliConfig>>(getRepoConfigPath()) ?? {}
  const global = readJson<Partial<CliConfig>>(getGlobalConfigPath()) ?? {}

  return {
    apiBaseUrl: (process.env.PROXKEY_API_BASE_URL ?? process.env.API_URL ?? repo.apiBaseUrl ?? global.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, ''),
    accessToken: process.env.PROXKEY_API_KEY ?? global.accessToken,
    refreshToken: global.refreshToken,
    accessTokenExpiresAt: global.accessTokenExpiresAt,
    email: global.email,
    authType: process.env.PROXKEY_API_KEY ? 'api-key' : global.authType,
    auth0Domain: global.auth0Domain,
    auth0ClientId: global.auth0ClientId,
    auth0Audience: global.auth0Audience,
    auth0Scope: global.auth0Scope,
  }
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Provide an API base URL. Example: https://api.proxkey.dev')
  }

  try {
    return new URL(trimmed).toString().replace(/\/$/, '')
  } catch {
    throw new Error(`Invalid API base URL: ${trimmed}`)
  }
}

function withApiBaseUrlOverride(config: CliConfig, args: string[]): CliConfig {
  const override = takeFlagValue(args, '--api-base-url')
  if (!override) {
    return config
  }

  return {
    ...config,
    apiBaseUrl: normalizeApiBaseUrl(override),
  }
}

function persistApiBaseUrl(apiBaseUrl: string): { clearedAuth: boolean } {
  const global = readJson<Partial<CliConfig>>(getGlobalConfigPath()) ?? {}
  const normalizedCurrent = (global.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
  const normalizedNext = normalizeApiBaseUrl(apiBaseUrl)
  const clearedAuth = normalizedCurrent !== normalizedNext

  saveGlobalConfig({
    apiBaseUrl: normalizedNext,
    accessToken: clearedAuth ? undefined : global.accessToken,
    refreshToken: clearedAuth ? undefined : global.refreshToken,
    accessTokenExpiresAt: clearedAuth ? undefined : global.accessTokenExpiresAt,
    email: clearedAuth ? undefined : global.email,
    authType: clearedAuth ? undefined : global.authType,
    auth0Domain: clearedAuth ? undefined : global.auth0Domain,
    auth0ClientId: clearedAuth ? undefined : global.auth0ClientId,
    auth0Audience: clearedAuth ? undefined : global.auth0Audience,
    auth0Scope: clearedAuth ? undefined : global.auth0Scope,
  })

  return { clearedAuth }
}

function serializeConfig(config: CliConfig) {
  return {
    apiBaseUrl: config.apiBaseUrl,
    authType: config.authType ?? null,
    email: config.email ?? null,
    hasAccessToken: Boolean(config.accessToken),
    hasRefreshToken: Boolean(config.refreshToken),
    auth0Domain: config.auth0Domain ?? null,
    auth0ClientId: config.auth0ClientId ?? null,
    auth0Audience: config.auth0Audience ?? null,
  }
}

function toExpiryIso(expiresInSeconds?: number): string | undefined {
  if (!expiresInSeconds || Number.isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
    return undefined
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

function shouldRefreshAccessToken(config: CliConfig): boolean {
  if (isEnvTokenOverride() || config.authType !== 'auth0' || !config.refreshToken) {
    return false
  }

  if (!config.accessToken) {
    return true
  }

  if (!config.accessTokenExpiresAt) {
    return false
  }

  const expiresAt = Date.parse(config.accessTokenExpiresAt)
  if (Number.isNaN(expiresAt)) {
    return false
  }

  return expiresAt - Date.now() <= 60_000
}

function isExpiredAuth0AccessToken(config: CliConfig): boolean {
  if (config.authType !== 'auth0' || !config.accessToken || !config.accessTokenExpiresAt) {
    return false
  }

  const expiresAt = Date.parse(config.accessTokenExpiresAt)
  if (Number.isNaN(expiresAt)) {
    return false
  }

  return expiresAt <= Date.now()
}

async function refreshAuth0AccessToken(config: CliConfig): Promise<CliConfig> {
  if (!config.refreshToken || !config.auth0Domain || !config.auth0ClientId) {
    return config
  }

  const response = await fetch(`https://${config.auth0Domain}/oauth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.auth0ClientId,
      refresh_token: config.refreshToken,
    }).toString(),
  })

  const data = (await response.json().catch(() => null)) as
    | (Auth0TokenResponse & { error?: string; error_description?: string })
    | null

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description ?? data?.error ?? 'Auth0 session refresh failed. Run proxkey login again.')
  }

  const nextConfig: CliConfig = {
    ...config,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? config.refreshToken,
    accessTokenExpiresAt: toExpiryIso(data.expires_in) ?? config.accessTokenExpiresAt,
  }

  saveGlobalConfig(nextConfig)
  return nextConfig
}

async function prepareConfig(config: CliConfig): Promise<CliConfig> {
  if (!shouldRefreshAccessToken(config)) {
    if (isExpiredAuth0AccessToken(config) && !config.refreshToken) {
      throw new Error('Auth0 access token expired. Run proxkey login again.')
    }

    return config
  }

  return refreshAuth0AccessToken(config)
}

async function apiRequest<T>(config: CliConfig, pathName: string, init: RequestInit = {}): Promise<T> {
  const effectiveConfig = await prepareConfig(config)
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (effectiveConfig.accessToken) {
    headers.set('authorization', `Bearer ${effectiveConfig.accessToken}`)
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${effectiveConfig.apiBaseUrl}${pathName}`, {
    ...init,
    headers,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? 'Request failed')
  }
  return data as T
}

async function getRemoteAuthConfig(apiBaseUrl: string): Promise<RemoteAuthConfig> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/auth/config`, {
    headers: {
      accept: 'application/json',
    },
  })

  if (response.status === 404) {
    return {
      strategy: 'local',
      auth0: null,
    }
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? 'Unable to load auth configuration.')
  }

  return data as RemoteAuthConfig
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

function getUsageText(): string {
  return [
    `proxkey ${getCliVersion()}`,
    '',
    'Usage:',
    '  proxkey help',
    '  proxkey version',
    '  proxkey config show',
    '  proxkey config set api-base-url <url>',
    '  proxkey login [--api-base-url <url>]',
    '  proxkey auth set-key <key> [--api-base-url <url>]',
    '  proxkey auth create-key <name> [--scope <scope>]',
    '  proxkey connect <github|jira|linear|slack|sentry|datadog|pagerduty|splunk> [--json]',
    '  proxkey ingest --file <path> [--source <ci>] [--service <name>] [--env <name>] [--json]',
    '  proxkey incident analyze --ingest <id|latest> [--json]',
    '  proxkey incident analyze --file <path> [--service <name>] [--json]',
    '  proxkey triage --file <path> [--json]',
    '  proxkey ci analyze --file <path> [--json]  # alias for incident analyze',
    '  proxkey export --format markdown <report-id>',
    '',
    'Environment:',
    `  PROXKEY_API_BASE_URL overrides the configured backend URL (default ${DEFAULT_API_BASE_URL})`,
    '  PROXKEY_API_KEY overrides the stored auth token or API key',
    '',
    'Valid API key scopes:',
    `  ${API_KEY_SCOPES.join(', ')}`,
    '',
    'Supported integrations:',
    `  ${INTEGRATION_PROVIDERS.join(', ')}`,
    '',
    'Supported ingest sources:',
    `  ${INGEST_SOURCES.join(', ')}`,
  ].join('\n')
}

function parseArgs(argv: string[]) {
  if (argv.length === 0) {
    return {
      command: 'help' as CommandName,
      args: [],
    }
  }

  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    return {
      command: 'help' as CommandName,
      args: argv.slice(1),
    }
  }

  if (argv[0] === 'version' || argv[0] === '--version' || argv[0] === '-v') {
    return {
      command: 'version' as CommandName,
      args: argv.slice(1),
    }
  }

  const [command, ...rest] = argv
  return {
    command: command as CommandName,
    args: rest,
  }
}

function takeFlagValue(args: string[], flag: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value.startsWith(`${flag}=`)) {
      const inlineValue = value.slice(flag.length + 1)
      return inlineValue || undefined
    }

    if (value !== flag) {
      continue
    }

    const nextValue = args[index + 1]
    if (!nextValue || nextValue.startsWith('--')) {
      return undefined
    }

    return nextValue
  }

  return undefined
}

function takeFlagValues(args: string[], flag: string): string[] {
  const values: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value.startsWith(`${flag}=`)) {
      const inlineValue = value.slice(flag.length + 1)
      if (inlineValue) {
        values.push(inlineValue)
      }
      continue
    }

    if (value !== flag) {
      continue
    }

    const nextValue = args[index + 1]
    if (!nextValue || nextValue.startsWith('--')) {
      continue
    }

    values.push(nextValue)
  }

  return values
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag)
}

function positionalArgs(args: string[]): string[] {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value.startsWith('--')) {
      if (!value.includes('=') && !BOOLEAN_FLAGS.has(value) && args[index + 1] && !args[index + 1].startsWith('--')) {
        index += 1
      }
      continue
    }
    values.push(value)
  }
  return values
}

function parseApiKeyScopes(args: string[]): ApiKeyScope[] {
  const requestedScopes = takeFlagValues(args, '--scope')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

  if (requestedScopes.length === 0) {
    return ['packets:write', 'packets:read']
  }

  const invalidScopes = requestedScopes.filter((scope) => !API_KEY_SCOPES.includes(scope as ApiKeyScope))
  if (invalidScopes.length > 0) {
    throw new Error(`Unknown scope(s): ${invalidScopes.join(', ')}. Valid scopes: ${API_KEY_SCOPES.join(', ')}`)
  }

  return Array.from(new Set(requestedScopes)) as ApiKeyScope[]
}

function parseIntegrationProvider(value?: string): IntegrationProvider {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || !INTEGRATION_PROVIDERS.includes(normalized as IntegrationProvider)) {
    throw new Error(`Unknown integration. Use one of: ${INTEGRATION_PROVIDERS.join(', ')}`)
  }

  return normalized as IntegrationProvider
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data.trim())
    })
    if (process.stdin.isTTY) {
      resolve('')
    }
  })
}

function detectFramework(cwd: string): string {
  const files = fs.readdirSync(cwd)
  if (files.includes('next.config.js') || files.includes('next.config.ts')) return 'nextjs'
  if (files.includes('vite.config.ts') || files.includes('vite.config.js')) return 'vite'
  if (files.includes('package.json')) return 'node'
  return 'unknown'
}

function detectDependencies(cwd: string): string[] {
  const packageJsonPath = path.join(cwd, 'package.json')
  const pkg = readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(packageJsonPath)
  if (!pkg) return []
  return Object.keys({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  }).slice(0, 20)
}

function getGitOutput(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function readTextFile(filePath?: string): string {
  if (!filePath) {
    return ''
  }

  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8').trim()
}

function createLocalId(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}_${randomBytes(3).toString('hex')}`
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function formatConfidence(value: number): string {
  return `${Math.round(clamp(value) * 100)}%`
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  const keep = Math.max(10, Math.floor((maxLength - 5) / 2))
  return `${value.slice(0, keep)} ... ${value.slice(value.length - keep)}`
}

function cleanLogLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function redactSensitiveText(text: string): string {
  return text
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|token|secret|password|passwd|pwd)\s*[=:]\s*)[^\s"'`]+/gi, '$1[redacted]')
    .replace(/\b(pk_(?:live|test)_[A-Za-z0-9_=-]+)/g, '[redacted-api-key]')
    .replace(/\b([A-Za-z0-9+/]{32,}={0,2})\b/g, (match) => (/[A-Za-z]/.test(match) && /\d/.test(match) ? '[redacted-secret]' : match))
}

function limitStoredText(text: string): { value: string; truncated: boolean } {
  if (text.length <= MAX_STORED_LOG_CHARS) {
    return { value: text, truncated: false }
  }

  const head = text.slice(0, Math.floor(MAX_STORED_LOG_CHARS * 0.35))
  const tail = text.slice(text.length - Math.floor(MAX_STORED_LOG_CHARS * 0.65))
  return {
    value: `${head}\n\n[proxkey: log truncated]\n\n${tail}`,
    truncated: true,
  }
}

function parseIngestSource(value?: string): IngestSource {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return detectIngestSourceFromEnv()
  }

  if (!INGEST_SOURCES.includes(normalized as IngestSource)) {
    throw new Error(`Unknown ingest source: ${value}. Use one of: ${INGEST_SOURCES.join(', ')}`)
  }

  return normalized as IngestSource
}

function detectIngestSourceFromEnv(): IngestSource {
  if (process.env.GITHUB_ACTIONS) return 'github-actions'
  if (process.env.GITLAB_CI) return 'gitlab-ci'
  if (process.env.CIRCLECI) return 'circleci'
  if (process.env.BUILDKITE) return 'buildkite'
  if (process.env.JENKINS_URL) return 'jenkins'
  if (process.env.VERCEL) return 'vercel'
  return 'generic'
}

function getSignalRules(): Array<{
  kind: SignalKind
  label: string
  pattern: RegExp
  component: string
  severityWeight: number
  confidence: number
}> {
  return [
    { kind: 'database', label: 'database failure', pattern: /\b(prisma|postgres|mysql|sqlite|database|db|migration|p1001|p1002|deadlock|connection refused)\b/i, component: 'Database', severityWeight: 0.82, confidence: 0.84 },
    { kind: 'dependency', label: 'dependency failure', pattern: /\b(module not found|cannot find module|eresolve|npm err|yarn error|pnpm err|lockfile|package install failed)\b/i, component: 'Dependencies', severityWeight: 0.68, confidence: 0.78 },
    { kind: 'test-failure', label: 'test failure', pattern: /\b(assertionerror|expected .* received|tests? failed|test suite failed|failing test|jest|vitest|pytest|rspec)\b/i, component: 'Tests', severityWeight: 0.58, confidence: 0.72 },
    { kind: 'auth', label: 'auth failure', pattern: /\b(unauthorized|forbidden|permission denied|jwt|oauth|token expired|invalid token|401|403)\b/i, component: 'Auth', severityWeight: 0.74, confidence: 0.78 },
    { kind: 'network', label: 'network failure', pattern: /\b(econnreset|econnrefused|enotfound|etimedout|dns|socket hang up|network error)\b/i, component: 'Network', severityWeight: 0.66, confidence: 0.76 },
    { kind: 'timeout', label: 'timeout', pattern: /\b(timeout|timed out|deadline exceeded|context deadline)\b/i, component: 'Runtime', severityWeight: 0.64, confidence: 0.7 },
    { kind: 'deploy', label: 'deploy failure', pattern: /\b(deploy(?:ment)? failed|build failed|failed to compile|docker build failed|rollout failed|health check failed)\b/i, component: 'Deploy', severityWeight: 0.7, confidence: 0.76 },
    { kind: 'security', label: 'security finding', pattern: /\b(vulnerability|cve-|secret leaked|exposed secret|insecure|security advisory)\b/i, component: 'Security', severityWeight: 0.72, confidence: 0.74 },
    { kind: 'error', label: 'runtime error', pattern: /\b(error|exception|typeerror|referenceerror|panic|fatal|segmentation fault|stack trace)\b/i, component: 'Runtime', severityWeight: 0.62, confidence: 0.68 },
    { kind: 'warning', label: 'warning', pattern: /\b(warn(?:ing)?|deprecated|deprecation)\b/i, component: 'Runtime', severityWeight: 0.34, confidence: 0.52 },
  ]
}

function extractSignals(text: string): LogSignal[] {
  const lines = text.split(/\r?\n/)
  const byKind = new Map<SignalKind, LogSignal>()

  lines.forEach((line, index) => {
    const cleaned = cleanLogLine(line)
    if (!cleaned) {
      return
    }

    for (const rule of getSignalRules()) {
      if (!rule.pattern.test(cleaned)) {
        continue
      }

      const existing = byKind.get(rule.kind)
      if (existing) {
        existing.count += 1
        if (cleaned.length > existing.sample.length && cleaned.length < 220) {
          existing.sample = cleaned
          existing.line = index + 1
        }
      } else {
        byKind.set(rule.kind, {
          kind: rule.kind,
          label: rule.label,
          count: 1,
          confidence: rule.confidence,
          sample: truncateMiddle(cleaned, 160),
          line: index + 1,
          component: rule.component,
          severityWeight: rule.severityWeight,
        })
      }
    }
  })

  return Array.from(byKind.values()).sort((left, right) => {
    const weightDelta = right.severityWeight - left.severityWeight
    return weightDelta === 0 ? right.count - left.count : weightDelta
  })
}

function inferResult(text: string, signals: LogSignal[]): IngestResult {
  if (/\b(exit code|exited with code)\s*[1-9]\d*\b/i.test(text) || /\b(failed|failure|fatal|errored)\b/i.test(text)) {
    return 'failed'
  }

  if (signals.some((signal) => signal.kind !== 'warning')) {
    return 'failed'
  }

  if (signals.some((signal) => signal.kind === 'warning')) {
    return 'warning'
  }

  if (/\b(success|passed|completed|done)\b/i.test(text)) {
    return 'passed'
  }

  return 'unknown'
}

function inferComponent(signals: LogSignal[], fallback = 'Platform'): string {
  const specificTopSignal = signals.find((signal) => signal.component !== 'Runtime')
  if (specificTopSignal) {
    return specificTopSignal.component
  }

  const componentCounts = new Map<string, number>()
  for (const signal of signals) {
    componentCounts.set(signal.component, (componentCounts.get(signal.component) ?? 0) + signal.count * signal.severityWeight)
  }

  return Array.from(componentCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? fallback
}

function scoreLogConfidence(text: string, signals: LogSignal[]): number {
  const hasExplicitFailure = /\b(exit code|failed|failure|fatal|exception|stack trace)\b/i.test(text)
  const hasTimestamps = /^\s*(\d{4}-\d\d-\d\d|[\d:.]+)\b/m.test(text)
  const signalScore = Math.min(0.32, signals.reduce((total, signal) => total + signal.confidence * Math.min(signal.count, 4), 0) / 24)
  const sizeScore = text.length > 2000 ? 0.08 : text.length > 400 ? 0.04 : 0
  const explicitScore = hasExplicitFailure ? 0.12 : 0
  const timestampScore = hasTimestamps ? 0.04 : 0
  return clamp(0.42 + signalScore + sizeScore + explicitScore + timestampScore, 0.35, 0.96)
}

function buildIngestSummary(args: {
  result: IngestResult
  source: IngestSource
  service?: string
  component: string
  signals: LogSignal[]
}): string {
  const subject = args.service ? `${args.service} ${args.source}` : args.source
  const topSignal = args.signals[0]
  if (!topSignal) {
    return `${subject} log ingested with no strong failure signal.`
  }

  return `${subject} ${args.result}; strongest signal is ${topSignal.label} in ${args.component}.`
}

function buildIngestReasoning(text: string, result: IngestResult, signals: LogSignal[]): string[] {
  const reasoning: string[] = []
  const hardSignals = signals.filter((signal) => signal.kind !== 'warning')
  const topSignal = signals[0]

  if (/\b(exit code|exited with code)\s*[1-9]\d*\b/i.test(text)) {
    reasoning.push('The log contains a non-zero process exit marker.')
  } else if (result === 'failed') {
    reasoning.push('Failure language appears in the log near actionable error signals.')
  }

  if (topSignal) {
    reasoning.push(`${topSignal.label} is the highest-weighted signal with ${topSignal.count} match${topSignal.count === 1 ? '' : 'es'}.`)
  }

  if (hardSignals.length > 1) {
    reasoning.push(`Multiple signal families matched: ${hardSignals.slice(0, 3).map((signal) => signal.kind).join(', ')}.`)
  }

  if (signals.length === 0) {
    reasoning.push('No known error, failure, timeout, auth, database, network, or deploy pattern matched.')
  }

  return reasoning.slice(0, 4)
}

function createIngestRecord(args: {
  text: string
  source: IngestSource
  service?: string
  environment?: string
  branch?: string
  commit?: string
  file?: string
}): IngestRecord {
  const redacted = redactSensitiveText(args.text)
  const limited = limitStoredText(redacted)
  const signals = extractSignals(redacted)
  const result = inferResult(redacted, signals)
  const confidence = scoreLogConfidence(redacted, signals)
  const component = inferComponent(signals)
  const lineCount = redacted ? redacted.split(/\r?\n/).length : 0

  return {
    id: createLocalId('ing'),
    createdAt: new Date().toISOString(),
    source: args.source,
    service: args.service,
    environment: args.environment,
    branch: args.branch,
    commit: args.commit,
    cwd: process.cwd(),
    file: args.file ? path.resolve(process.cwd(), args.file) : undefined,
    sha256: createHash('sha256').update(redacted).digest('hex'),
    bytes: Buffer.byteLength(redacted),
    lines: lineCount,
    result,
    confidence,
    summary: buildIngestSummary({ result, source: args.source, service: args.service, component, signals }),
    signals,
    reasoning: buildIngestReasoning(redacted, result, signals),
    redactedText: limited.value,
    truncated: limited.truncated,
  }
}

function saveIngestRecord(record: IngestRecord): string {
  const filePath = getIngestPath(record.id)
  writeJson(filePath, record)
  return filePath
}

function readIngestRecords(cwd = process.cwd()): IngestRecord[] {
  const dir = getIngestDir(cwd)
  if (!fs.existsSync(dir)) {
    return []
  }

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => readJson<IngestRecord>(path.join(dir, fileName)))
    .filter((record): record is IngestRecord => Boolean(record?.id))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

function loadIngestRecord(id: string): IngestRecord {
  const records = readIngestRecords()
  const record = id === 'latest' ? records[0] : records.find((item) => item.id === id)
  if (!record) {
    throw new Error(`Ingest not found: ${id}. Run proxkey ingest first or use --file.`)
  }

  return record
}

function deriveIncidentSeverity(text: string, result: IngestResult, signals: LogSignal[], environment?: string): LaunchPacket['severity'] {
  if (/\b(sev[- ]?1|outage|data loss|all users|payment(?:s)? down|cannot login|security breach)\b/i.test(text)) {
    return 'SEV-1'
  }

  if (/\b(sev[- ]?2|production|prod|500|checkout|incident|health check failed|rollback)\b/i.test(text)) {
    return 'SEV-2'
  }

  if ((environment === 'production' || environment === 'prod') && result === 'failed' && signals.some((signal) => signal.severityWeight >= 0.62)) {
    return 'SEV-2'
  }

  if (result === 'failed' || signals.some((signal) => signal.severityWeight >= 0.62)) {
    return 'SEV-3'
  }

  return 'SEV-4'
}

function buildLikelyCause(component: string, signals: LogSignal[]): string {
  const kinds = new Set(signals.map((signal) => signal.kind))
  if (kinds.has('database')) return 'Database connectivity, migration, or query failure is blocking the run.'
  if (kinds.has('dependency')) return 'Dependency resolution or module packaging failed before the application could start.'
  if (kinds.has('auth')) return 'Authentication or authorization rejected a required request or token.'
  if (kinds.has('network')) return 'Network connectivity failed between a required service and this workflow.'
  if (kinds.has('timeout')) return 'A required operation exceeded its deadline and left the workflow incomplete.'
  if (kinds.has('test-failure')) return 'Automated tests are failing against the current change set.'
  if (kinds.has('deploy')) return 'Build or deployment validation failed before the release became healthy.'
  if (kinds.has('security')) return 'A security check or secret exposure signal needs review before continuing.'
  return `The strongest evidence points to ${component}.`
}

function buildIncidentImpact(severity: LaunchPacket['severity'], result: IngestResult, environment?: string): string {
  if (severity === 'SEV-1') return 'Broad user impact is likely or explicitly stated.'
  if (severity === 'SEV-2') return environment === 'production' || environment === 'prod' ? 'Production impact is plausible and should be treated as active until disproven.' : 'Release or runtime impact is plausible.'
  if (result === 'failed') return 'The workflow is blocked, but end-user impact is not proven from the supplied log.'
  return 'Impact is unclear from the supplied evidence.'
}

function buildIncidentNextActions(component: string, signals: LogSignal[]): string[] {
  const kinds = new Set(signals.map((signal) => signal.kind))
  if (kinds.has('database')) {
    return [
      'Check database availability and connection limits for the affected environment.',
      'Verify migration state, locks, and recent schema changes.',
      'Rerun the failed job after confirming the database dependency is healthy.',
    ]
  }

  if (kinds.has('dependency')) {
    return [
      'Reinstall dependencies from a clean cache and compare the lockfile against the last green build.',
      'Check for recently upgraded packages or missing workspace artifacts.',
      'Pin or revert the dependency change if the failure reproduces cleanly.',
    ]
  }

  if (kinds.has('auth')) {
    return [
      'Validate the token, secret, and permission scope used by the failing workflow.',
      'Check whether credentials rotated or expired before this run.',
      'Replay the failing request with least-privilege credentials.',
    ]
  }

  if (kinds.has('network') || kinds.has('timeout')) {
    return [
      'Check the upstream service status, DNS resolution, and recent network policy changes.',
      'Compare timeout frequency with the previous successful run.',
      'Retry with request tracing enabled if the dependency is healthy.',
    ]
  }

  if (kinds.has('test-failure')) {
    return [
      'Open the first failing test and compare assertions against the recent diff.',
      'Run the failing test file locally with verbose output.',
      'Decide whether the implementation or expectation changed incorrectly.',
    ]
  }

  if (kinds.has('deploy')) {
    return [
      'Inspect the first deploy/build failure before secondary health-check noise.',
      'Compare build environment variables with the last successful deployment.',
      'Rollback or pause promotion if this targets production.',
    ]
  }

  return [
    `Route to the ${component} owner with the evidence lines below.`,
    'Ask for the failing command, environment, and last known good run.',
    'Reproduce with verbose logging before assigning a root cause.',
  ]
}

function buildIncidentMissingInfo(text: string, ingest?: IngestRecord, environment?: string): string[] {
  const missing: string[] = []
  if (!/\b(prod|production|staging|preview|dev|development)\b/i.test(text) && !ingest?.environment && !environment) {
    missing.push('environment')
  }
  if (!/\b(commit|sha|branch)\b/i.test(text) && !ingest?.commit && !ingest?.branch) {
    missing.push('commit or branch')
  }
  if (!/\b(last green|previous successful|baseline)\b/i.test(text)) {
    missing.push('last successful run')
  }
  return missing
}

function createIncidentAnalysis(args: {
  text: string
  service?: string
  environment?: string
  ingest?: IngestRecord
}): IncidentAnalysis {
  const redacted = redactSensitiveText(args.text)
  const signals = extractSignals(redacted)
  const result = inferResult(redacted, signals)
  const component = inferComponent(signals, args.service ?? 'Platform')
  const environment = args.environment ?? args.ingest?.environment
  const severity = deriveIncidentSeverity(redacted, result, signals, environment)
  const confidence = clamp(scoreLogConfidence(redacted, signals) + (args.ingest ? 0.04 : 0) + (args.environment ? 0.02 : 0), 0.35, 0.97)
  const evidence = Array.from(new Map(signals.map((signal) => [`${signal.line}:${signal.sample}`, {
    line: signal.line,
    text: signal.sample,
  }])).values()).slice(0, 5)
  const likelyCause = buildLikelyCause(component, signals)
  const reasoning = buildIngestReasoning(redacted, result, signals)
  if (args.ingest) {
    reasoning.push(`Analysis is linked to ingest ${args.ingest.id} from ${args.ingest.source}.`)
  }

  return {
    id: createLocalId('inc'),
    createdAt: new Date().toISOString(),
    severity,
    component,
    confidence,
    summary: `${severity} ${component}: ${likelyCause}`,
    likelyCause,
    impact: buildIncidentImpact(severity, result, environment),
    evidence,
    reasoning: reasoning.slice(0, 5),
    nextActions: buildIncidentNextActions(component, signals),
    missingInformation: buildIncidentMissingInfo(redacted, args.ingest, environment),
    sourceIngestId: args.ingest?.id,
  }
}

function printRows(rows: Array<[string, string | number | undefined]>): void {
  const visibleRows = rows.filter(([, value]) => value !== undefined && value !== '')
  const width = Math.max(...visibleRows.map(([label]) => label.length), 0)
  for (const [label, value] of visibleRows) {
    console.log(`${label.padEnd(width)}  ${value}`)
  }
}

function printList(title: string, items: string[]): void {
  if (items.length === 0) {
    return
  }

  console.log(`\n${title}`)
  for (const item of items) {
    console.log(`  - ${item}`)
  }
}

function printNumberedList(title: string, items: string[]): void {
  if (items.length === 0) {
    return
  }

  console.log(`\n${title}`)
  items.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`)
  })
}

function printSignals(signals: LogSignal[]): void {
  if (signals.length === 0) {
    return
  }

  console.log('\nSignals')
  for (const signal of signals.slice(0, 5)) {
    const count = String(signal.count).padStart(3)
    console.log(`  ${signal.label.padEnd(18)} ${count}  L${signal.line}  ${truncateMiddle(signal.sample, 96)}`)
  }
}

function printIngestRecord(record: IngestRecord, savedPath?: string): void {
  console.log('proxkey ingest')
  printRows([
    ['id', record.id],
    ['source', record.source],
    ['service', record.service],
    ['env', record.environment],
    ['result', record.result],
    ['confidence', formatConfidence(record.confidence)],
    ['lines', record.lines],
    ['stored', savedPath ? path.relative(process.cwd(), savedPath) : 'not saved'],
  ])
  console.log(`\n${record.summary}`)
  printSignals(record.signals)
  printList('Reasoning', record.reasoning)
  console.log(`\nNext\n  proxkey incident analyze --ingest ${record.id}`)
}

function printIncidentAnalysis(analysis: IncidentAnalysis): void {
  console.log('proxkey incident')
  printRows([
    ['severity', analysis.severity],
    ['component', analysis.component],
    ['confidence', formatConfidence(analysis.confidence)],
    ['ingest', analysis.sourceIngestId],
  ])

  console.log(`\n${analysis.summary}`)
  console.log(`\nLikely cause\n  ${analysis.likelyCause}`)
  console.log(`\nImpact\n  ${analysis.impact}`)

  if (analysis.evidence.length > 0) {
    console.log('\nEvidence')
    for (const item of analysis.evidence) {
      console.log(`  L${item.line}  ${truncateMiddle(item.text, 112)}`)
    }
  }

  printList('Reasoning', analysis.reasoning)
  printNumberedList('Next', analysis.nextActions)
  printList('Missing', analysis.missingInformation)
}

function localFallbackTriage(rawInput: string, logs = ''): LaunchPacket {
  const text = `${rawInput}\n${logs}`.toLowerCase()
  const severity: LaunchPacket['severity'] =
    /(critical|data loss|outage|crash|payment|cannot login|500)/.test(text) ? 'SEV-2' : /(slow|timeout|retry)/.test(text) ? 'SEV-3' : 'SEV-4'
  const component = /auth|login|session/.test(text)
    ? 'Auth'
    : /payment|billing|checkout/.test(text)
      ? 'Billing'
      : /mobile|android|ios/.test(text)
        ? 'Mobile'
        : /api|export|worker/.test(text)
          ? 'Platform'
          : 'Core Platform'

  const lines = rawInput.split('\n').map((line) => line.trim()).filter(Boolean)
  const repro = lines.slice(0, 3)
  const missing = logs ? ['Expected behavior'] : ['Execution logs or stack trace', 'Expected behavior']
  const summary = `${lines[0] ?? 'Issue report'} ${lines.slice(1, 3).join(' ')}`.trim()
  const nextAction = missing.length > 0 ? `Request ${missing.join(' and ').toLowerCase()} before routing ${component}.` : `Route to ${component} and compare with the last green build.`

  return {
    title: lines[0] ?? 'Generated triage packet',
    summary,
    severity,
    confidence: logs ? 0.78 : 0.62,
    affected_component: component,
    user_impact: severity === 'SEV-2' ? 'Users are actively blocked or degraded.' : 'Impact appears partial or limited.',
    environment: 'Not explicitly provided',
    reproduction_steps: repro,
    expected_behavior: 'Not explicitly provided',
    actual_behavior: summary,
    evidence: [logs || rawInput.slice(0, 500)],
    suspected_root_causes: [`Likely issue area: ${component}`],
    missing_information: missing,
    recommended_next_actions: [nextAction],
    suggested_owner: component,
    engineering_handoff: `${summary} Next action: ${nextAction}`,
    support_response: `Thanks for the report. We translated it into an engineering packet and the next step is: ${nextAction}`,
    tags: [component.toLowerCase(), severity.toLowerCase()],
  }
}

function formatExport(packet: LaunchPacket, format: string): string {
  const repro = packet.reproduction_steps.map((step) => `- ${step}`).join('\n') || '- None'
  const missing = packet.missing_information.map((item) => `- ${item}`).join('\n') || '- None'

  switch (format) {
    case 'github':
      return [`# ${packet.title}`, '', packet.summary, '', '## Reproduction steps', repro, '', '## Missing information', missing, '', '## Next action', packet.recommended_next_actions.join('\n')].join('\n')
    case 'jira':
      return [`Summary: ${packet.title}`, `Severity: ${packet.severity}`, `Component: ${packet.affected_component}`, '', `Description:\n${packet.summary}`, '', `Missing information:\n${missing}`].join('\n')
    case 'linear':
      return [`${packet.title}`, '', `Severity ${packet.severity}`, packet.summary, '', `Next action: ${packet.recommended_next_actions.join(' ')}`].join('\n')
    case 'customer':
      return packet.support_response
    case 'markdown':
    default:
      return [
        `# ${packet.title}`,
        '',
        `Severity: ${packet.severity}`,
        `Component: ${packet.affected_component}`,
        `Confidence: ${Math.round(packet.confidence * 100)}%`,
        '',
        '## Summary',
        packet.summary,
        '',
        '## Reproduction steps',
        repro,
        '',
        '## Missing information',
        missing,
        '',
        '## Next action',
        packet.recommended_next_actions.join('\n'),
      ].join('\n')
  }
}

function printHumanPacket(packet: LaunchPacket): void {
  console.log('proxkey triage')
  printRows([
    ['severity', packet.severity],
    ['component', packet.affected_component],
    ['owner', packet.suggested_owner || 'Unassigned'],
    ['confidence', formatConfidence(packet.confidence)],
  ])
  console.log('\nNext action')
  console.log(packet.recommended_next_actions.join('\n'))
}

function normalizePlanInput(value: string): CliPlan | undefined {
  const normalized = value.trim().toUpperCase()
  return PLAN_VALUES.includes(normalized as CliPlan) ? (normalized as CliPlan) : undefined
}

async function startAuth0DeviceFlow(auth0: NonNullable<RemoteAuthConfig['auth0']>): Promise<Auth0DeviceCodeResponse> {
  const response = await fetch(`https://${auth0.domain}/oauth/device/code`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: auth0.cliClientId ?? '',
      audience: auth0.audience,
      scope: auth0.scope || AUTH0_DEFAULT_SCOPE,
    }).toString(),
  })

  const data = (await response.json().catch(() => null)) as
    | (Auth0DeviceCodeResponse & { error?: string; error_description?: string })
    | null

  if (!response.ok || !data?.device_code) {
    throw new Error(data?.error_description ?? data?.error ?? 'Unable to start Auth0 device login.')
  }

  return data
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function pollForAuth0Token(args: {
  auth0: NonNullable<RemoteAuthConfig['auth0']>
  device: Auth0DeviceCodeResponse
}): Promise<Auth0TokenResponse> {
  let intervalMs = Math.max(1000, (args.device.interval ?? 5) * 1000)
  const expiresAt = Date.now() + args.device.expires_in * 1000

  while (Date.now() < expiresAt) {
    await sleep(intervalMs)

    const response = await fetch(`https://${args.auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: args.device.device_code,
        client_id: args.auth0.cliClientId ?? '',
      }).toString(),
    })

    const data = (await response.json().catch(() => null)) as
      | (Auth0TokenResponse & { error?: string; error_description?: string })
      | null

    if (response.ok && data?.access_token) {
      return data
    }

    const errorCode = data?.error
    if (errorCode === 'authorization_pending') {
      continue
    }

    if (errorCode === 'slow_down') {
      intervalMs += 5000
      continue
    }

    if (errorCode === 'access_denied') {
      throw new Error('Auth0 login was cancelled or denied.')
    }

    if (errorCode === 'expired_token') {
      throw new Error('Auth0 device login expired. Run proxkey login again.')
    }

    throw new Error(data?.error_description ?? errorCode ?? 'Auth0 login failed.')
  }

  throw new Error('Auth0 device login timed out. Run proxkey login again.')
}

async function bootstrapAuth0Identity(apiBaseUrl: string, accessToken: string): Promise<Auth0BootstrapResponse> {
  const config: CliConfig = {
    apiBaseUrl,
    accessToken,
  }

  try {
    return await apiRequest<Auth0BootstrapResponse>(config, '/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth0 sign-in failed.'
    if (!message.includes(AUTH0_SIGNUP_HINT)) {
      throw error
    }

    if (!process.stdin.isTTY) {
      throw new Error(`${message} Re-run proxkey login in an interactive terminal or create the workspace in the web app first.`)
    }

    console.log('No ProxKey workspace exists for this Auth0 identity yet.')
    const name = await prompt('Full name (optional, press enter to use your Auth0 profile): ')
    const organizationName = await prompt('Workspace name: ')
    if (!organizationName) {
      throw new Error('Workspace name is required to finish Auth0 sign up.')
    }

    const requestedPlan = normalizePlanInput(await prompt('Plan [FREE/FOUNDER/TEAM/GROWTH/ENTERPRISE] (default FREE): ')) ?? 'FREE'

    return apiRequest<Auth0BootstrapResponse>(config, '/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        name: name || undefined,
        organizationName,
        plan: requestedPlan,
      }),
    })
  }
}

async function handleAuth0Login(current: CliConfig, auth0: NonNullable<RemoteAuthConfig['auth0']>): Promise<void> {
  if (!auth0.cliEnabled || !auth0.cliClientId) {
    throw new Error('Auth0 CLI login is not configured on the backend. Set AUTH0_CLI_CLIENT_ID (or AUTH0_CLIENT_ID) or use proxkey auth set-key with an API key.')
  }

  const device = await startAuth0DeviceFlow(auth0)
  console.log('Complete Auth0 login in your browser:')
  console.log(device.verification_uri_complete ?? device.verification_uri)
  console.log(`Code: ${device.user_code}`)

  const token = await pollForAuth0Token({ auth0, device })
  const bootstrap = await bootstrapAuth0Identity(current.apiBaseUrl, token.access_token)

  saveGlobalConfig({
    apiBaseUrl: current.apiBaseUrl,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: toExpiryIso(token.expires_in),
    email: bootstrap.user.email,
    authType: 'auth0',
    auth0Domain: auth0.domain,
    auth0ClientId: auth0.cliClientId,
    auth0Audience: auth0.audience,
    auth0Scope: auth0.scope || AUTH0_DEFAULT_SCOPE,
  })

  console.log(`Logged in as ${bootstrap.user.email}`)
  if (!token.refresh_token) {
    console.log('Auth0 did not issue a refresh token. Run proxkey login again when this access token expires.')
  }
}

async function handleHelp(): Promise<void> {
  console.log(getUsageText())
}

async function handleVersion(): Promise<void> {
  console.log(getCliVersion())
}

async function handleLogin(args: string[]): Promise<void> {
  const current = withApiBaseUrlOverride(loadConfig(), args)
  const apiBaseUrl = current.apiBaseUrl || DEFAULT_API_BASE_URL
  const remoteAuth = await getRemoteAuthConfig(apiBaseUrl)

  if (remoteAuth.strategy === 'auth0' && remoteAuth.auth0) {
    await handleAuth0Login({ ...current, apiBaseUrl }, remoteAuth.auth0)
    return
  }

  const email = await prompt('Email: ')
  const password = await prompt('Password: ')
  const response = await apiRequest<{ accessToken: string; user: { email: string } }>(
    { apiBaseUrl },
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  )

  saveGlobalConfig({
    apiBaseUrl,
    accessToken: response.accessToken,
    email: response.user.email,
    authType: 'local',
  })
  console.log(`Logged in as ${response.user.email}`)
}

async function handleLogout(args: string[]): Promise<void> {
  const current = withApiBaseUrlOverride(loadConfig(), args)
  const prepared = await prepareConfig(current).catch(() => current)

  if (prepared.accessToken && !isEnvTokenOverride()) {
    await apiRequest(prepared, '/api/auth/logout', {
      method: 'POST',
    }).catch(() => undefined)
  }

  saveGlobalConfig({
    apiBaseUrl: prepared.apiBaseUrl,
  })
  console.log('Logged out')
}

async function handleAuthSetKey(args: string[]): Promise<void> {
  const current = withApiBaseUrlOverride(loadConfig(), args)
  const key = positionalArgs(args)[0]?.trim()
  if (!key) {
    throw new Error('Provide an API key. Example: proxkey auth set-key pk_live_xxx')
  }

  saveGlobalConfig({
    apiBaseUrl: current.apiBaseUrl,
    accessToken: key,
    email: 'api-key',
    authType: 'api-key',
  })

  console.log(`Stored API key ${key.slice(0, 14)}…`)
}

async function handleAuthCreateKey(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  if (!config.accessToken) {
    throw new Error('Log in first to create an API key.')
  }

  const name = positionalArgs(args).join(' ').trim()
  if (!name) {
    throw new Error('Provide a key name. Example: proxkey auth create-key ci-bot')
  }

  const scopes = parseApiKeyScopes(args)
  const created = await apiRequest<{
    id: string
    name: string
    key: string
    keyPrefix: string
    scopesJson: ApiKeyScope[]
    createdAt: string
  }>(config, '/api/api-keys', {
    method: 'POST',
    body: JSON.stringify({
      name,
      scopes,
    }),
  })

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(created, null, 2))
    return
  }

  console.log(`Created API key ${created.name}`)
  console.log(created.key)
}

async function handleAuthListKeys(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  if (!config.accessToken) {
    throw new Error('Log in first to list API keys.')
  }

  const apiKeys = await apiRequest<{
    items: Array<{
      id: string
      name: string
      keyPrefix: string
      scopesJson: ApiKeyScope[]
      lastUsedAt: string | null
      expiresAt: string | null
      revokedAt: string | null
      createdAt: string
    }>
  }>(config, '/api/api-keys')

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(apiKeys, null, 2))
    return
  }

  for (const apiKey of apiKeys.items) {
    const status = apiKey.revokedAt ? 'revoked' : 'active'
    console.log(`${apiKey.id}  ${apiKey.name}  ${apiKey.keyPrefix}  ${status}`)
  }
}

async function handleAuthRevokeKey(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  if (!config.accessToken) {
    throw new Error('Log in first to revoke an API key.')
  }

  const apiKeyId = positionalArgs(args)[0]
  if (!apiKeyId) {
    throw new Error('Provide an API key id. Example: proxkey auth revoke-key <api-key-id>')
  }

  await apiRequest<{ success: true }>(config, `/api/api-keys/${apiKeyId}`, {
    method: 'DELETE',
  })

  console.log(`Revoked API key ${apiKeyId}`)
}

async function handleAuth(args: string[]): Promise<void> {
  const action = args[0]
  const actionArgs = args.slice(1)

  switch (action) {
    case 'set-key':
      await handleAuthSetKey(actionArgs)
      return
    case 'create-key':
      await handleAuthCreateKey(actionArgs)
      return
    case 'list-keys':
      await handleAuthListKeys(actionArgs)
      return
    case 'revoke-key':
      await handleAuthRevokeKey(actionArgs)
      return
    default:
      throw new Error('Unknown auth command. Use: proxkey auth set-key <key> | create-key <name> | list-keys | revoke-key <id>')
  }
}

async function handleConfig(args: string[]): Promise<void> {
  const action = args[0] ?? 'show'
  const current = loadConfig()

  switch (action) {
    case 'show':
      console.log(JSON.stringify(serializeConfig(current), null, 2))
      return
    case 'get':
      if (args[1] !== 'api-base-url') {
        throw new Error('Unknown config key. Use: proxkey config get api-base-url')
      }

      console.log(current.apiBaseUrl)
      return
    case 'set':
      if (args[1] !== 'api-base-url') {
        throw new Error('Unknown config key. Use: proxkey config set api-base-url <url>')
      }

      if (!args[2]) {
        throw new Error('Provide a URL. Example: proxkey config set api-base-url https://api.proxkey.dev')
      }

      const nextUrl = normalizeApiBaseUrl(args[2])
      const { clearedAuth } = persistApiBaseUrl(nextUrl)

      console.log(`Saved API base URL ${nextUrl}`)
      if (clearedAuth) {
        console.log('Cleared stored auth because the backend URL changed.')
      }
      return
    default:
      throw new Error('Unknown config command. Use: proxkey config show | get api-base-url | set api-base-url <url>')
  }
}

async function handleInit(args: string[]): Promise<void> {
  const current = withApiBaseUrlOverride(loadConfig(), args)
  writeJson(getRepoConfigPath(), {
    apiBaseUrl: current.apiBaseUrl,
  })
  console.log(`Created ${path.relative(process.cwd(), getRepoConfigPath())}`)
}

async function handleConnect(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  if (!config.accessToken) {
    throw new Error('Log in first to connect an integration.')
  }

  const provider = parseIntegrationProvider(positionalArgs(args)[0])
  const displayName = takeFlagValue(args, '--name')
  const connection = await apiRequest<{
    connection: {
      provider: IntegrationProvider
      name: string
      status: string
      displayName: string
      categoryLabel: string
      connectedAt: string | null
    }
    nextSteps: string[]
  }>(config, '/api/integrations/connect', {
    method: 'POST',
    body: JSON.stringify({
      provider,
      displayName,
      configJson: {
        source: 'cli',
        cwd: process.cwd(),
        repoUrl: getGitOutput(['remote', 'get-url', 'origin'], process.cwd()) || undefined,
      },
    }),
  })

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(connection, null, 2))
    return
  }

  console.log(`Connected ${connection.connection.name}`)
  console.log(`Status: ${connection.connection.status}`)
  console.log(`Category: ${connection.connection.categoryLabel}`)
  if (connection.nextSteps.length > 0) {
    console.log('Next steps:')
    for (const step of connection.nextSteps) {
      console.log(`- ${step}`)
    }
  }
}

async function handleScan(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  const cwd = process.cwd()
  const metadataJson = {
    framework: detectFramework(cwd),
    dependencies: detectDependencies(cwd),
    routesHint: fs.existsSync(path.join(cwd, 'src')) ? ['src'] : [],
    latestCommit: getGitOutput(['rev-parse', '--short', 'HEAD'], cwd),
    recentCommits: getGitOutput(['log', '--oneline', '-5'], cwd).split('\n').filter(Boolean),
  }

  const repoUrl = getGitOutput(['remote', 'get-url', 'origin'], cwd) || null
  const name = path.basename(cwd)
  const result = await apiRequest<{ project: { id: string; name: string } }>(config, '/api/codebase/scan', {
    method: 'POST',
    body: JSON.stringify({
      name,
      repoUrl,
      metadataJson,
    }),
  })

  console.log(`Scanned ${result.project.name}`)
}

async function handleIngest(args: string[]): Promise<void> {
  const stdin = await readStdin()
  const file = takeFlagValue(args, '--file')
  const fileText = readTextFile(file)
  const inlineText = positionalArgs(args).join(' ')
  const text = stdin || fileText || inlineText

  if (!text) {
    throw new Error('Provide CI/CD logs via stdin, --file, or inline text. Example: proxkey ingest --source github-actions --file build.log')
  }

  const record = createIngestRecord({
    text,
    source: parseIngestSource(takeFlagValue(args, '--source')),
    service: takeFlagValue(args, '--service'),
    environment: takeFlagValue(args, '--env') ?? takeFlagValue(args, '--environment') ?? process.env.VERCEL_ENV,
    branch: takeFlagValue(args, '--branch') ?? process.env.GITHUB_REF_NAME ?? process.env.CI_COMMIT_REF_NAME ?? process.env.BUILDKITE_BRANCH,
    commit: takeFlagValue(args, '--commit') ?? process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? process.env.BUILDKITE_COMMIT,
    file,
  })
  const savedPath = hasFlag(args, '--no-save') ? undefined : saveIngestRecord(record)

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify({ ...record, storedPath: savedPath ? path.relative(process.cwd(), savedPath) : null }, null, 2))
    return
  }

  printIngestRecord(record, savedPath)
}

async function handleIncidentAnalyze(args: string[]): Promise<void> {
  const ingestId = takeFlagValue(args, '--ingest')
  const ingest = ingestId ? loadIngestRecord(ingestId) : undefined
  const stdin = await readStdin()
  const file = takeFlagValue(args, '--file')
  const fileText = readTextFile(file)
  const inlineText = positionalArgs(args).join(' ')
  const ingestFileText = ingest?.file && fs.existsSync(ingest.file) ? fs.readFileSync(ingest.file, 'utf8').trim() : ''
  const text = stdin || fileText || ingestFileText || ingest?.redactedText || inlineText

  if (!text) {
    throw new Error('Provide incident context with --ingest <id|latest>, --file <path>, stdin, or inline text.')
  }

  const analysis = createIncidentAnalysis({
    text,
    service: takeFlagValue(args, '--service') ?? ingest?.service,
    environment: takeFlagValue(args, '--env') ?? takeFlagValue(args, '--environment') ?? ingest?.environment,
    ingest,
  })

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(analysis, null, 2))
    return
  }

  printIncidentAnalysis(analysis)
}

async function handleIncident(args: string[]): Promise<void> {
  const action = args[0]
  const actionArgs = args.slice(1)

  switch (action) {
    case 'analyze':
      await handleIncidentAnalyze(actionArgs)
      return
    default:
      throw new Error('Unknown incident command. Use: proxkey incident analyze --ingest <id|latest> | --file <path>')
  }
}

async function handleTriage(source: 'CLI' | 'CI', args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  const stdin = await readStdin()
  const rawFromFile = readTextFile(takeFlagValue(args, '--file'))
  const logsFromFile = readTextFile(takeFlagValue(args, '--logs'))
  const text = stdin || rawFromFile || positionalArgs(args).join(' ')
  const logs = logsFromFile || text
  const outputJson = hasFlag(args, '--json')

  if (!text) {
    throw new Error('Provide triage text via stdin, --file, or inline arguments.')
  }

  const packet = config.accessToken
    ? await apiRequest<LaunchPacket>(config, '/api/triage/generate', {
        method: 'POST',
        body: JSON.stringify({
          raw_input: text,
          source: source === 'CI' ? 'incident' : 'manual',
        }),
      })
    : localFallbackTriage(text, logs)

  if (outputJson) {
    console.log(JSON.stringify(packet, null, 2))
    return
  }

  if (!config.accessToken) {
    console.log('Running in anonymous demo fallback mode.\n')
  }

  printHumanPacket(packet)
}

async function handleExport(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  if (!config.accessToken) {
    throw new Error('Log in first to export a saved packet.')
  }

  const format = takeFlagValue(args, '--format') ?? 'markdown'
  const reportId = positionalArgs(args)[0]
  if (!reportId) {
    throw new Error('Provide a report id. Example: proxkey export --format markdown <report-id>')
  }

  const response = await apiRequest<{
    report: {
      id: string
      title: string
      triageResult: null | {
        summary: string
        severity: string
        component: string
        confidence: number
        nextAction: string
        reproSteps: string[]
        missingInfo: string[]
      }
    }
  }>(config, `/api/reports/${reportId}`)

  if (!response.report.triageResult) {
    throw new Error('This packet has not completed triage yet.')
  }

  const triage = response.report.triageResult
  const packet: LaunchPacket = {
    id: response.report.id,
    title: response.report.title,
    summary: triage.summary,
    severity: triage.severity === 'CRITICAL' ? 'SEV-1' : triage.severity === 'HIGH' ? 'SEV-2' : triage.severity === 'MEDIUM' ? 'SEV-3' : 'SEV-4',
    confidence: triage.confidence,
    affected_component: triage.component,
    user_impact: 'See packet summary.',
    environment: 'Not explicitly provided',
    reproduction_steps: triage.reproSteps,
    expected_behavior: 'Not explicitly provided',
    actual_behavior: triage.summary,
    evidence: [],
    suspected_root_causes: [`Likely issue area: ${triage.component}`],
    missing_information: triage.missingInfo,
    recommended_next_actions: [triage.nextAction],
    suggested_owner: '',
    engineering_handoff: `${triage.summary} Next action: ${triage.nextAction}`,
    support_response: `Thanks for the report. We translated it into an engineering packet and the next step is: ${triage.nextAction}`,
    tags: [triage.component.toLowerCase(), triage.severity.toLowerCase()],
  }

  console.log(formatExport(packet, format))
}

async function checkApiHealth(apiBaseUrl: string): Promise<{
  reachable: boolean
  status: string
  database?: string
  ai?: string
}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1800)

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/health`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => null)) as { ok?: boolean; database?: string; ai?: string } | null
    if (!response.ok) {
      return { reachable: true, status: `degraded (${response.status})` }
    }

    return {
      reachable: true,
      status: data?.ok === false ? 'degraded' : 'operational',
      database: data?.database,
      ai: data?.ai,
    }
  } catch {
    return { reachable: false, status: 'unreachable' }
  } finally {
    clearTimeout(timeout)
  }
}

function describeAuth(config: CliConfig): string {
  if (isEnvTokenOverride()) {
    return 'api key from PROXKEY_API_KEY'
  }
  if (config.authType === 'api-key') {
    return 'api key stored'
  }
  if (config.authType === 'auth0') {
    return config.email ? `Auth0 as ${config.email}` : 'Auth0'
  }
  if (config.authType === 'local') {
    return config.email ? `local as ${config.email}` : 'local'
  }
  return 'not logged in'
}

async function handleStatus(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  const api = await checkApiHealth(config.apiBaseUrl)
  const ingests = readIngestRecords()
  const latest = ingests[0]
  const dashboard = config.accessToken && api.reachable
    ? await apiRequest<{
        companyHealth: { totalReports: number; openReports: number; highSeverity: number }
      }>(config, '/api/dashboard/stats').catch(() => null)
    : null

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify({
      apiBaseUrl: config.apiBaseUrl,
      api,
      auth: {
        type: config.authType ?? null,
        email: config.email ?? null,
        envOverride: isEnvTokenOverride(),
      },
      repoConfig: fs.existsSync(getRepoConfigPath()),
      ingests: {
        count: ingests.length,
        latest: latest ? {
          id: latest.id,
          result: latest.result,
          confidence: latest.confidence,
          createdAt: latest.createdAt,
        } : null,
      },
      dashboard: dashboard?.companyHealth ?? null,
    }, null, 2))
    return
  }

  console.log('proxkey status')
  printRows([
    ['api', `${config.apiBaseUrl} (${api.status})`],
    ['auth', describeAuth(config)],
    ['repo config', fs.existsSync(getRepoConfigPath()) ? path.relative(process.cwd(), getRepoConfigPath()) : 'not configured'],
    ['ingests', latest ? `${ingests.length} saved, latest ${latest.id} ${latest.result} ${formatConfidence(latest.confidence)}` : 'none'],
    ['database', api.database],
    ['ai', api.ai],
  ])

  if (dashboard) {
    printRows([
      ['reports', dashboard.companyHealth.totalReports],
      ['open', dashboard.companyHealth.openReports],
      ['high severity', dashboard.companyHealth.highSeverity],
    ])
  }
}

async function handleWhoAmI(args: string[]): Promise<void> {
  const config = withApiBaseUrlOverride(loadConfig(), args)
  const me = await apiRequest<{ authenticated: boolean; user?: { email: string; role: string } }>(config, '/api/auth/me')
  if (!me.authenticated || !me.user) {
    throw new Error('Not authenticated.')
  }
  console.log(`${me.user.email} (${me.user.role})`)
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2))

  switch (command) {
    case 'help':
      await handleHelp()
      return
    case 'version':
      await handleVersion()
      return
    case 'login':
      await handleLogin(args)
      return
    case 'logout':
      await handleLogout(args)
      return
    case 'init':
      await handleInit(args)
      return
    case 'scan':
      await handleScan(args)
      return
    case 'ingest':
      await handleIngest(args)
      return
    case 'incident':
      await handleIncident(args)
      return
    case 'triage':
      await handleTriage('CLI', args)
      return
    case 'ci':
      if (args[0] === 'analyze') {
        await handleIncidentAnalyze(args.slice(1))
        return
      }
      await handleTriage('CI', args)
      return
    case 'auth':
      await handleAuth(args)
      return
    case 'config':
      await handleConfig(args)
      return
    case 'connect':
      await handleConnect(args)
      return
    case 'export':
      await handleExport(args)
      return
    case 'status':
      await handleStatus(args)
      return
    case 'whoami':
      await handleWhoAmI(args)
      return
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'proxkey failed')
  process.exit(1)
})
