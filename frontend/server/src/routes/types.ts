import type { FastifyReply, FastifyRequest } from 'fastify'
import type { OrganizationRole, PrismaClient } from '@prisma/client'
import type { AuthService } from '../services/auth.service'
import type { AuditLogService } from '../services/audit-log.service'
import type { ExportService } from '../services/export.service'
import type { IncidentAttributionService } from '../services/incident-attribution.service'
import type { OrganizationService } from '../services/organization.service'
import type { ReportService } from '../services/report.service'
import type { TriageService } from '../services/triage.service'
import type { UsageService } from '../services/usage.service'

export type RouteGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export type RouteGuards = {
  authenticate: RouteGuard
  requireCsrf: RouteGuard
  useCurrentOrganization: RouteGuard
  useOrganizationParam: RouteGuard
  triageRateLimit: RouteGuard
  authorize: (roles: OrganizationRole[]) => RouteGuard
}

export type AppServices = {
  prisma: PrismaClient
  authService: AuthService
  organizationService: OrganizationService
  reportService: ReportService
  triageService: TriageService
  incidentAttributionService: IncidentAttributionService
  exportService: ExportService
  auditLogService: AuditLogService
  usageService: UsageService
}
