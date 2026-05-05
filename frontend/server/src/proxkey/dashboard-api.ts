import crypto from 'node:crypto'
import cookie from '@fastify/cookie'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  BuildConclusion,
  PlanTier,
  type PrismaClient,
  TestResultStatus,
  UserStatus,
  WasteFlagStatus,
  WasteFlagType,
} from '@prisma/client'
import { z } from 'zod'
import type { ProxKeyConfig } from './config'
import { upsertAuth0User, verifyAuth0AccessToken } from './auth'
import { daysAgo, getRepoDailySpend30d, getRepoWowMap, getSpendBreakdown, getSpendSummary, getWeeklySpendSeries } from './spend-queries'

function gravatarUrl(email: string): string {
  const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=128`
}

const COOKIE_NAME = 'pk_ci_dashboard'

type DashboardSession = {
  v: 1
  orgId: string
  githubLogin: string
}

function serializeSession(payload: DashboardSession, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function parseSessionToken(token: string, secret: string): DashboardSession | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) {
    return null
  }
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DashboardSession
    if (parsed?.v !== 1 || typeof parsed.orgId !== 'string' || typeof parsed.githubLogin !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function mapConclusion(c: BuildConclusion | null | undefined): 'success' | 'failure' | 'flaky' | 'cancelled' {
  if (c === BuildConclusion.SUCCESS) {
    return 'success'
  }
  if (c === BuildConclusion.FAILURE) {
    return 'failure'
  }
  if (c === BuildConclusion.FLAKY) {
    return 'flaky'
  }
  return 'cancelled'
}

function planBadge(plan: PlanTier): 'free' | 'team' | 'enterprise' {
  if (plan === PlanTier.FREE) {
    return 'free'
  }
  if (plan === PlanTier.ENTERPRISE) {
    return 'enterprise'
  }
  return 'team'
}

function wasteTypeString(t: string): string {
  return t
}

async function readSession(request: FastifyRequest, secret: string): Promise<DashboardSession | null> {
  const fromParsed = (request as { cookies?: Record<string, string | undefined> }).cookies?.[COOKIE_NAME]
  if (fromParsed) {
    return parseSessionToken(fromParsed, secret)
  }
  const raw = request.headers.cookie
  if (!raw) {
    return null
  }
  const match = raw
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_NAME}=`))
  if (!match) {
    return null
  }
  const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1))
  return parseSessionToken(value, secret)
}

function setSessionCookie(reply: FastifyReply, secret: string, session: DashboardSession): void {
  const value = serializeSession(session, secret)
  const maxAge = 60 * 60 * 24 * 30
  reply.setCookie(COOKIE_NAME, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge,
    signed: false,
  })
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' })
}

export async function registerDashboardApi(
  app: FastifyInstance,
  prisma: PrismaClient,
  config: ProxKeyConfig,
): Promise<void> {
  await app.register(cookie)

  const secret = config.dashboardSessionSecret

  async function requireOrg(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const session = await readSession(request, secret)
    if (!session) {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
      return null
    }
    const org = await prisma.organization.findUnique({ where: { id: session.orgId } })
    if (!org) {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
      return null
    }
    return org.id
  }

  // Public Auth0 config – consumed by the CLI to decide which login flow to use
  app.get('/api/auth/config', async () => {
    if (!config.AUTH0_DOMAIN || !config.AUTH0_AUDIENCE) {
      return { strategy: 'local' as const, auth0: null }
    }
    return {
      strategy: 'auth0' as const,
      auth0: {
        domain: config.AUTH0_DOMAIN,
        audience: config.AUTH0_AUDIENCE,
        cliClientId: config.AUTH0_CLI_CLIENT_ID ?? null,
        cliEnabled: Boolean(config.AUTH0_CLI_CLIENT_ID),
        scope: config.AUTH0_CLI_SCOPE,
      },
    }
  })

  // Bootstrap: called after Auth0 redirect to create/find the user's workspace
  app.post('/api/auth/bootstrap', async (request, reply) => {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!bearer) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' })
    }

    if (!config.AUTH0_DOMAIN || !config.AUTH0_AUDIENCE) {
      return reply.status(503).send({ error: 'AUTH0_NOT_CONFIGURED' })
    }

    let identity: { email: string; name: string; subject: string | null; auth0OrgId: string | null }
    try {
      identity = await verifyAuth0AccessToken({ accessToken: bearer, config })
    } catch {
      return reply.status(401).send({ error: 'INVALID_TOKEN' })
    }

    const body = z
      .object({
        name: z.string().trim().optional(),
        organizationName: z.string().trim().optional(),
        plan: z.enum(['FREE', 'FOUNDER', 'TEAM', 'GROWTH', 'ENTERPRISE']).optional(),
      })
      .parse(request.body)

    try {
      const user = await upsertAuth0User({
        subject: identity.subject,
        email: identity.email,
        name: body.name || identity.name,
        organizationName: body.organizationName,
        plan: body.plan as PlanTier | undefined,
        auth0OrgId: identity.auth0OrgId,
      })

      const org = await prisma.organization.findUnique({ where: { id: user.orgId } })
      return {
        authenticated: true,
        user: { email: user.email },
        organization: org ? { id: org.id, name: org.name } : null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bootstrap failed.'
      return reply.status(400).send({ error: 'BOOTSTRAP_FAILED', message })
    }
  })

  // /api/me – used by proxkeyApi.me() in the frontend AuthContext
  app.get('/api/me', async (request, reply) => {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim()

    if (bearer && config.AUTH0_DOMAIN && config.AUTH0_AUDIENCE) {
      try {
        const identity = await verifyAuth0AccessToken({ accessToken: bearer, config })
        const user = await prisma.user.findFirst({
          where: identity.subject
            ? { OR: [{ auth0UserId: identity.subject }, { email: identity.email }] }
            : { email: identity.email },
          include: { organization: true },
        })

        if (user && user.status !== UserStatus.DISABLED) {
          return {
            authenticated: true,
            user: {
              id: user.id,
              orgId: user.orgId,
              email: user.email,
              name: user.name,
              role: user.role,
              status: user.status,
            },
            organization: { id: user.organization.id, name: user.organization.name, domain: user.organization.domain },
          }
        }
      } catch {
        // Fall through to cookie auth
      }
    }

    // Cookie-based session fallback (GitHub OAuth flow)
    const session = await readSession(request, secret)
    if (session) {
      const org = await prisma.organization.findUnique({ where: { id: session.orgId } })
      if (org) {
        return {
          authenticated: true,
          user: {
            id: session.orgId,
            orgId: session.orgId,
            email: session.githubLogin,
            name: session.githubLogin,
            role: 'OWNER' as const,
            status: 'ACTIVE' as const,
          },
          organization: { id: org.id, name: org.name, domain: org.domain },
        }
      }
    }

    return reply.status(401).send({ authenticated: false })
  })

  // /api/auth/me – dashboard session check; supports both Auth0 Bearer and GitHub cookie
  app.get('/api/auth/me', async (request, reply) => {
    // Auth0 Bearer token path
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    if (bearer && config.AUTH0_DOMAIN && config.AUTH0_AUDIENCE) {
      try {
        const identity = await verifyAuth0AccessToken({ accessToken: bearer, config })
        const user = await prisma.user.findFirst({
          where: identity.subject
            ? { OR: [{ auth0UserId: identity.subject }, { email: identity.email }] }
            : { email: identity.email },
          include: { organization: true },
        })

        if (user && user.status !== UserStatus.DISABLED) {
          return {
            user: {
              login: user.name ?? user.email,
              avatarUrl: gravatarUrl(user.email),
            },
            organizations: [{ id: user.organization.id, name: user.organization.name }],
            currentOrganizationId: user.organization.id,
          }
        }
      } catch {
        // Fall through to cookie auth
      }
    }

    // GitHub OAuth cookie path
    const session = await readSession(request, secret)
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' })
    }
    const org = await prisma.organization.findUnique({ where: { id: session.orgId } })
    if (!org) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' })
    }
    const orgs = await prisma.organization.findMany({
      where: { id: session.orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return {
      user: {
        login: session.githubLogin,
        avatarUrl: `https://github.com/${session.githubLogin}.png`,
      },
      organizations: orgs,
      currentOrganizationId: org.id,
    }
  })

  app.get('/api/auth/github', async (_request, reply) => {
    const clientId = config.GITHUB_CLIENT_ID
    const redirectBase = config.frontendOrigins[0] ?? config.APP_URL
    const redirectUri = `${redirectBase.replace(/\/$/, '')}/github/callback`
    if (!clientId) {
      return reply.status(503).send({ error: 'GITHUB_NOT_CONFIGURED', message: 'GitHub OAuth client id missing' })
    }
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'read:user user:email')
    return reply.redirect(url.toString())
  })

  app.post('/api/auth/github/callback', async (request, reply) => {
    const body = z
      .object({
        code: z.string().min(1),
        installation_id: z.string().optional(),
      })
      .parse(request.body)

    let login = 'github-user'
    if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.GITHUB_CLIENT_ID,
          client_secret: config.GITHUB_CLIENT_SECRET,
          code: body.code,
        }),
      })
      const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string }
      if (tokenJson.access_token) {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: 'application/vnd.github+json' },
        })
        const userJson = (await userRes.json()) as { login?: string }
        if (userJson.login) {
          login = userJson.login
        }
      }
    }

    const org =
      (body.installation_id
        ? await prisma.organization.findFirst({ where: { githubInstallationId: body.installation_id } })
        : null) ?? (await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } }))

    if (!org) {
      return reply.status(400).send({ error: 'NO_ORGANIZATION', message: 'No organization found. Seed the database.' })
    }

    setSessionCookie(reply, secret, { v: 1, orgId: org.id, githubLogin: login })
    return { ok: true, provider: 'github', installationId: body.installation_id ?? null, next: '/dashboard' }
  })

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.post('/api/github/installations', async (request, reply) => {
    const body = z.object({ installation_id: z.coerce.string().min(1) }).parse(request.body)
    const session = await readSession(request, secret)
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' })
    }
    await prisma.organization.update({
      where: { id: session.orgId },
      data: { githubInstallationId: body.installation_id },
    })
    return { ok: true, next: '/dashboard' }
  })

  app.get('/api/spend/summary', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const summary = await getSpendSummary(prisma, orgId)
    return {
      monthlySpendCents: summary.totalSpendCents,
      buildCount: summary.buildCount,
      wowDeltaPercent: summary.wowDeltaPercent,
      currentWeekSpendCents: summary.currentWeekSpendCents,
      previousWeekSpendCents: summary.previousWeekSpendCents,
    }
  })

  app.get('/api/spend/breakdown', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const query = z.object({ groupBy: z.enum(['repo', 'team', 'author', 'workflow']).default('repo') }).parse(request.query)
    const breakdown = await getSpendBreakdown(prisma, orgId)
    const wow = await getRepoWowMap(prisma, orgId)

    if (query.groupBy === 'repo') {
      return {
        groupBy: 'repo' as const,
        rows: breakdown.byRepo.map((r) => ({
          repoId: r.repoId,
          repoName: r.repoName,
          spendCents: r.spendCents,
          buildCount: r.builds,
          avgCostCents: r.builds ? Math.round(r.spendCents / r.builds) : 0,
          wowDeltaPercent: wow.get(r.repoId) ?? 0,
        })),
      }
    }

    return { groupBy: query.groupBy, breakdown }
  })

  app.get('/api/spend/weekly', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const weeks = await getWeeklySpendSeries(prisma, orgId, 12)
    return { weeks }
  })

  app.get('/api/builds', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query)
    const items = await prisma.build.findMany({
      where: { orgId, deletedAt: null },
      include: {
        repo: { select: { id: true, name: true } },
        wasteFlags: { where: { status: WasteFlagStatus.ACTIVE } },
      },
      orderBy: { startedAt: 'desc' },
      take: q.limit,
    })

    return {
      items: items.map((b) => ({
        id: b.id,
        repoId: b.repoId,
        repoName: b.repo.name,
        prTitle: b.prNumber != null ? `PR #${b.prNumber}` : b.branch,
        prNumber: b.prNumber,
        author: b.triggeredBy ?? 'unknown',
        branch: b.branch,
        costCents: b.costCents,
        durationSeconds: b.durationSeconds ?? 0,
        conclusion: mapConclusion(b.conclusion),
        wasteFlags: b.wasteFlags.map((w) => wasteTypeString(w.type)),
        startedAt: b.startedAt.toISOString(),
      })),
    }
  })

  app.get('/api/repos', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const repos = await prisma.repo.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, name: true, defaultBranch: true },
      orderBy: { name: 'asc' },
    })
    return {
      items: repos.map((r) => ({
        id: r.id,
        name: r.name,
        provider: 'github_actions' as const,
        defaultBranch: r.defaultBranch,
      })),
    }
  })

  app.get('/api/repos/:repoId', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const params = z.object({ repoId: z.string().uuid() }).parse(request.params)
    const repo = await prisma.repo.findFirst({
      where: { id: params.repoId, orgId, deletedAt: null },
    })
    if (!repo) {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }

    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    const agg = await prisma.build.aggregate({
      where: { orgId, repoId: repo.id, deletedAt: null, startedAt: { gte: monthStart } },
      _sum: { costCents: true },
      _count: true,
    })
    const spendCents = agg._sum.costCents ?? 0
    const buildCount = agg._count
    const avgCostCents = buildCount ? Math.round(spendCents / buildCount) : 0

    const spend30d = await getRepoDailySpend30d(prisma, orgId, repo.id)

    const flags = await prisma.wasteFlag.findMany({
      where: { orgId, repoId: repo.id, deletedAt: null, status: WasteFlagStatus.ACTIVE },
      orderBy: { savingsCents: 'desc' },
    })

    return {
      id: repo.id,
      name: repo.name,
      provider: 'github_actions' as const,
      defaultBranch: repo.defaultBranch,
      spendCents,
      buildCount,
      avgCostCents,
      spend30d,
      wasteFlags: flags.map((f) => ({
        id: f.id,
        type: wasteTypeString(f.type),
        savingsCents: f.savingsCents,
        firstSeen: f.firstSeenAt.toISOString(),
        recommendation: f.recommendation,
        status: f.status === WasteFlagStatus.ACTIVE ? ('active' as const) : ('resolved' as const),
      })),
    }
  })

  const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })

  app.get('/api/repos/:repoId/builds', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const params = z.object({ repoId: z.string().uuid() }).parse(request.params)
    const query = paginationSchema.parse(request.query)
    const repo = await prisma.repo.findFirst({ where: { id: params.repoId, orgId, deletedAt: null } })
    if (!repo) {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }

    const [items, total] = await Promise.all([
      prisma.build.findMany({
        where: { orgId, repoId: repo.id, deletedAt: null },
        include: {
          repo: { select: { id: true, name: true } },
          wasteFlags: { where: { status: WasteFlagStatus.ACTIVE } },
          workflowJobs: { select: { id: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.build.count({ where: { orgId, repoId: repo.id, deletedAt: null } }),
    ])

    return {
      items: items.map((b) => ({
        id: b.id,
        prNumber: b.prNumber,
        prTitle: b.prNumber != null ? `PR #${b.prNumber}` : b.branch,
        author: b.triggeredBy ?? 'unknown',
        branch: b.branch,
        costCents: b.costCents,
        durationSeconds: b.durationSeconds ?? 0,
        jobCount: b.workflowJobs.length,
        conclusion: mapConclusion(b.conclusion),
        wasteFlagCount: b.wasteFlags.length,
        wasteFlags: b.wasteFlags.map((w) => wasteTypeString(w.type)),
        startedAt: b.startedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  })

  app.get('/api/waste', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const query = z
      .object({
        flagType: z.nativeEnum(WasteFlagType).optional(),
        repoId: z.string().uuid().optional(),
        status: z.enum(['active', 'resolved', 'all']).default('active'),
      })
      .parse(request.query)

    const whereStatus =
      query.status === 'all'
        ? undefined
        : query.status === 'resolved'
          ? WasteFlagStatus.RESOLVED
          : WasteFlagStatus.ACTIVE

    const flags = await prisma.wasteFlag.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(whereStatus ? { status: whereStatus } : {}),
        ...(query.repoId ? { repoId: query.repoId } : {}),
        ...(query.flagType ? { type: query.flagType } : {}),
      },
      include: {
        repo: { select: { id: true, name: true } },
        build: { select: { id: true, prNumber: true, branch: true, costCents: true } },
      },
      orderBy: { savingsCents: 'desc' },
    })

    return {
      items: flags.map((f) => ({
        id: f.id,
        type: wasteTypeString(f.type),
        repoId: f.repoId,
        repoName: f.repo.name,
        savingsCents: f.savingsCents,
        firstSeen: f.firstSeenAt.toISOString(),
        status: f.status === WasteFlagStatus.ACTIVE ? ('active' as const) : ('resolved' as const),
        recommendation: f.recommendation,
        affectedBuilds: f.build
          ? [`${f.build.branch}${f.build.prNumber != null ? ` #${f.build.prNumber}` : ''}`]
          : [],
      })),
    }
  })

  app.patch('/api/waste/:flagId/resolve', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const params = z.object({ flagId: z.string().uuid() }).parse(request.params)
    try {
      await prisma.wasteFlag.update({
        where: { id: params.flagId, orgId },
        data: { status: WasteFlagStatus.RESOLVED },
      })
    } catch {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }
    return { ok: true, id: params.flagId, status: 'resolved' as const }
  })

  app.get('/api/flaky-tests', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }

    const tests = await prisma.testResult.findMany({
      where: {
        build: {
          orgId,
          startedAt: { gte: daysAgo(30) },
        },
      },
      include: {
        build: {
          select: {
            costCents: true,
            repo: { select: { name: true } },
          },
        },
      },
    })

    const grouped = new Map<
      string,
      { testName: string; suite: string; repoName: string; runs: number; failures: number; wastedComputeCents: number; lastSeen: string }
    >()

    for (const test of tests) {
      const key = `${test.suite}:${test.name}`
      const entry = grouped.get(key) ?? {
        testName: test.name,
        suite: test.suite,
        repoName: test.build.repo.name,
        runs: 0,
        failures: 0,
        wastedComputeCents: 0,
        lastSeen: test.createdAt.toISOString(),
      }
      entry.runs += 1
      if (test.status === TestResultStatus.FAIL || test.status === TestResultStatus.FLAKY) {
        entry.failures += 1
        entry.wastedComputeCents += Math.max(1, Math.round(test.build.costCents * 0.1))
      }
      if (test.createdAt > new Date(entry.lastSeen)) {
        entry.lastSeen = test.createdAt.toISOString()
      }
      grouped.set(key, entry)
    }

    const rows = [...grouped.values()]
      .map((entry) => ({
        id: `${entry.suite}:${entry.testName}`,
        testName: entry.testName,
        suite: entry.suite,
        repoName: entry.repoName,
        flakyRate: entry.runs ? Number((entry.failures / entry.runs).toFixed(4)) : 0,
        wastedComputeCents: entry.wastedComputeCents,
        lastSeen: entry.lastSeen,
      }))
      .sort((a, b) => b.wastedComputeCents - a.wastedComputeCents)

    return { items: rows }
  })

  app.get('/api/settings', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: { repos: { where: { deletedAt: null }, select: { id: true, name: true } } },
    })
    const summary = await getSpendSummary(prisma, orgId)
    return {
      orgName: org.name,
      monthlyBudgetCents: org.monthlyBudgetCents ?? 0,
      digestEnabled: org.emailDigestEnabled,
      timezone: org.timezone,
      slackWebhookUrl: org.slackWebhookUrl ?? '',
      githubInstallationId: org.githubInstallationId,
      githubInstallationStatus: org.githubInstallationId ? ('connected' as const) : ('missing' as const),
      connectedRepos: org.repos,
      plan: planBadge(org.plan),
      monthlyUsageCents: summary.totalSpendCents,
      monthlyIncludedCents: org.plan === PlanTier.FREE ? 500_000 : 2_000_000,
    }
  })

  const settingsPatchSchema = z.object({
    monthlyBudgetCents: z.number().int().min(0).optional(),
    digestEnabled: z.boolean().optional(),
    timezone: z.string().min(1).optional(),
    slackWebhookUrl: z.string().optional(),
  })

  app.patch('/api/settings', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const body = settingsPatchSchema.parse(request.body)
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(body.monthlyBudgetCents !== undefined ? { monthlyBudgetCents: body.monthlyBudgetCents } : {}),
        ...(body.digestEnabled !== undefined ? { emailDigestEnabled: body.digestEnabled } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.slackWebhookUrl !== undefined ? { slackWebhookUrl: body.slackWebhookUrl || null } : {}),
      },
    })
    return { ok: true }
  })

  app.post('/api/settings/slack-test', async (request, reply) => {
    const orgId = await requireOrg(request, reply)
    if (!orgId) {
      return
    }
    const body = z.object({ webhookUrl: z.string().url() }).parse(request.body)
    const res = await fetch(body.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'ProxKey: Slack webhook test from dashboard.' }),
    })
    if (!res.ok) {
      return reply.status(502).send({ error: 'SLACK_WEBHOOK_FAILED', status: res.status })
    }
    return { ok: true }
  })

  // ── API Keys ─────────────────────────────────────────────────────────────────
  // Keys are formatted as pk_live_<random> and stored as a SHA-256 hash.
  // The raw key is returned only on creation; it cannot be retrieved again.

  function generateApiKey(): { raw: string; prefix: string; hash: string } {
    const entropy = crypto.randomBytes(32).toString('hex')
    const raw = `pk_live_${entropy}`
    const prefix = raw.slice(0, 16)
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    return { raw, prefix, hash }
  }

  async function requireOrgWithUser(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ orgId: string; userId: string } | null> {
    // Try Auth0 bearer first
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    if (bearer && config.AUTH0_DOMAIN && config.AUTH0_AUDIENCE) {
      try {
        const identity = await verifyAuth0AccessToken({ accessToken: bearer, config })
        const user = await prisma.user.findFirst({
          where: identity.subject
            ? { OR: [{ auth0UserId: identity.subject }, { email: identity.email }] }
            : { email: identity.email },
        })
        if (user && user.status !== UserStatus.DISABLED) {
          return { orgId: user.orgId, userId: user.id }
        }
      } catch {
        // fall through to cookie
      }
    }
    // Cookie session
    const session = await readSession(request, secret)
    if (!session) {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
      return null
    }
    const org = await prisma.organization.findUnique({ where: { id: session.orgId } })
    if (!org) {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
      return null
    }
    // For cookie-only sessions find the org owner user
    const owner = await prisma.user.findFirst({
      where: { orgId: session.orgId, status: UserStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
    })
    if (!owner) {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
      return null
    }
    return { orgId: org.id, userId: owner.id }
  }

  app.get('/api/api-keys', async (request, reply) => {
    const ctx = await requireOrgWithUser(request, reply)
    if (!ctx) {
      return
    }
    const keys = await prisma.apiKey.findMany({
      where: { orgId: ctx.orgId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopesJson: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    })
    return {
      items: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopesJson: Array.isArray(k.scopesJson) ? k.scopesJson : [],
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        revokedAt: null,
      })),
    }
  })

  app.post('/api/api-keys', async (request, reply) => {
    const ctx = await requireOrgWithUser(request, reply)
    if (!ctx) {
      return
    }
    const body = z
      .object({
        name: z.string().trim().min(1).max(100),
        scopes: z.array(z.string()).default([]),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(request.body)

    const { raw, prefix, hash } = generateApiKey()
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        orgId: ctx.orgId,
        createdByUserId: ctx.userId,
        name: body.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopesJson: body.scopes,
        expiresAt,
      },
    })

    reply.status(201)
    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      keyPrefix: apiKeyRecord.keyPrefix,
      scopesJson: body.scopes,
      createdAt: apiKeyRecord.createdAt.toISOString(),
      expiresAt: apiKeyRecord.expiresAt?.toISOString() ?? null,
      // Raw key is only returned on creation; it cannot be retrieved again
      key: raw,
    }
  })

  app.delete('/api/api-keys/:keyId', async (request, reply) => {
    const ctx = await requireOrgWithUser(request, reply)
    if (!ctx) {
      return
    }
    const params = z.object({ keyId: z.string().uuid() }).parse(request.params)
    try {
      await prisma.apiKey.update({
        where: { id: params.keyId, orgId: ctx.orgId },
        data: { revokedAt: new Date() },
      })
    } catch {
      return reply.status(404).send({ error: 'NOT_FOUND' })
    }
    return { ok: true, id: params.keyId, status: 'revoked' as const }
  })
}
