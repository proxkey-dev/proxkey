import type { PrismaClient, UsageEventType } from '@prisma/client'
import type { DatabaseClient } from '../lib/db'
import { toPrismaJsonValue } from '../lib/json'
import { RedactionService } from './redaction.service'

type UsageRecordInput = {
  organizationId: string
  userId?: string | null
  eventType: UsageEventType
  metadata?: unknown
}

export class UsageService {
  constructor(
    private readonly db: PrismaClient,
    private readonly redactionService: RedactionService,
  ) {}

  async record(input: UsageRecordInput, db: DatabaseClient = this.db): Promise<void> {
    await db.usageEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        eventType: input.eventType,
        metadata: input.metadata
          ? toPrismaJsonValue(this.redactionService.redactUnknown(input.metadata))
          : undefined,
      },
    })
  }

  async getSummary(organizationId: string): Promise<{
    events: Record<string, number>
    reportsCount: number
    triageResultsCount: number
  }> {
    const [usageEvents, reportsCount, triageResultsCount] = await this.db.$transaction([
      this.db.usageEvent.findMany({
        where: { organizationId },
        select: { eventType: true },
      }),
      this.db.report.count({ where: { organizationId } }),
      this.db.triageResult.count({ where: { organizationId } }),
    ])

    return {
      events: usageEvents.reduce<Record<string, number>>((accumulator, item) => {
        accumulator[item.eventType] = (accumulator[item.eventType] ?? 0) + 1
        return accumulator
      }, {}),
      reportsCount,
      triageResultsCount,
    }
  }
}
