import { OrganizationRole } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { getRequestAuditContext } from '../lib/request'
import { validateRequest } from '../lib/validation'
import {
  createOrganizationBodySchema,
  inviteMemberBodySchema,
  listMembersQuerySchema,
  memberIdParamsSchema,
  organizationIdParamsSchema,
  updateMemberRoleBodySchema,
} from '../schemas/organization.schemas'
import type { AppServices, RouteGuards } from './types'

export function registerOrganizationRoutes(
  app: FastifyInstance,
  services: AppServices,
  guards: RouteGuards,
): void {
  app.post(
    '/organizations',
    {
      preHandler: [guards.authenticate, guards.requireCsrf],
    },
    async (request, reply) => {
      const { body } = validateRequest({
        bodySchema: createOrganizationBodySchema,
        body: request.body,
      })

      const organization = await services.organizationService.createOrganization({
        auth: request.auth!,
        name: body!.name,
        requestContext: getRequestAuditContext(request),
      })

      reply.code(201).send(organization)
    },
  )

  app.get(
    '/organizations/current',
    {
      preHandler: [guards.authenticate, guards.useCurrentOrganization],
    },
    async (request, reply) => {
      reply.send(await services.organizationService.getCurrentOrganization(request.organization!))
    },
  )

  app.get(
    '/organizations/:id/members',
    {
      preHandler: [
        guards.authenticate,
        guards.useOrganizationParam,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN]),
      ],
    },
    async (request, reply) => {
      const { query } = validateRequest({
        querySchema: listMembersQuerySchema,
        query: request.query,
      })

      reply.send(
        await services.organizationService.listMembers({
          organizationId: request.organization!.organizationId,
          page: query!.page,
          pageSize: query!.pageSize,
          status: query!.status,
        }),
      )
    },
  )

  app.post(
    '/organizations/:id/invite',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useOrganizationParam,
        guards.authorize([OrganizationRole.OWNER, OrganizationRole.ADMIN]),
      ],
    },
    async (request, reply) => {
      const { body } = validateRequest({
        bodySchema: inviteMemberBodySchema,
        body: request.body,
      })

      const result = await services.organizationService.inviteMember({
        actor: request.auth!,
        organization: request.organization!,
        email: body!.email,
        role: body!.role,
        requestContext: getRequestAuditContext(request),
      })

      reply.code(201).send(result)
    },
  )

  app.patch(
    '/organizations/:id/members/:memberId/role',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useOrganizationParam,
        guards.authorize([OrganizationRole.OWNER]),
      ],
    },
    async (request, reply) => {
      const { body, params } = validateRequest({
        paramsSchema: memberIdParamsSchema,
        bodySchema: updateMemberRoleBodySchema,
        params: request.params,
        body: request.body,
      })

      reply.send(
        await services.organizationService.changeMemberRole({
          actor: request.auth!,
          organization: request.organization!,
          memberId: params!.memberId,
          role: body!.role,
          requestContext: getRequestAuditContext(request),
        }),
      )
    },
  )
}
