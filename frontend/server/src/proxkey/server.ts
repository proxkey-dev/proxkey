import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import {
  BuildConclusion,
  CiProvider,
  type PrismaClient,
  TestResultStatus,
  WasteFlagStatus,
} from '@prisma/client'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { z } from 'zod'
import { calculateDurationSeconds, calculateGitHubActionsCostCents, normalizeBuildConclusion, parseGitHubRunnerType, parseRunnerSize } from './ci-cost'
import { createCostAttributionQueue } from './ci-queue'
import { runCostAttribution } from './cost-attribution'
import { loadConfig, type ProxKeyConfig } from './config'
import { prisma as defaultPrisma } from './db'
import { registerDashboardApi } from './dashboard-api'
import { getRepoDisplayName, type GitHubWebhookPayload, verifyGitHubSignature } from './github-webhook'
import { daysAgo, getSpendBreakdown, getSpendSummary } from './spend-queries'

type ServerInstance = FastifyInstance & {
  config: ProxKeyConfig
}

type RawBodyRequest = FastifyRequest & {
  rawBody?: Buffer
}

type RateBucket = {
  count: number
  resetAt: number
}

const orgParamsSchema = z.object({
  orgId: z.string().uuid(),
})

const repoBuildsParamsSchema = z.object({
  orgId: z.string().uuid(),
  repoId: z.string().uuid(),
})

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

function getHeaderString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

async function resolveWebhookOrganization(prisma: PrismaClient, payload: GitHubWebhookPayload) {
  const installationId = payload.installation?.id?.toString()
  const accountName = payload.installation?.account?.login ?? payload.organization?.login ?? payload.repository?.owner?.login ?? 'GitHub'

  if (installationId) {
    const existing = await prisma.organization.findUnique({
      where: { githubInstallationId: installationId },
    })

    if (existing) {
      return existing
    }
  }

  return prisma.organization.create({
    data: {
      name: accountName,
      githubInstallationId: installationId,
      plan: 'FREE',
    },
  })
}

async function upsertRepository(prisma: PrismaClient, orgId: string, payload: GitHubWebhookPayload) {
  if (!payload.repository) {
    throw new Error('GitHub webhook missing repository')
  }

  return prisma.repo.upsert({
    where: {
      provider_externalId: {
        provider: CiProvider.GITHUB_ACTIONS,
        externalId: payload.repository.id.toString(),
      },
    },
    update: {
      orgId,
      name: getRepoDisplayName(payload.repository),
      defaultBranch: payload.repository.default_branch ?? 'main',
      deletedAt: null,
    },
    create: {
      orgId,
      name: getRepoDisplayName(payload.repository),
      provider: CiProvider.GITHUB_ACTIONS,
      externalId: payload.repository.id.toString(),
      defaultBranch: payload.repository.default_branch ?? 'main',
    },
  })
}

async function handleWorkflowRun(prisma: PrismaClient, payload: GitHubWebhookPayload) {
  if (!payload.workflow_run) {
    return null
  }

  const org = await resolveWebhookOrganization(prisma, payload)
  const repo = await upsertRepository(prisma, org.id, payload)
  const startedAt = payload.workflow_run.run_started_at ?? payload.workflow_run.created_at ?? new Date().toISOString()
  const finishedAt = payload.workflow_run.updated_at ?? null
  const conclusion = normalizeBuildConclusion(payload.workflow_run.conclusion)
  const durationSeconds = calculateDurationSeconds(startedAt, finishedAt)

  return prisma.build.upsert({
    where: {
      provider_externalId: {
        provider: CiProvider.GITHUB_ACTIONS,
        externalId: payload.workflow_run.id.toString(),
      },
    },
    update: {
      orgId: org.id,
      repoId: repo.id,
      branch: payload.workflow_run.head_branch ?? repo.defaultBranch,
      prNumber: payload.workflow_run.pull_requests?.[0]?.number,
      triggeredBy: payload.workflow_run.actor?.login,
      status: payload.workflow_run.status ?? 'unknown',
      finishedAt: finishedAt ? new Date(finishedAt) : undefined,
      durationSeconds,
      conclusion: conclusion ? BuildConclusion[conclusion] : undefined,
      deletedAt: null,
    },
    create: {
      provider: CiProvider.GITHUB_ACTIONS,
      externalId: payload.workflow_run.id.toString(),
      orgId: org.id,
      repoId: repo.id,
      branch: payload.workflow_run.head_branch ?? repo.defaultBranch,
      prNumber: payload.workflow_run.pull_requests?.[0]?.number,
      triggeredBy: payload.workflow_run.actor?.login,
      status: payload.workflow_run.status ?? 'unknown',
      startedAt: new Date(startedAt),
      finishedAt: finishedAt ? new Date(finishedAt) : undefined,
      durationSeconds,
      conclusion: conclusion ? BuildConclusion[conclusion] : undefined,
    },
  })
}

async function handleWorkflowJob(prisma: PrismaClient, payload: GitHubWebhookPayload) {
  if (!payload.workflow_job) {
    return null
  }

  const org = await resolveWebhookOrganization(prisma, payload)
  const repo = await upsertRepository(prisma, org.id, payload)
  const runnerType = parseGitHubRunnerType(payload.workflow_job.labels)
  const runnerSize = parseRunnerSize(payload.workflow_job.labels)
  const durationSeconds = calculateDurationSeconds(payload.workflow_job.started_at, payload.workflow_job.completed_at)
  const costCents = calculateGitHubActionsCostCents({
    runnerType,
    startedAt: payload.workflow_job.started_at,
    finishedAt: payload.workflow_job.completed_at,
  })
  const conclusion = normalizeBuildConclusion(payload.workflow_job.conclusion)

  const build = await prisma.build.upsert({
    where: {
      provider_externalId: {
        provider: CiProvider.GITHUB_ACTIONS,
        externalId: payload.workflow_job.run_id.toString(),
      },
    },
    update: {
      orgId: org.id,
      repoId: repo.id,
      status: payload.workflow_job.status ?? 'unknown',
    },
    create: {
      provider: CiProvider.GITHUB_ACTIONS,
      externalId: payload.workflow_job.run_id.toString(),
      orgId: org.id,
      repoId: repo.id,
      branch: repo.defaultBranch,
      status: payload.workflow_job.status ?? 'unknown',
      startedAt: payload.workflow_job.started_at ? new Date(payload.workflow_job.started_at) : new Date(),
      runnerType,
      runnerSize,
    },
  })

  await prisma.workflowJob.upsert({
    where: {
      buildId_externalId: {
        buildId: build.id,
        externalId: payload.workflow_job.id.toString(),
      },
    },
    update: {
      name: payload.workflow_job.name,
      startedAt: payload.workflow_job.started_at ? new Date(payload.workflow_job.started_at) : undefined,
      finishedAt: payload.workflow_job.completed_at ? new Date(payload.workflow_job.completed_at) : undefined,
      durationSeconds,
      costCents,
      runnerType,
      runnerSize,
      conclusion: conclusion ? BuildConclusion[conclusion] : undefined,
      deletedAt: null,
    },
    create: {
      buildId: build.id,
      externalId: payload.workflow_job.id.toString(),
      name: payload.workflow_job.name,
      startedAt: payload.workflow_job.started_at ? new Date(payload.workflow_job.started_at) : undefined,
      finishedAt: payload.workflow_job.completed_at ? new Date(payload.workflow_job.completed_at) : undefined,
      durationSeconds,
      costCents,
      runnerType,
      runnerSize,
      conclusion: conclusion ? BuildConclusion[conclusion] : undefined,
    },
  })

  return build
}

export async function createServer(options: { prisma?: PrismaClient; config?: ProxKeyConfig } = {}): Promise<ServerInstance> {
  const config = options.config ?? loadConfig()
  const prisma = options.prisma ?? defaultPrisma
  const queue = createCostAttributionQueue(config, (job) => runCostAttribution(prisma, job))
  const rateBuckets = new Map<string, RateBucket>()

  const app = Fastify({
    bodyLimit: 1_000_000,
    logger: {
      level: config.LOG_LEVEL,
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
    requestIdHeader: 'x-request-id',
  }) as unknown as ServerInstance

  app.config = config

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body)
    ;(request as RawBodyRequest).rawBody = rawBody

    try {
      done(null, rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {})
    } catch (error) {
      done(error instanceof Error ? error : new Error('Invalid JSON body'), undefined)
    }
  })

  await app.register(helmet)
  // Canonical production frontends are always allowed even if CORS_ALLOWED_ORIGINS
  // is misconfigured — without this the SPA can't call /api/me or the dashboard API.
  const ALWAYS_ALLOWED_ORIGINS = [
    'https://proxkey.dev',
    'https://www.proxkey.dev',
  ]
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }
      if (
        config.frontendOrigins.includes(origin) ||
        ALWAYS_ALLOWED_ORIGINS.includes(origin)
      ) {
        callback(null, true)
        return
      }
      // Reject without an Error so the response is a clean 200 with no CORS
      // headers (browser will block it) instead of a 500 Internal Server Error.
      callback(null, false)
    },
  })

  await registerDashboardApi(app, prisma, config)

  app.addHook('onRequest', async (request, reply) => {
    const key = request.ip
    const now = Date.now()
    const bucket = rateBuckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })
      return
    }

    bucket.count += 1
    if (bucket.count > 100) {
      return reply.status(429).send({ error: 'RATE_LIMITED', message: 'Rate limit exceeded' })
    }
  })

  const BUILD_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.BUILD_VERSION ?? 'dev'

  app.get('/health', async (_request, reply) => {
    let dbStatus: 'ok' | 'error' = 'ok'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }
    const healthy = dbStatus === 'ok'
    reply.status(healthy ? 200 : 503)
    return {
      ok: healthy,
      status: healthy ? 'ok' : 'degraded',
      version: BUILD_VERSION,
      uptime: Math.round(process.uptime()),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    }
  })

  app.get('/health/live', async () => ({
    ok: true,
    uptime: Math.round(process.uptime()),
  }))

  app.get('/health/ready', async (_request, reply) => {
    let dbStatus: 'ok' | 'error' = 'ok'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }
    const ready = dbStatus === 'ok'
    reply.status(ready ? 200 : 503)
    return {
      ok: ready,
      database: dbStatus,
    }
  })

  // /api/health alias for CLI compatibility
  app.get('/api/health', async (_request, reply) => {
    let dbStatus: 'ok' | 'error' = 'ok'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }
    const healthy = dbStatus === 'ok'
    reply.status(healthy ? 200 : 503)
    return {
      ok: healthy,
      status: healthy ? 'ok' : 'degraded',
      version: BUILD_VERSION,
      uptime: Math.round(process.uptime()),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    }
  })

  app.get('/api/orgs/:orgId/spend/summary', async (request) => {
    const params = orgParamsSchema.parse(request.params)
    return getSpendSummary(prisma, params.orgId)
  })

  app.get('/api/orgs/:orgId/spend/breakdown', async (request) => {
    const params = orgParamsSchema.parse(request.params)
    return getSpendBreakdown(prisma, params.orgId)
  })

  app.get('/api/orgs/:orgId/waste', async (request) => {
    const params = orgParamsSchema.parse(request.params)
    return prisma.wasteFlag.findMany({
      where: {
        orgId: params.orgId,
        status: WasteFlagStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        repo: { select: { id: true, name: true } },
        build: { select: { id: true, prNumber: true, branch: true, costCents: true } },
      },
      orderBy: { savingsCents: 'desc' },
    })
  })

  app.get('/api/orgs/:orgId/repos/:repoId/builds', async (request) => {
    const params = repoBuildsParamsSchema.parse(request.params)
    const query = paginationSchema.parse(request.query)
    const [items, total] = await Promise.all([
      prisma.build.findMany({
        where: { orgId: params.orgId, repoId: params.repoId, deletedAt: null },
        include: {
          repo: { select: { id: true, name: true } },
          wasteFlags: { where: { status: WasteFlagStatus.ACTIVE } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.build.count({
        where: { orgId: params.orgId, repoId: params.repoId, deletedAt: null },
      }),
    ])

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  })

  app.get('/api/orgs/:orgId/flaky-tests', async (request) => {
    const params = orgParamsSchema.parse(request.params)
    const tests = await prisma.testResult.findMany({
      where: {
        build: {
          orgId: params.orgId,
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

    const grouped = new Map<string, { testName: string; suite: string; repoName: string; runs: number; failures: number; wastedComputeCents: number; lastSeen: string }>()

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
      entry.lastSeen = test.createdAt > new Date(entry.lastSeen) ? test.createdAt.toISOString() : entry.lastSeen
      grouped.set(key, entry)
    }

    return [...grouped.values()]
      .map((entry) => ({
        ...entry,
        flakyRate: entry.runs ? Number((entry.failures / entry.runs).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.wastedComputeCents - a.wastedComputeCents)
  })

  app.post('/api/github/webhook', async (request, reply) => {
    const secret = config.GITHUB_WEBHOOK_SECRET
    const rawBody = (request as RawBodyRequest).rawBody
    const signature = getHeaderString(request.headers['x-hub-signature-256'])

    if (!secret || !rawBody || !verifyGitHubSignature(rawBody, signature, secret)) {
      reply.status(401).send({ error: 'INVALID_SIGNATURE' })
      return
    }

    const event = getHeaderString(request.headers['x-github-event'])
    const payload = request.body as GitHubWebhookPayload
    let build: { id: string; status: string; conclusion: BuildConclusion | null } | null = null

    if (event === 'workflow_run') {
      build = await handleWorkflowRun(prisma, payload)
    } else if (event === 'workflow_job') {
      build = await handleWorkflowJob(prisma, payload)
    } else if (event === 'pull_request' && payload.pull_request) {
      await resolveWebhookOrganization(prisma, payload)
    }

    if (build && (build.status === 'completed' || build.conclusion)) {
      await queue.enqueue({ buildId: build.id })
    }

    reply.send({ ok: true })
  })

  app.addHook('onClose', async () => {
    await queue.close()
    await prisma.$disconnect()
  })

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof z.ZodError ? 400 : (error as { statusCode?: number }).statusCode ?? 500
    const message = error instanceof Error ? error.message : 'Unexpected error'
    reply.status(statusCode).send({
      error: statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
      message,
    })
  })

  return app
}
