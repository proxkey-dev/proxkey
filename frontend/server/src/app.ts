import crypto from 'crypto'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { OrganizationRole, type PrismaClient } from '@prisma/client'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import type { AppEnv } from './config/env'
import { loadEnv } from './config/env'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  isAppError,
} from './errors/app-error'
import { parseRequestCookies } from './lib/cookies'
import { prisma as defaultPrisma } from './lib/prisma'
import { InMemoryRateLimiter } from './lib/rate-limit'
import { AuditLogService } from './services/audit-log.service'
import { AuthService } from './services/auth.service'
import { ExportService } from './services/export.service'
import { IncidentAttributionService } from './services/incident-attribution.service'
import { OrganizationService } from './services/organization.service'
import { createLLMProvider } from './services/providers'
import type { LLMProvider } from './services/providers/types'
import { RedactionService } from './services/redaction.service'
import { ReportService } from './services/report.service'
import { SessionService } from './services/session.service'
import { TriageService } from './services/triage.service'
import { UsageService } from './services/usage.service'
import { registerAuthRoutes } from './routes/auth.routes'
import { registerAgentTriageRoutes } from './routes/agent-triage.routes'
import { registerIncidentAttributionRoutes } from './routes/incident-attribution.routes'
import { registerOrganizationRoutes } from './routes/organization.routes'
import { registerReportRoutes } from './routes/report.routes'
import { registerSystemRoutes } from './routes/system.routes'
import { registerTriageRoutes } from './routes/triage.routes'
import type { AppServices, RouteGuards } from './routes/types'

export type BuildAppOptions = {
  env?: AppEnv
  prisma?: PrismaClient
  llmProvider?: LLMProvider
  logger?: boolean
}

function getHeaderString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? loadEnv()
  const prisma = options.prisma ?? defaultPrisma
  const redactionService = new RedactionService({
    redactEmails: env.REDACT_EMAILS,
    redactPhones: env.REDACT_PHONES,
  })
  const rateLimiter = new InMemoryRateLimiter()
  const sessionService = new SessionService(prisma, env.SESSION_TTL_HOURS)
  const auditLogService = new AuditLogService(prisma, redactionService)
  const usageService = new UsageService(prisma, redactionService)
  const authService = new AuthService(prisma, sessionService, auditLogService, usageService)
  const organizationService = new OrganizationService(prisma, auditLogService, sessionService)
  const reportService = new ReportService(
    prisma,
    env.contentEncryptionKeyBytes,
    redactionService,
    auditLogService,
    usageService,
  )
  const llmProvider = options.llmProvider ?? createLLMProvider(env)
  const triageService = new TriageService(prisma, llmProvider, auditLogService, usageService)
  const incidentAttributionService = new IncidentAttributionService()
  const exportService = new ExportService(prisma, auditLogService)

  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: env.NODE_ENV === 'development' ? 'debug' : 'info',
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.rawText',
                'req.body.deploys',
                'req.body.signals',
                'req.body.serviceDependencies',
                'req.body.apiKey',
                'req.body.token',
                'req.body.secret',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
          },
    bodyLimit: env.BODY_LIMIT_BYTES,
    requestIdHeader: 'x-request-id',
    genReqId: (request) => getHeaderString(request.headers['x-request-id']) ?? crypto.randomUUID(),
    trustProxy: env.TRUST_PROXY,
  })

  app.decorateRequest('auth', null)
  app.decorateRequest('organization', null)

  await app.register(helmet)
  await app.register(cors, {
    credentials: true,
    allowedHeaders: [
      'content-type',
      'x-csrf-token',
      'x-organization-id',
      'idempotency-key',
      'x-request-id',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }

      if (env.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'), false)
    },
  })

  app.addHook('onRequest', async (request, reply) => {
    request.auth = null
    request.organization = null
    reply.header('x-request-id', request.id)
    rateLimiter.consume(`global:${request.ip}`, env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MS)
  })

  const guards: RouteGuards = {
    authenticate: async (request) => {
      const cookies = parseRequestCookies(request)
      const auth = await sessionService.authenticate(cookies[env.SESSION_COOKIE_NAME])

      if (!auth) {
        throw new UnauthorizedError('Authentication required')
      }

      request.auth = auth
    },
    requireCsrf: async (request) => {
      const methodRequiresCsrf = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)

      if (!methodRequiresCsrf) {
        return
      }

      if (!request.auth) {
        throw new UnauthorizedError('Authentication required')
      }

      const cookies = parseRequestCookies(request)
      const csrfCookie = cookies[env.CSRF_COOKIE_NAME]
      const csrfHeader = getHeaderString(request.headers['x-csrf-token'])

      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        throw new UnauthorizedError('Invalid CSRF token')
      }

      if (!sessionService.isCsrfTokenValid(request.auth, csrfHeader)) {
        throw new UnauthorizedError('Invalid CSRF token')
      }
    },
    useCurrentOrganization: async (request) => {
      if (!request.auth) {
        throw new UnauthorizedError('Authentication required')
      }

      const requestedOrganizationId = getHeaderString(request.headers['x-organization-id'])
      request.organization = await organizationService.resolveOrganizationContext({
        auth: request.auth,
        requestedOrganizationId,
      })
    },
    useOrganizationParam: async (request) => {
      if (!request.auth) {
        throw new UnauthorizedError('Authentication required')
      }

      const params = request.params as { id?: string }

      if (!params.id) {
        throw new BadRequestError('Organization id is required')
      }

      request.organization = await organizationService.resolveOrganizationContext({
        auth: request.auth,
        requestedOrganizationId: params.id,
      })
    },
    triageRateLimit: async (request) => {
      if (!request.auth || !request.organization) {
        throw new UnauthorizedError('Authentication required')
      }

      rateLimiter.consume(
        `triage:${request.organization.organizationId}:${request.auth.userId}`,
        env.TRIAGE_RATE_LIMIT_MAX,
        env.RATE_LIMIT_WINDOW_MS,
      )
    },
    authorize: (roles: OrganizationRole[]) => async (request) => {
      if (!request.organization) {
        throw new UnauthorizedError('Organization context missing')
      }

      if (!roles.includes(request.organization.role)) {
        throw new ForbiddenError('You do not have permission to perform this action')
      }
    },
  }

  const services: AppServices = {
    prisma,
    authService,
    organizationService,
    reportService,
    triageService,
    incidentAttributionService,
    exportService,
    auditLogService,
    usageService,
  }

  registerAuthRoutes(app, services, guards, env)
  registerAgentTriageRoutes(app, env)
  registerIncidentAttributionRoutes(app, services, guards)
  registerOrganizationRoutes(app, services, guards)
  registerReportRoutes(app, services, guards)
  registerTriageRoutes(app, services, guards)
  registerSystemRoutes(app, services, guards)

  app.setNotFoundHandler(() => {
    throw new NotFoundError('Route not found')
  })

  app.setErrorHandler((error, request, reply) => {
    let statusCode = 500
    let response = {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: request.id,
    }

    if (isAppError(error)) {
      statusCode = error.statusCode
      response = {
        error: error.code,
        message: error.message,
        requestId: request.id,
      }
    } else if ((error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      statusCode = 413
      response = {
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeded the allowed size limit',
        requestId: request.id,
      }
    } else if ((error as { code?: string }).code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      statusCode = 400
      response = {
        error: 'BAD_REQUEST',
        message: 'Malformed JSON body',
        requestId: request.id,
      }
    }

    const logMethod = statusCode >= 500 ? 'error' : 'warn'
    request.log[logMethod](
      {
        err: error,
        statusCode,
        requestId: request.id,
      },
      'Request failed',
    )

    reply.status(statusCode).send(response)
  })

  return app
}
