import {
  AuditAction,
  OrganizationRole,
  PrismaClient,
  ReportStatus,
  SourceType,
  UsageEventType,
} from '@prisma/client'
import { encryptString } from '../lib/crypto'
import { toPrismaJsonValue } from '../lib/json'
import type { RequestAuditContext } from '../lib/request'
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error'
import { AuditLogService } from './audit-log.service'
import { RedactionService } from './redaction.service'
import { UsageService } from './usage.service'
import type { AuthContext, OrganizationContext } from '../types/request'

function serializeReport(report: {
  id: string
  organizationId: string
  createdByUserId: string
  title: string
  redactedText: string
  sourceType: string
  status: string
  failureReason: string | null
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}): Record<string, unknown> {
  return {
    id: report.id,
    organizationId: report.organizationId,
    createdByUserId: report.createdByUserId,
    title: report.title,
    redactedText: report.redactedText,
    sourceType: report.sourceType,
    status: report.status,
    failureReason: report.failureReason,
    metadata: report.metadata,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  }
}

export class ReportService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionKey: Buffer,
    private readonly redactionService: RedactionService,
    private readonly auditLogService: AuditLogService,
    private readonly usageService: UsageService,
  ) {}

  private async findScopedReportOrThrow(reportId: string, organizationId: string) {
    const report = await this.db.report.findFirst({
      where: {
        id: reportId,
        organizationId,
      },
    })

    if (!report) {
      throw new NotFoundError('Report not found')
    }

    return report
  }

  private assertCanEditReport(
    actor: AuthContext,
    organization: OrganizationContext,
    report: { createdByUserId: string; status: ReportStatus },
  ): void {
    if (organization.role === OrganizationRole.VIEWER) {
      throw new ForbiddenError('Viewers cannot edit reports')
    }

    if (organization.role === OrganizationRole.MEMBER && report.createdByUserId !== actor.userId) {
      throw new ForbiddenError('Members can only edit their own reports')
    }

    if (
      report.status === ReportStatus.TRIAGING ||
      report.status === ReportStatus.TRIAGED ||
      report.status === ReportStatus.EXPORTED
    ) {
      throw new ConflictError('This report can no longer be edited')
    }
  }

  async createReport(args: {
    actor: AuthContext
    organization: OrganizationContext
    input: {
      title: string
      rawText: string
      sourceType: SourceType
      metadata?: Record<string, unknown>
    }
    requestContext: RequestAuditContext
  }): Promise<Record<string, unknown>> {
    const redactedText = this.redactionService.redactText(args.input.rawText)
    const rawTextEncrypted = encryptString(args.input.rawText, this.encryptionKey)

    const report = await this.db.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          organizationId: args.organization.organizationId,
          createdByUserId: args.actor.userId,
          title: args.input.title,
          rawTextEncrypted,
          redactedText,
          sourceType: args.input.sourceType,
          metadata: toPrismaJsonValue(args.input.metadata ?? {}),
        },
      })

      await this.auditLogService.record(
        {
          ...args.requestContext,
          organizationId: args.organization.organizationId,
          actorUserId: args.actor.userId,
          action: AuditAction.REPORT_CREATED,
          targetType: 'REPORT',
          targetId: created.id,
          metadata: {
            sourceType: args.input.sourceType,
            title: args.input.title,
          },
        },
        tx,
      )

      await this.usageService.record(
        {
          organizationId: args.organization.organizationId,
          userId: args.actor.userId,
          eventType: UsageEventType.REPORT_CREATED,
        },
        tx,
      )

      return created
    })

    return serializeReport(report)
  }

  async listReports(args: {
    organization: OrganizationContext
    page: number
    pageSize: number
    status?: ReportStatus
    sourceType?: SourceType
  }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = {
      organizationId: args.organization.organizationId,
      status: args.status,
      sourceType: args.sourceType,
    }

    const [items, total] = await this.db.$transaction([
      this.db.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize,
      }),
      this.db.report.count({ where }),
    ])

    return {
      items: items.map((item) => serializeReport(item)),
      total,
      page: args.page,
      pageSize: args.pageSize,
    }
  }

  async getReport(args: {
    organization: OrganizationContext
    reportId: string
  }): Promise<Record<string, unknown>> {
    const report = await this.findScopedReportOrThrow(
      args.reportId,
      args.organization.organizationId,
    )

    return serializeReport(report)
  }

  async updateReport(args: {
    actor: AuthContext
    organization: OrganizationContext
    reportId: string
    input: {
      title?: string
      rawText?: string
      sourceType?: SourceType
      metadata?: Record<string, unknown>
    }
    requestContext: RequestAuditContext
  }): Promise<Record<string, unknown>> {
    const existing = await this.findScopedReportOrThrow(
      args.reportId,
      args.organization.organizationId,
    )

    this.assertCanEditReport(args.actor, args.organization, existing)

    const updated = await this.db.$transaction(async (tx) => {
      const nextData: Record<string, unknown> = {}

      if (typeof args.input.title !== 'undefined') {
        nextData.title = args.input.title
      }

      if (typeof args.input.sourceType !== 'undefined') {
        nextData.sourceType = args.input.sourceType
      }

      if (typeof args.input.metadata !== 'undefined') {
        nextData.metadata = toPrismaJsonValue(args.input.metadata)
      }

      if (typeof args.input.rawText !== 'undefined') {
        nextData.rawTextEncrypted = encryptString(args.input.rawText, this.encryptionKey)
        nextData.redactedText = this.redactionService.redactText(args.input.rawText)
      }

      if (existing.status === ReportStatus.FAILED) {
        nextData.status = ReportStatus.SUBMITTED
        nextData.failureReason = null
      }

      const report = await tx.report.update({
        where: { id: existing.id },
        data: nextData,
      })

      await this.auditLogService.record(
        {
          ...args.requestContext,
          organizationId: args.organization.organizationId,
          actorUserId: args.actor.userId,
          action: AuditAction.REPORT_UPDATED,
          targetType: 'REPORT',
          targetId: report.id,
          metadata: {
            updatedFields: Object.keys(nextData),
          },
        },
        tx,
      )

      return report
    })

    return serializeReport(updated)
  }

  async deleteReport(args: {
    actor: AuthContext
    organization: OrganizationContext
    reportId: string
    requestContext: RequestAuditContext
  }): Promise<void> {
    if (
      args.organization.role !== OrganizationRole.ADMIN &&
      args.organization.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenError('Only admins and owners can delete reports')
    }

    const existing = await this.findScopedReportOrThrow(
      args.reportId,
      args.organization.organizationId,
    )

    if (existing.status === ReportStatus.TRIAGING) {
      throw new ConflictError('Cannot delete a report while triage is running')
    }

    await this.db.$transaction(async (tx) => {
      await tx.report.delete({
        where: { id: existing.id },
      })

      await this.auditLogService.record(
        {
          ...args.requestContext,
          organizationId: args.organization.organizationId,
          actorUserId: args.actor.userId,
          action: AuditAction.REPORT_DELETED,
          targetType: 'REPORT',
          targetId: existing.id,
        },
        tx,
      )
    })
  }
}
