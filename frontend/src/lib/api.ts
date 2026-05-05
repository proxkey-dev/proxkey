import { getActiveOrgId } from './activeOrg'

const rawBase = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  ''
).replace(/\/$/, '')

/**
 * API origin for browser calls (production uses https://api.proxkey.dev when unset).
 */
export function apiOrigin(): string {
  if (rawBase) {
    return rawBase
  }
  if (typeof window !== 'undefined') {
    const { hostname } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000'
    }
    if (
      hostname === 'proxkey.dev' ||
      hostname === 'www.proxkey.dev' ||
      hostname === 'app.proxkey.dev'
    ) {
      return 'https://api.proxkey.dev'
    }
  }
  return ''
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = apiOrigin()
  return base ? `${base}${p}` : p
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
  })

  if (res.status === 401) {
    if (path !== '/api/auth/me') {
      onUnauthorized?.()
    }
    const body = await safeJson(res)
    throw new ApiError('Unauthorized', 401, body)
  }

  if (res.status >= 500) {
    const body = await safeJson(res)
    throw new ApiError('Server error', res.status, body)
  }

  if (!res.ok) {
    const body = await safeJson(res)
    throw new ApiError(`Request failed (${res.status})`, res.status, body)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function orgPath(orgId: string, suffix: string): string {
  const base = `/api/orgs/${orgId}`
  if (!suffix || suffix === '/') {
    return base
  }
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
}

function requireOrgId(): string {
  const id = getActiveOrgId()
  if (!id) {
    throw new ApiError('No active organization', 400, null)
  }
  return id
}

/** ---------- Auth ---------- */
export type AuthMeResponse = {
  user: { login: string; avatarUrl: string }
  organizations: Array<{ id: string; name: string }>
  currentOrganizationId: string
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  return apiRequest<AuthMeResponse>('/api/auth/me')
}

export type AuthCapabilities = { githubOAuth: boolean }

/** Used to avoid full-page navigation to `/api/auth/github` when it would return JSON (OAuth not configured). */
export async function getAuthCapabilities(): Promise<AuthCapabilities> {
  try {
    const res = await fetch(apiUrl('/api/auth/capabilities'), { credentials: 'include' })
    if (!res.ok) {
      return { githubOAuth: false }
    }
    const data = (await res.json()) as { githubOAuth?: boolean }
    return { githubOAuth: Boolean(data.githubOAuth) }
  } catch {
    return { githubOAuth: false }
  }
}

export function postLogout(): Promise<{ ok: boolean }> {
  return apiRequest('/api/auth/logout', { method: 'POST' })
}

export function postGitHubInstallation(body: { installation_id: string }): Promise<{ ok: boolean; next: string }> {
  return apiRequest('/api/github/installations', { method: 'POST', body: JSON.stringify(body) })
}

/** ---------- Spend / builds ---------- */
export type SpendSummary = {
  monthlySpendCents: number
  buildCount: number
  wowDeltaPercent: number
  currentWeekSpendCents: number
  previousWeekSpendCents: number
}

type ApiSpendSummary = {
  thisMonthCents: number
  buildCountThisMonth: number
  wowWeekOverWeekPercent: number
  currentWeekCents: number
  previousWeekCents: number
}

export async function getSpendSummary(): Promise<SpendSummary> {
  const orgId = requireOrgId()
  const data = await apiRequest<ApiSpendSummary>(orgPath(orgId, '/spend/summary'))
  return {
    monthlySpendCents: data.thisMonthCents,
    buildCount: data.buildCountThisMonth,
    wowDeltaPercent: data.wowWeekOverWeekPercent,
    currentWeekSpendCents: data.currentWeekCents,
    previousWeekSpendCents: data.previousWeekCents,
  }
}

export type RepoBreakdownRow = {
  repoId: string
  repoName: string
  spendCents: number
  buildCount: number
  avgCostCents: number
  wowDeltaPercent: number
}

type ApiBreakdownRow = {
  repoId?: string
  repoName?: string
  label: string
  costCents: number
  buildCount: number
  avgCostCents: number
  deltaPercent: number
}

export async function getSpendBreakdownRepos(): Promise<{ groupBy: 'repo'; rows: RepoBreakdownRow[] }> {
  const orgId = requireOrgId()
  const data = await apiRequest<{ rows: ApiBreakdownRow[]; groupBy: string }>(
    `${orgPath(orgId, '/spend/breakdown')}?groupBy=repo&period=30d`,
  )
  return {
    groupBy: 'repo',
    rows: data.rows.map((r) => ({
      repoId: r.repoId ?? r.label,
      repoName: r.repoName ?? r.label,
      spendCents: r.costCents,
      buildCount: r.buildCount,
      avgCostCents: r.avgCostCents,
      wowDeltaPercent: r.deltaPercent,
    })),
  }
}

export type WeeklySpendPoint = { weekStart: string; weekLabel: string; spendCents: number }

export async function getWeeklySpend(): Promise<{ weeks: WeeklySpendPoint[] }> {
  const orgId = requireOrgId()
  const data = await apiRequest<{ weeklyTrend: Array<{ week: string; cents: number }> }>(
    orgPath(orgId, '/spend/summary'),
  )
  const weeks = data.weeklyTrend.map((w) => {
    const d = new Date(`${w.week}T12:00:00.000Z`)
    return {
      weekStart: d.toISOString(),
      weekLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      spendCents: w.cents,
    }
  })
  return { weeks }
}

export type BuildFeedItem = {
  id: string
  repoId: string
  repoName: string
  prTitle: string
  prNumber: number | null
  author: string
  branch: string
  costCents: number
  durationSeconds: number
  conclusion: 'success' | 'failure' | 'flaky' | 'cancelled'
  wasteFlags: string[]
  startedAt: string
}

function mapConclusion(c: string | null | undefined): BuildFeedItem['conclusion'] {
  if (c === 'SUCCESS') {
    return 'success'
  }
  if (c === 'FAILURE' || c === 'TIMED_OUT') {
    return 'failure'
  }
  if (c === 'FLAKY') {
    return 'flaky'
  }
  return 'cancelled'
}

export async function getBuildFeed(limit: number): Promise<{ items: BuildFeedItem[] }> {
  const orgId = requireOrgId()
  const data = await apiRequest<{
    rows: Array<{
      id: string
      branch: string
      prNumber: number | null
      prTitle: string | null
      triggeredBy: string | null
      conclusion: string | null
      costCents: number
      durationSeconds: number | null
      startedAt: string
      repo: { id: string; name: string }
      wasteFlagCount: number
    }>
  }>(`${orgPath(orgId, '/builds')}?page=1&limit=${limit}`)

  return {
    items: data.rows.map((b) => ({
      id: b.id,
      repoId: b.repo.id,
      repoName: b.repo.name,
      prTitle:
        (b.prTitle && b.prTitle.trim()) ||
        (b.prNumber != null ? `PR #${b.prNumber}` : b.branch),
      prNumber: b.prNumber,
      author: b.triggeredBy ?? 'unknown',
      branch: b.branch,
      costCents: b.costCents,
      durationSeconds: b.durationSeconds ?? 0,
      conclusion: mapConclusion(b.conclusion),
      wasteFlags: [],
      startedAt: typeof b.startedAt === 'string' ? b.startedAt : new Date(b.startedAt).toISOString(),
    })),
  }
}

/** ---------- Repos ---------- */
export type RepoListItem = { id: string; name: string; provider: 'github_actions'; defaultBranch: string }

export async function getRepos(): Promise<{ items: RepoListItem[] }> {
  const orgId = requireOrgId()
  const data = await apiRequest<{
    rows: Array<{
      id: string
      name: string
      defaultBranch: string
      provider: string
    }>
  }>(orgPath(orgId, '/repos'))

  return {
    items: data.rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider: 'github_actions' as const,
      defaultBranch: r.defaultBranch,
    })),
  }
}

export type RepoDetailResponse = {
  id: string
  name: string
  provider: 'github_actions'
  defaultBranch: string
  spendCents: number
  buildCount: number
  avgCostCents: number
  spend30d: Array<{ day: string; spendCents: number }>
  wasteFlags: Array<{
    id: string
    type: string
    savingsCents: number
    firstSeen: string
    recommendation: string
    status: 'active' | 'resolved'
  }>
}

export async function getRepoDetail(repoId: string): Promise<RepoDetailResponse> {
  const orgId = requireOrgId()
  const [repos, spend, waste] = await Promise.all([
    apiRequest<{
      rows: Array<{
        id: string
        name: string
        defaultBranch: string
        monthlySpendCents: number
        buildCount: number
      }>
    }>(orgPath(orgId, '/repos')),
    apiRequest<{
      buckets: Array<{ date: string; costCents: number }>
      repo: { id: string; name: string }
    }>(orgPath(orgId, `/repos/${repoId}/spend`)),
    apiRequest<{
      rows: Array<{
        id: string
        type: string
        savingsEstimateCents: number
        createdAt: string
        resolvedAt: string | null
        details: unknown
        build: { repo: { id: string } } | null
      }>
    }>(orgPath(orgId, '/waste')),
  ])

  const meta = repos.rows.find((r) => r.id === repoId)
  if (!meta) {
    throw new ApiError('Repository not found', 404, null)
  }

  const spend30d = spend.buckets.map((b) => ({
    day: b.date.slice(0, 10),
    spendCents: b.costCents,
  }))

  const avgCostCents =
    meta.buildCount > 0 ? Math.round(meta.monthlySpendCents / meta.buildCount) : 0

  const flagsForRepo = waste.rows.filter((w) => w.build?.repo.id === repoId)

  return {
    id: meta.id,
    name: meta.name,
    provider: 'github_actions',
    defaultBranch: meta.defaultBranch,
    spendCents: meta.monthlySpendCents,
    buildCount: meta.buildCount,
    avgCostCents,
    spend30d,
    wasteFlags: flagsForRepo.map((f) => ({
      id: f.id,
      type: f.type,
      savingsCents: f.savingsEstimateCents,
      firstSeen: f.createdAt,
      recommendation:
        typeof f.details === 'object' && f.details !== null && 'text' in f.details
          ? String((f.details as { text?: string }).text ?? '')
          : JSON.stringify(f.details ?? {}),
      status: f.resolvedAt ? 'resolved' : 'active',
    })),
  }
}

export type RepoBuildRow = {
  id: string
  prNumber: number | null
  prTitle: string
  author: string
  branch: string
  costCents: number
  durationSeconds: number
  jobCount: number
  conclusion: 'success' | 'failure' | 'flaky' | 'cancelled'
  wasteFlagCount: number
  wasteFlags: string[]
  startedAt: string
}

export async function getRepoBuilds(repoId: string, page: number, pageSize: number): Promise<{
  items: RepoBuildRow[]
  page: number
  pageSize: number
  total: number
}> {
  const orgId = requireOrgId()
  const data = await apiRequest<{
    rows: Array<{
      id: string
      branch: string
      prNumber: number | null
      prTitle: string | null
      triggeredBy: string | null
      conclusion: string | null
      costCents: number
      durationSeconds: number | null
      jobCount: number
      wasteFlagCount: number
      startedAt: string
    }>
    page: number
    limit: number
    total: number
  }>(`${orgPath(orgId, '/builds')}?repoId=${encodeURIComponent(repoId)}&page=${page}&limit=${pageSize}`)

  return {
    items: data.rows.map((b) => ({
      id: b.id,
      prNumber: b.prNumber,
      prTitle:
        (b.prTitle && b.prTitle.trim()) ||
        (b.prNumber != null ? `PR #${b.prNumber}` : b.branch),
      author: b.triggeredBy ?? 'unknown',
      branch: b.branch,
      costCents: b.costCents,
      durationSeconds: b.durationSeconds ?? 0,
      jobCount: b.jobCount,
      conclusion: mapConclusion(b.conclusion),
      wasteFlagCount: b.wasteFlagCount,
      wasteFlags: [],
      startedAt: typeof b.startedAt === 'string' ? b.startedAt : new Date(b.startedAt).toISOString(),
    })),
    page: data.page,
    pageSize: data.limit,
    total: data.total,
  }
}

/** ---------- Waste ---------- */
export type WasteFlagItem = {
  id: string
  type: string
  repoId: string
  repoName: string
  savingsCents: number
  firstSeen: string
  status: 'active' | 'resolved'
  recommendation: string
  affectedBuilds: string[]
}

export async function getWasteFlags(params: {
  flagType?: string
  repoId?: string
  status: 'active' | 'resolved' | 'all'
}): Promise<{ items: WasteFlagItem[] }> {
  const orgId = requireOrgId()
  const data = await apiRequest<{
    rows: Array<{
      id: string
      type: string
      savingsEstimateCents: number
      createdAt: string
      resolvedAt: string | null
      details: unknown
      build: {
        branch: string
        prNumber: number | null
        repo: { id: string; name: string }
      } | null
    }>
  }>(orgPath(orgId, '/waste'))

  let rows = data.rows.map((f) => {
    const active = f.resolvedAt == null
    return {
      id: f.id,
      type: f.type,
      repoId: f.build?.repo.id ?? '',
      repoName: f.build?.repo.name ?? '',
      savingsCents: f.savingsEstimateCents,
      firstSeen: f.createdAt,
      status: active ? ('active' as const) : ('resolved' as const),
      recommendation:
        typeof f.details === 'object' && f.details !== null && 'text' in f.details
          ? String((f.details as { text?: string }).text ?? '')
          : '',
      affectedBuilds: f.build
        ? [`${f.build.branch}${f.build.prNumber != null ? ` #${f.build.prNumber}` : ''}`]
        : [],
    }
  })

  if (params.status === 'active') {
    rows = rows.filter((r) => r.status === 'active')
  } else if (params.status === 'resolved') {
    rows = rows.filter((r) => r.status === 'resolved')
  }

  if (params.flagType) {
    rows = rows.filter((r) => r.type === params.flagType)
  }
  if (params.repoId) {
    rows = rows.filter((r) => r.repoId === params.repoId)
  }

  return { items: rows }
}

export async function resolveWasteFlag(flagId: string): Promise<{ ok: boolean }> {
  const orgId = requireOrgId()
  await apiRequest(orgPath(orgId, `/waste/${flagId}/resolve`), { method: 'PATCH', body: '{}' })
  return { ok: true }
}

/** ---------- Flaky ---------- */
export type FlakyTestRow = {
  id: string
  testName: string
  suite: string
  repoName: string
  flakyRate: number
  wastedComputeCents: number
  lastSeen: string
}

export async function getFlakyTests(): Promise<{ items: FlakyTestRow[] }> {
  const orgId = requireOrgId()
  const data = await apiRequest<{
    rows: Array<{
      testName: string
      suite: string
      repoName: string
      flakyCount30d: number
      estimatedWasteCents: number
      lastSeen: string
    }>
  }>(orgPath(orgId, '/flaky-tests'))

  return {
    items: data.rows.map((r) => ({
      id: `${r.suite}::${r.testName}::${r.repoName}`,
      testName: r.testName,
      suite: r.suite,
      repoName: r.repoName,
      flakyRate: Math.min(1, r.flakyCount30d / 100),
      wastedComputeCents: r.estimatedWasteCents,
      lastSeen: r.lastSeen,
    })),
  }
}

/** ---------- Settings ---------- */
export type SettingsResponse = {
  orgName: string
  monthlyBudgetCents: number
  digestEnabled: boolean
  timezone: string
  slackWebhookUrl: string
  githubInstallationId: string | null
  githubInstallationStatus: 'connected' | 'missing'
  connectedRepos: Array<{ id: string; name: string }>
  plan: 'free' | 'team' | 'enterprise'
  monthlyUsageCents: number
  monthlyIncludedCents: number
}

function mapPlan(p: string): SettingsResponse['plan'] {
  if (p === 'FREE') {
    return 'free'
  }
  if (p === 'ENTERPRISE') {
    return 'enterprise'
  }
  return 'team'
}

export async function getSettings(): Promise<SettingsResponse> {
  const orgId = requireOrgId()
  const [org, repos, spendSnap] = await Promise.all([
    apiRequest<{
      id: string
      name: string
      plan: string
      githubInstallationId: string | null
      monthlyBudgetCents: number | null
      slackWebhookUrl: string | null
      digestEnabled: boolean
      digestCronTimezone: string
    }>(orgPath(orgId, '/')),
    apiRequest<{ rows: Array<{ id: string; name: string }> }>(orgPath(orgId, '/repos')),
    apiRequest<ApiSpendSummary>(orgPath(orgId, '/spend/summary')).catch(() => null),
  ])

  const usage = spendSnap?.thisMonthCents ?? 0

  return {
    orgName: org.name,
    monthlyBudgetCents: org.monthlyBudgetCents ?? 0,
    digestEnabled: org.digestEnabled,
    timezone: org.digestCronTimezone,
    slackWebhookUrl: org.slackWebhookUrl ?? '',
    githubInstallationId: org.githubInstallationId,
    githubInstallationStatus: org.githubInstallationId ? 'connected' : 'missing',
    connectedRepos: repos.rows.map((r) => ({ id: r.id, name: r.name })),
    plan: mapPlan(org.plan),
    monthlyUsageCents: usage,
    monthlyIncludedCents: org.plan === 'FREE' ? 500_000 : 2_000_000,
  }
}

export async function patchSettings(body: Partial<{
  monthlyBudgetCents: number
  digestEnabled: boolean
  timezone: string
  slackWebhookUrl: string
}>): Promise<{ ok: boolean }> {
  const orgId = requireOrgId()
  const payload: Record<string, unknown> = {}
  if (body.monthlyBudgetCents !== undefined) {
    payload.monthlyBudgetCents = body.monthlyBudgetCents
  }
  if (body.digestEnabled !== undefined) {
    payload.digestEnabled = body.digestEnabled
  }
  if (body.timezone !== undefined) {
    payload.digestCronTimezone = body.timezone
  }
  if (body.slackWebhookUrl !== undefined) {
    payload.slackWebhookUrl = body.slackWebhookUrl || null
  }
  await apiRequest(orgPath(orgId, ''), { method: 'PATCH', body: JSON.stringify(payload) })
  return { ok: true }
}

export async function postSlackTest(webhookUrl: string): Promise<{ ok: boolean }> {
  const orgId = requireOrgId()
  return apiRequest(orgPath(orgId, '/integrations/slack/test'), {
    method: 'POST',
    body: JSON.stringify({ webhookUrl }),
  })
}
