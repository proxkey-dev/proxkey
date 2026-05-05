import { OrganizationRole } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { getRequestAuditContext } from '../lib/request'
import { validateRequest } from '../lib/validation'
import {
  exportTriageBodySchema,
  triageReportParamsSchema,
  triageResultParamsSchema,
  updateTriageResultBodySchema,
} from '../schemas/triage.schemas'
import type { AppServices, RouteGuards } from './types'

function getHeaderString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function registerTriageRoutes(
  app: FastifyInstance,
  services: AppServices,
  guards: RouteGuards,
): void {
  app.post(
    '/reports/:id/triage',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useCurrentOrganization,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER]),
        guards.triageRateLimit,
      ],
    },
    async (request, reply) => {
      const { params } = validateRequest({
        paramsSchema: triageReportParamsSchema,
        params: request.params,
      })

      const result = await services.triageService.runTriage({
        actor: request.auth!,
        organization: request.organization!,
        reportId: params!.id,
        idempotencyKey: getHeaderString(request.headers['idempotency-key']),
        requestContext: getRequestAuditContext(request),
      })

      if (result.state === 'in_progress') {
        reply.code(202).send(result)
        return
      }

      reply.send(result)
    },
  )

  app.get(
    '/reports/:id/triage-result',
    {
      preHandler: [guards.authenticate, guards.useCurrentOrganization],
    },
    async (request, reply) => {
      const { params } = validateRequest({
        paramsSchema: triageReportParamsSchema,
        params: request.params,
      })

      reply.send(
        await services.triageService.getTriageResultForReport({
          organization: request.organization!,
          reportId: params!.id,
        }),
      )
    },
  )

  app.patch(
    '/triage-results/:id',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useCurrentOrganization,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN]),
      ],
    },
    async (request, reply) => {
      const { params, body } = validateRequest({
        paramsSchema: triageResultParamsSchema,
        bodySchema: updateTriageResultBodySchema,
        params: request.params,
        body: request.body,
      })

      reply.send(
        await services.triageService.updateTriageResult({
          organization: request.organization!,
          triageResultId: params!.id,
          input: body!,
        }),
      )
    },
  )

  app.post(
    '/triage-results/:id/export',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useCurrentOrganization,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN]),
      ],
    },
    async (request, reply) => {
      const { params } = validateRequest({
        paramsSchema: triageResultParamsSchema,
        bodySchema: exportTriageBodySchema,
        params: request.params,
        body: request.body ?? {},
      })

      await services.exportService.exportTriageResult({
        actor: request.auth!,
        organization: request.organization!,
        triageResultId: params!.id,
        requestContext: getRequestAuditContext(request),
      })

      reply.send({ success: true })
    },
  )
}
