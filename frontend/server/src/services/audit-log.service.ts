import type { AuditAction, PrismaClient } from '@prisma/client'
import type { DatabaseClient } from '../lib/db'
import { toPrismaJsonValue } from '../lib/json'
import type { RequestAuditContext } from '../lib/request'
import { RedactionService } from './redaction.service'

type AuditRecordInput = RequestAuditContext & {
  organizationId?: string | null
  actorUserId?: string | null
  action: AuditAction
  targetType: string
  targetId?: string | null
  metadata?: unknown
}

export class AuditLogService {
  constructor(
    private readonly db: PrismaClient,
    private readonly redactionService: RedactionService,
  ) {}

  async record(input: AuditRecordInput, db: DatabaseClient = this.db): Promise<void> {
    await db.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        requestId: input.requestId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata
          ? toPrismaJsonValue(this.redactionService.redactUnknown(input.metadata))
          : undefined,
      },
    })
  }

  async list(args: {
    organizationId: string
    page: number
    pageSize: number
    action?: AuditAction
  }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = {
      organizationId: args.organizationId,
      action: args.action,
    }

    const [items, total] = await this.db.$transaction([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize,
      }),
      this.db.auditLog.count({ where }),
    ])

    return {
      items,
      total,
      page: args.page,
      pageSize: args.pageSize,
    }
  }
}
