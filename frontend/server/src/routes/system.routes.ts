import { OrganizationRole } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { validateRequest } from '../lib/validation'
import { auditLogsQuerySchema } from '../schemas/system.schemas'
import type { AppServices, RouteGuards } from './types'

export function registerSystemRoutes(
  app: FastifyInstance,
  services: AppServices,
  guards: RouteGuards,
): void {
  app.get('/health', async (_request, reply) => {
    reply.send({ ok: true })
  })

  app.get('/ready', async (_request, reply) => {
    await services.prisma.$queryRaw`SELECT 1`
    reply.send({ ok: true })
  })

  app.get(
    '/usage',
    {
      preHandler: [guards.authenticate, guards.useCurrentOrganization],
    },
    async (request, reply) => {
      reply.send(await services.usageService.getSummary(request.organization!.organizationId))
    },
  )

  app.get(
    '/audit-logs',
    {
      preHandler: [
        guards.authenticate,
        guards.useCurrentOrganization,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN]),
      ],
    },
    async (request, reply) => {
      const { query } = validateRequest({
        querySchema: auditLogsQuerySchema,
        query: request.query,
      })

      reply.send(
        await services.auditLogService.list({
          organizationId: request.organization!.organizationId,
          page: query!.page,
          pageSize: query!.pageSize,
          action: query!.action,
        }),
      )
    },
  )
}
