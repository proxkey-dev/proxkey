import { OrganizationRole } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { getRequestAuditContext } from '../lib/request'
import { validateRequest } from '../lib/validation'
import {
  createReportBodySchema,
  listReportsQuerySchema,
  reportIdParamsSchema,
  updateReportBodySchema,
} from '../schemas/report.schemas'
import type { AppServices, RouteGuards } from './types'

export function registerReportRoutes(
  app: FastifyInstance,
  services: AppServices,
  guards: RouteGuards,
): void {
  app.post(
    '/reports',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useCurrentOrganization,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER]),
      ],
    },
    async (request, reply) => {
      const { body } = validateRequest({
        bodySchema: createReportBodySchema,
        body: request.body,
      })

      const result = await services.reportService.createReport({
        actor: request.auth!,
        organization: request.organization!,
        input: body!,
        requestContext: getRequestAuditContext(request),
      })

      reply.code(201).send(result)
    },
  )

  app.get(
    '/reports',
    {
      preHandler: [guards.authenticate, guards.useCurrentOrganization],
    },
    async (request, reply) => {
      const { query } = validateRequest({
        querySchema: listReportsQuerySchema,
        query: request.query,
      })

      reply.send(
        await services.reportService.listReports({
          organization: request.organization!,
          page: query!.page,
          pageSize: query!.pageSize,
          status: query!.status,
          sourceType: query!.sourceType,
        }),
      )
    },
  )

  app.get(
    '/reports/:id',
    {
      preHandler: [guards.authenticate, guards.useCurrentOrganization],
    },
    async (request, reply) => {
      const { params } = validateRequest({
        paramsSchema: reportIdParamsSchema,
        params: request.params,
      })

      reply.send(
        await services.reportService.getReport({
          organization: request.organization!,
          reportId: params!.id,
        }),
      )
    },
  )

  app.patch(
    '/reports/:id',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useCurrentOrganization,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER]),
      ],
    },
    async (request, reply) => {
      const { body, params } = validateRequest({
        paramsSchema: reportIdParamsSchema,
        bodySchema: updateReportBodySchema,
        params: request.params,
        body: request.body,
      })

      reply.send(
        await services.reportService.updateReport({
          actor: request.auth!,
          organization: request.organization!,
          reportId: params!.id,
          input: body!,
          requestContext: getRequestAuditContext(request),
        }),
      )
    },
  )

  app.delete(
    '/reports/:id',
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
        paramsSchema: reportIdParamsSchema,
        params: request.params,
      })

      await services.reportService.deleteReport({
        actor: request.auth!,
        organization: request.organization!,
        reportId: params!.id,
        requestContext: getRequestAuditContext(request),
      })

      reply.status(204).send()
    },
  )
}
