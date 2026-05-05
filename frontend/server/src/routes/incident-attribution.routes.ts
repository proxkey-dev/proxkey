import type { OrganizationRole } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { validateRequest } from '../lib/validation'
import { incidentAttributionRankBodySchema } from '../schemas/incident-attribution.schemas'
import type { AppServices, RouteGuards } from './types'

const INCIDENT_ATTRIBUTION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as OrganizationRole[]

export function registerIncidentAttributionRoutes(
  app: FastifyInstance,
  services: AppServices,
  guards: RouteGuards,
): void {
  app.post(
    '/api/incident-attribution/rank',
    {
      preHandler: [
        guards.authenticate,
        guards.requireCsrf,
        guards.useCurrentOrganization,
        guards.authorize(INCIDENT_ATTRIBUTION_ROLES),
        guards.triageRateLimit,
      ],
    },
    async (request, reply) => {
      const { body } = validateRequest({
        bodySchema: incidentAttributionRankBodySchema,
        body: request.body,
      })

      reply.send(services.incidentAttributionService.rank(body!))
    },
  )
}
