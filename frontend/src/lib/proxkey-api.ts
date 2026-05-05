export type AuthUser = {
  id: string
  orgId: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE'
  status: 'ACTIVE' | 'INVITED' | 'DISABLED'
  user_metadata?: {
    full_name?: string | null
  }
}

export type PlanTier = 'FREE' | 'FOUNDER' | 'TEAM' | 'GROWTH' | 'ENTERPRISE'

export type InboxItem = {
  id: string
  title: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  component: string | null
  owner: string | null
  status: 'PROCESSING' | 'TRIAGED' | 'NEEDS_REVIEW' | 'ASSIGNED' | 'RESOLVED'
  confidence: number | null
  updatedAt: string
  source: 'CLI' | 'API' | 'CI' | 'MANUAL'
}

export type DashboardStats = {
  companyHealth: {
    totalReports: number
    openReports: number
    highSeverity: number
    avgConfidence: number
    avgTriageTimeMs: number
  }
  teamPerformance: {
    reportsPerEmployee: Array<{
      id: string
      name: string
      role: string
      reports: number
    }>
    reviewTimes: Array<{
      reportId: string
      title: string
      updatedAt: string
      status: string
    }>
    overloadedQueues: Array<{
      id: string
      name: string
      role: string
      reports: number
    }>
  }
  queueIntelligence: {
    severityDistribution: Record<string, number>
    duplicateClusters: number
    missingInfoRate: number
  }
  security: {
    redactions: number
    auditLogs: number
    riskyReports: number
  }
}

export type HealthSnapshot = {
  ok: boolean
  version: string
  database: 'ok' | 'error'
  ai: 'configured' | 'fallback'
  checkedAt: string
}

let inMemoryToken: string | null = null
let accessTokenProvider: null | (() => Promise<string | null>) = null

function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (configured) {
    return configured
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location
    if (['localhost', '127.0.0.1'].includes(hostname)) {
      return 'http://localhost:4000'
    }
    // Known production hosts — SPA may live on marketing or app subdomain; API is always api.proxkey.dev
    if (
      hostname === 'proxkey.dev' ||
      hostname === 'www.proxkey.dev' ||
      hostname === 'app.proxkey.dev'
    ) {
      return 'https://api.proxkey.dev'
    }
    // Any other deployment: API on same origin (works with Vite proxy / reverse proxy)
    return window.location.origin
  }

  return 'http://localhost:4000'
}

function getToken(): string | null {
  return inMemoryToken
}

export function setToken(token: string | null): void {
  inMemoryToken = token
}

export function setAccessTokenProvider(provider: null | (() => Promise<string | null>)): void {
  accessTokenProvider = provider
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')

  if (!(init.body instanceof FormData) && init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const token = (await accessTokenProvider?.().catch(() => null)) ?? getToken()
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const body = data as { error?: string; message?: string } | null
    const code = body?.error ?? 'Request failed'
    const detail = body?.message
    throw new Error(detail ? `${code}: ${detail}` : code)
  }

  return data as T
}

export const proxkeyApi = {
  async login(email: string, password: string) {
    const data = await request<{
      accessToken: string
      user: AuthUser
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    setToken(data.accessToken)
    return data
  },

  async register(
    name: string,
    organizationName: string,
    email: string,
    password: string,
    plan: PlanTier = 'FREE',
  ) {
    const data = await request<{
      accessToken: string
      user: AuthUser
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, organizationName, email, password, plan }),
    })

    setToken(data.accessToken)
    return data
  },

  async me() {
    return request<{
      authenticated: boolean
      user?: AuthUser
      organization?: {
        id: string
        name: string
        domain: string | null
        plan?: PlanTier
      } | null
      accessToken?: string
    }>('/api/me')
  },

  async logout() {
    await request('/api/auth/logout', {
      method: 'POST',
    })
    setToken(null)
  },

  async inbox() {
    return request<{
      items: InboxItem[]
      highSeverity: number
      needsReview: number
      missingInfo: number
      duplicateClusters: number
    }>('/api/dashboard/inbox')
  },

  async stats() {
    return request<DashboardStats>('/api/dashboard/stats')
  },

  async health() {
    return request<HealthSnapshot>('/api/health')
  },

  async billingPlan() {
    return request<{
      organization: {
        id: string
        name: string
        plan: PlanTier
        subscriptionStatus: string
        currentPeriodStart: string | null
        currentPeriodEnd: string | null
      }
      limits: {
        packets: number | null
        seats: number | null
        repos: number | null
      }
    }>('/api/billing/plan')
  },

  async billingUsage() {
    return request<{
      plan: PlanTier
      completedPackets: number
      packetLimit: number | null
      remainingPackets: number | null
      seatsUsed: number
    }>('/api/billing/usage')
  },

  async startCheckout(plan: Exclude<PlanTier, 'FREE' | 'ENTERPRISE'>) {
    return request<{ ok: boolean; code?: string; requestedPlan: PlanTier }>(
      '/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ plan }),
      },
    )
  },

  async requestPortal() {
    return request<{ ok: boolean; code?: string }>('/api/billing/portal', {
      method: 'POST',
    })
  },

  async createLead(body: {
    email: string
    role: string
    company: string
    painPoint: string
    teamSize?: string
    currentTools?: string[]
    estimatedMonthlyVolume?: string
  }) {
    return request<{ id: string; createdAt: string }>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async reports() {
    return request<{
      items: Array<{
        id: string
        title: string
        status: string
        updatedAt: string
        triageResult: null | {
          confidence: number
        }
      }>
    }>('/api/reports')
  },

  async report(id: string) {
    return request<{
      report: {
        id: string
        title: string
        source: string
        status: string
        createdAt: string
        updatedAt: string
        metadataJson: Record<string, unknown>
        triageResult: null | {
          summary: string
          severity: string
          component: string
          confidence: number
          needsReview: boolean
          requestMoreInfo: boolean
          nextAction: string
          suggestedOwner: string | null
          reproSteps: string[]
          missingInfo: string[]
          duplicateCandidates: Array<{ reportId: string; title: string; similarity: number }>
        }
      }
      project: null | {
        id: string
        name: string
        repoUrl: string | null
      }
      steps: Array<{
        id: string
        stepName: string
        durationMs: number
        output: unknown
        createdAt: string
      }>
      artifacts: Array<{
        id: string
        type: string
        content: string
      }>
    }>(`/api/reports/${id}`)
  },

  async triage(id: string) {
    return request<{
      triage: null | {
        id: string
        summary: string
        severity: string
        component: string
        confidence: number
        needsReview: boolean
        requestMoreInfo: boolean
        nextAction: string
        suggestedOwner: null | {
          id: string
          name: string
          email: string
        }
        reproSteps: string[]
        missingInfo: string[]
        duplicateCandidates: Array<{ reportId: string; title: string; similarity: number }>
      }
      steps: Array<{
        id: string
        stepName: string
        durationMs: number
        output: unknown
        createdAt: string
      }>
    }>(`/api/triage/${id}`)
  },

  async updateTriage(reportId: string, body: Record<string, unknown>) {
    return request(`/api/triage/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  async createEmployee(body: {
    name: string
    email: string
    role: 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE'
  }) {
    return request('/api/employees', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async employees() {
    return request<{
      items: AuthUser[]
    }>('/api/employees')
  },

  async updateEmployee(
    id: string,
    body: { name?: string; email?: string; role?: 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE' },
  ) {
    return request(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  async disableEmployee(id: string) {
    return request(`/api/employees/${id}`, {
      method: 'DELETE',
    })
  },

  async apiKeys() {
    return request<{
      items: Array<{
        id: string
        name: string
        keyPrefix: string
        scopesJson: string[]
        lastUsedAt: string | null
        expiresAt: string | null
        revokedAt: string | null
        createdAt: string
      }>
    }>('/api/api-keys')
  },

  async createApiKey(body: {
    name: string
    scopes?: Array<'packets:write' | 'packets:read' | 'usage:read'>
  }) {
    return request<{
      id: string
      name: string
      key: string
      keyPrefix: string
      scopesJson: string[]
      createdAt: string
    }>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async revokeApiKey(id: string) {
    return request<{ success: boolean }>(`/api/api-keys/${id}`, {
      method: 'DELETE',
    })
  },

  async createReport(body: {
    title: string
    rawText: string
    logs?: string
    source?: 'CLI' | 'API' | 'CI' | 'MANUAL'
    metadataJson?: Record<string, unknown>
  }) {
    return request<{ reportId: string; status: string }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async runDemo(body: {
    title: string
    rawText: string
    logs?: string
    metadataJson?: Record<string, unknown>
  }) {
    return request<{
      summary: string
      severity: string
      component: string
      reproSteps: string[]
      missingInfo: string[]
      nextAction: string
      confidence: number
      duplicateCandidates: Array<{ reportId: string; title: string; similarity: number }>
    }>('/api/demo/triage', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
