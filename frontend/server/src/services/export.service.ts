import { AuditAction, OrganizationRole, type PrismaClient } from '@prisma/client'
import type { RequestAuditContext } from '../lib/request'
import { ForbiddenError, NotFoundError } from '../errors/app-error'
import { AuditLogService } from './audit-log.service'
import { PlaceholderExportProvider } from './integrations/placeholder-exporter'
import type { AuthContext, OrganizationContext } from '../types/request'

export class ExportService {
  constructor(
    private readonly db: PrismaClient,
    private readonly auditLogService: AuditLogService,
    private readonly exportProvider = new PlaceholderExportProvider(),
  ) {}

  async exportTriageResult(args: {
    actor: AuthContext
    organization: OrganizationContext
    triageResultId: string
    requestContext: RequestAuditContext
  }): Promise<void> {
    if (
      args.organization.role !== OrganizationRole.ADMIN &&
      args.organization.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenError('Only admins and owners can export triage results')
    }

    const triageResult = await this.db.triageResult.findFirst({
      where: {
        id: args.triageResultId,
        organizationId: args.organization.organizationId,
      },
    })

    if (!triageResult) {
      throw new NotFoundError('Triage result not found')
    }

    await this.auditLogService.record({
      ...args.requestContext,
      organizationId: args.organization.organizationId,
      actorUserId: args.actor.userId,
      action: AuditAction.EXPORT_ATTEMPT,
      targetType: 'TRIAGE_RESULT',
      targetId: triageResult.id,
      metadata: {
        provider: 'placeholder',
      },
    })

    await this.exportProvider.exportTicket({
      organizationId: args.organization.organizationId,
      ticketTitle: triageResult.ticketTitle,
      ticketDescription: triageResult.ticketDescription,
    })
  }
}
