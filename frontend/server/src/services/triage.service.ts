import {
  AuditAction,
  IdempotencyStatus,
  IssueType,
  OrganizationRole,
  PrismaClient,
  ReportStatus,
  Severity,
  UsageEventType,
  type Prisma,
} from '@prisma/client'
import { toPrismaJsonValue } from '../lib/json'
import type { RequestAuditContext } from '../lib/request'
import {
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
} from '../errors/app-error'
import { AuditLogService } from './audit-log.service'
import type { LLMProvider } from './providers/types'
import { UsageService } from './usage.service'
import type { AuthContext, OrganizationContext } from '../types/request'

type RunTriageResult =
  | {
      state: 'completed'
      idempotent: boolean
      triageResult: Record<string, unknown>
      reportStatus: ReportStatus
    }
  | {
      state: 'in_progress'
      idempotent: true
      reportStatus: ReportStatus
    }

type StepEvent = {
  stepName: string
  stepInput?: unknown
  stepOutput?: unknown
}

type DuplicateCandidate = {
  reportId: string
  similarity: number
  summary: string
}

type PreprocessedReport = {
  title: string
  sourceType: string
  redactedText: string
  normalizedText: string
  rawSignals: string[]
}

type ClassifiedReport = {
  issueType: IssueType
  sourceSignals: string[]
}

type SeverityDecision = {
  severity: Severity
  reasoning: string
}

type RoutedOwner = {
  suspectedComponent: string | null
  suggestedOwner: string | null
}

function serializeTriageResult(triageResult: {
  id: string
  reportId: string
  organizationId: string
  summary: string
  issueType: string
  severity: string
  confidenceScore: number
  customerImpact: string | null
  affectedArea: string | null
  suspectedComponent: string | null
  reproSteps: unknown
  expectedBehavior: string | null
  actualBehavior: string | null
  missingInformation: unknown
  suggestedOwner: string | null
  suggestedLabels: unknown
  duplicateSignals: unknown
  duplicateCandidates: unknown
  severityReasoning: string | null
  nextAction: string | null
  followUpMessage: string | null
  ticketTitle: string
  ticketDescription: string
  modelProvider: string
  modelName: string
  createdAt: Date
  updatedAt: Date
}): Record<string, unknown> {
  return {
    id: triageResult.id,
    reportId: triageResult.reportId,
    organizationId: triageResult.organizationId,
    summary: triageResult.summary,
    issueType: triageResult.issueType,
    severity: triageResult.severity,
    confidenceScore: triageResult.confidenceScore,
    customerImpact: triageResult.customerImpact,
    affectedArea: triageResult.affectedArea,
    suspectedComponent: triageResult.suspectedComponent,
    reproSteps: triageResult.reproSteps,
    expectedBehavior: triageResult.expectedBehavior,
    actualBehavior: triageResult.actualBehavior,
    missingInformation: triageResult.missingInformation,
    suggestedOwner: triageResult.suggestedOwner,
    suggestedLabels: triageResult.suggestedLabels,
    duplicateSignals: triageResult.duplicateSignals,
    duplicateCandidates: triageResult.duplicateCandidates,
    severityReasoning: triageResult.severityReasoning,
    nextAction: triageResult.nextAction,
    followUpMessage: triageResult.followUpMessage,
    ticketTitle: triageResult.ticketTitle,
    ticketDescription: triageResult.ticketDescription,
    modelProvider: triageResult.modelProvider,
    modelName: triageResult.modelName,
    createdAt: triageResult.createdAt,
    updatedAt: triageResult.updatedAt,
  }
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1
    }
  }

  const union = leftTokens.size + rightTokens.size - intersection
  return union === 0 ? 0 : intersection / union
}

function createFollowUpMessage(missingInformation: string[]): string | null {
  if (missingInformation.length === 0) {
    return null
  }

  const fields = missingInformation.join(', ')
  return `Can you provide the following before escalation: ${fields}?`
}

function buildFallbackNextAction(args: {
  severity: Severity
  missingInformation: string[]
  suggestedOwner: string | null
}): string {
  if (args.missingInformation.length > 0) {
    return `Request the missing information, then route the packet to ${args.suggestedOwner ?? 'the most likely owner'} for review.`
  }

  if (args.severity === Severity.CRITICAL || args.severity === Severity.HIGH) {
    return `Route immediately to ${args.suggestedOwner ?? 'the relevant engineering owner'} and compare against the last known healthy build.`
  }

  return `Queue for human review and assign to ${args.suggestedOwner ?? 'the likely owner'} when context is confirmed.`
}

export class TriageService {
  constructor(
    private readonly db: PrismaClient,
    private readonly llmProvider: LLMProvider,
    private readonly auditLogService: AuditLogService,
    private readonly usageService: UsageService,
  ) {}

  private async logPipelineEvent(args: {
    organizationId: string
    reportId: string
    stepName: string
    stepInput?: unknown
    stepOutput?: unknown
    tx?: Prisma.TransactionClient
  }): Promise<void> {
    const client = args.tx ?? this.db

    await client.triageEvent.create({
      data: {
        organizationId: args.organizationId,
        reportId: args.reportId,
        stepName: args.stepName,
        stepInput:
          typeof args.stepInput === 'undefined' ? undefined : toPrismaJsonValue(args.stepInput),
        stepOutput:
          typeof args.stepOutput === 'undefined' ? undefined : toPrismaJsonValue(args.stepOutput),
      },
    })
  }

  private async findReportForTriage(reportId: string, organizationId: string) {
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

  private async findScopedTriageResultById(id: string, organizationId: string) {
    const triageResult = await this.db.triageResult.findFirst({
      where: {
        id,
        organizationId,
      },
    })

    if (!triageResult) {
      throw new NotFoundError('Triage result not found')
    }

    return triageResult
  }

  private preprocessReport(report: {
    title: string
    sourceType: string
    redactedText: string
  }): PreprocessedReport {
    const normalizedText = normalizeText(report.redactedText)
    const rawSignals = tokenize(`${report.title} ${report.redactedText}`).slice(0, 24)

    return {
      title: report.title,
      sourceType: report.sourceType,
      redactedText: report.redactedText,
      normalizedText,
      rawSignals,
    }
  }

  private classifyReport(preprocessed: PreprocessedReport): ClassifiedReport {
    const text = `${preprocessed.title} ${preprocessed.redactedText}`.toLowerCase()
    const sourceSignals = preprocessed.rawSignals.slice(0, 8)

    if (/(outage|incident|downtime|degraded)/i.test(text)) {
      return { issueType: IssueType.INCIDENT, sourceSignals }
    }

    if (/(latency|slow|timeout|performance)/i.test(text)) {
      return { issueType: IssueType.PERFORMANCE, sourceSignals }
    }

    if (/(security|auth bypass|unauthorized|token leak)/i.test(text)) {
      return { issueType: IssueType.SECURITY, sourceSignals }
    }

    return { issueType: IssueType.BUG, sourceSignals }
  }

  private scoreSeverity(args: {
    rawText: string
    modelSeverity: Severity
    issueType: IssueType
  }): SeverityDecision {
    const text = args.rawText.toLowerCase()

    if (
      /(data loss|security breach|payments down|full outage|all users blocked|cannot checkout)/i.test(
        text,
      )
    ) {
      return {
        severity: Severity.CRITICAL,
        reasoning:
          'Rule-based escalation matched a critical failure pattern affecting revenue, security, or broad availability.',
      }
    }

    if (/(crash|freeze|blank screen|cannot login|blocked|timeout|regression)/i.test(text)) {
      return {
        severity: Severity.HIGH,
        reasoning:
          'Rule-based escalation matched a blocking or crashing workflow likely to interrupt core product use.',
      }
    }

    if (/(visual bug|copy issue|typo|spacing issue)/i.test(text)) {
      return {
        severity: Severity.LOW,
        reasoning: 'Rule-based downgrade matched a cosmetic or presentation-only issue.',
      }
    }

    return {
      severity: args.modelSeverity === Severity.UNKNOWN ? Severity.MEDIUM : args.modelSeverity,
      reasoning: `No hard rule override matched, so the model-assigned severity of ${args.modelSeverity} was used.`,
    }
  }

  private routeOwner(args: {
    rawText: string
    affectedArea: string | null
    suspectedComponent: string | null
    suggestedOwner: string | null
  }): RoutedOwner {
    const combined =
      `${args.affectedArea ?? ''} ${args.suspectedComponent ?? ''} ${args.rawText}`.toLowerCase()

    if (/(auth|login|session|oauth)/i.test(combined)) {
      return {
        suspectedComponent: args.suspectedComponent ?? 'authentication',
        suggestedOwner: 'Client Platform / Auth',
      }
    }

    if (/(payment|billing|checkout|invoice|webhook)/i.test(combined)) {
      return {
        suspectedComponent: args.suspectedComponent ?? 'payments',
        suggestedOwner: 'Payments / Billing',
      }
    }

    if (/(ios|android|mobile|app freeze)/i.test(combined)) {
      return {
        suspectedComponent: args.suspectedComponent ?? 'mobile-client',
        suggestedOwner: 'Mobile / Client Platform',
      }
    }

    if (/(api|platform|infra|retry|queue|logs)/i.test(combined)) {
      return {
        suspectedComponent: args.suspectedComponent ?? 'platform',
        suggestedOwner: 'Platform / Infrastructure',
      }
    }

    return {
      suspectedComponent: args.suspectedComponent ?? args.affectedArea ?? null,
      suggestedOwner: args.suggestedOwner ?? null,
    }
  }

  private async searchDuplicates(args: {
    organizationId: string
    reportId: string
    summary: string
    redactedText: string
  }): Promise<DuplicateCandidate[]> {
    const candidates = await this.db.triageResult.findMany({
      where: {
        organizationId: args.organizationId,
        reportId: { not: args.reportId },
      },
      select: {
        reportId: true,
        summary: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    })

    const searchText = `${args.summary} ${args.redactedText}`

    return candidates
      .map((candidate) => ({
        reportId: candidate.reportId,
        summary: candidate.summary,
        similarity: Number(jaccardSimilarity(searchText, candidate.summary).toFixed(2)),
      }))
      .filter((candidate) => candidate.similarity >= 0.2)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 3)
  }

  private async markReportFailed(args: {
    organizationId: string
    userId: string
    reportId: string
    failureReason: string
    idempotencyKey?: string
    failedStep?: string
  }): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: {
          id: args.reportId,
          organizationId: args.organizationId,
          status: ReportStatus.TRIAGING,
        },
        data: {
          status: ReportStatus.FAILED,
          failureReason: args.failureReason,
        },
      })

      if (args.idempotencyKey) {
        await tx.idempotencyKey.updateMany({
          where: {
            organizationId: args.organizationId,
            userId: args.userId,
            reportId: args.reportId,
            key: args.idempotencyKey,
          },
          data: {
            status: IdempotencyStatus.FAILED,
            responseCode: 502,
          },
        })
      }

      await this.logPipelineEvent({
        organizationId: args.organizationId,
        reportId: args.reportId,
        stepName: args.failedStep ?? 'triage_failed',
        stepOutput: {
          failureReason: args.failureReason,
        },
        tx,
      })
    })
  }

  async runTriage(args: {
    actor: AuthContext
    organization: OrganizationContext
    reportId: string
    idempotencyKey?: string
    requestContext: RequestAuditContext
  }): Promise<RunTriageResult> {
    if (args.organization.role === OrganizationRole.VIEWER) {
      throw new ForbiddenError('Viewers cannot run triage')
    }

    const existingReport = await this.findReportForTriage(
      args.reportId,
      args.organization.organizationId,
    )
    const preexistingResult = await this.db.triageResult.findUnique({
      where: { reportId: existingReport.id },
    })

    if (preexistingResult) {
      return {
        state: 'completed',
        idempotent: true,
        triageResult: serializeTriageResult(preexistingResult),
        reportStatus: existingReport.status,
      }
    }

    if (existingReport.status === ReportStatus.TRIAGING) {
      return {
        state: 'in_progress',
        idempotent: true,
        reportStatus: ReportStatus.TRIAGING,
      }
    }

    if (
      existingReport.status !== ReportStatus.SUBMITTED &&
      existingReport.status !== ReportStatus.FAILED
    ) {
      throw new ConflictError('This report cannot be triaged in its current state')
    }

    if (args.idempotencyKey) {
      const idempotencyRecord = await this.db.idempotencyKey.findUnique({
        where: {
          organizationId_userId_reportId_key: {
            organizationId: args.organization.organizationId,
            userId: args.actor.userId,
            reportId: args.reportId,
            key: args.idempotencyKey,
          },
        },
      })

      if (idempotencyRecord?.status === IdempotencyStatus.IN_PROGRESS) {
        return {
          state: 'in_progress',
          idempotent: true,
          reportStatus: ReportStatus.TRIAGING,
        }
      }

      if (
        idempotencyRecord?.status === IdempotencyStatus.COMPLETED &&
        idempotencyRecord.triageResultId
      ) {
        const existingResult = await this.findScopedTriageResultById(
          idempotencyRecord.triageResultId,
          args.organization.organizationId,
        )

        return {
          state: 'completed',
          idempotent: true,
          triageResult: serializeTriageResult(existingResult),
          reportStatus: ReportStatus.TRIAGED,
        }
      }
    }

    const started = await this.db.$transaction(async (tx) => {
      if (args.idempotencyKey) {
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            organizationId_userId_reportId_key: {
              organizationId: args.organization.organizationId,
              userId: args.actor.userId,
              reportId: args.reportId,
              key: args.idempotencyKey,
            },
          },
        })

        if (!existingKey) {
          await tx.idempotencyKey.create({
            data: {
              organizationId: args.organization.organizationId,
              userId: args.actor.userId,
              reportId: args.reportId,
              key: args.idempotencyKey,
              requestHash: `${args.reportId}:${args.actor.userId}`,
              status: IdempotencyStatus.IN_PROGRESS,
            },
          })
        }
      }

      const updateResult = await tx.report.updateMany({
        where: {
          id: args.reportId,
          organizationId: args.organization.organizationId,
          status: {
            in: [ReportStatus.SUBMITTED, ReportStatus.FAILED],
          },
        },
        data: {
          status: ReportStatus.TRIAGING,
          failureReason: null,
        },
      })

      return updateResult.count === 1
    })

    if (!started) {
      const triagingReport = await this.findReportForTriage(
        args.reportId,
        args.organization.organizationId,
      )

      if (triagingReport.status === ReportStatus.TRIAGING) {
        return {
          state: 'in_progress',
          idempotent: true,
          reportStatus: ReportStatus.TRIAGING,
        }
      }

      const lateResult = await this.db.triageResult.findUnique({
        where: { reportId: args.reportId },
      })

      if (lateResult) {
        return {
          state: 'completed',
          idempotent: true,
          triageResult: serializeTriageResult(lateResult),
          reportStatus: triagingReport.status,
        }
      }

      throw new ConflictError('Invalid report state transition')
    }

    const preprocessed = this.preprocessReport(existingReport)
    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'preprocess',
      stepInput: {
        title: existingReport.title,
        sourceType: existingReport.sourceType,
      },
      stepOutput: preprocessed,
    })

    const classification = this.classifyReport(preprocessed)
    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'classify_report',
      stepInput: {
        sourceType: existingReport.sourceType,
        title: existingReport.title,
      },
      stepOutput: classification,
    })

    let providerResult

    try {
      providerResult = await this.llmProvider.generateStructuredTriage({
        reportId: existingReport.id,
        title: existingReport.title,
        sourceType: existingReport.sourceType,
        redactedText: existingReport.redactedText,
      })
    } catch (error) {
      const safeReason = error instanceof ExternalServiceError ? error.message : 'LLM triage failed'

      await this.markReportFailed({
        organizationId: args.organization.organizationId,
        userId: args.actor.userId,
        reportId: existingReport.id,
        failureReason: safeReason,
        idempotencyKey: args.idempotencyKey,
        failedStep: 'extract_structured_fields',
      })

      throw new ExternalServiceError('Triage failed safely. Please retry later.')
    }

    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'extract_structured_fields',
      stepInput: {
        reportId: existingReport.id,
        title: existingReport.title,
      },
      stepOutput: providerResult.output,
    })

    const duplicateCandidates = await this.searchDuplicates({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      summary: providerResult.output.summary,
      redactedText: existingReport.redactedText,
    })

    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'search_duplicates',
      stepInput: {
        summary: providerResult.output.summary,
      },
      stepOutput: duplicateCandidates,
    })

    const severityDecision = this.scoreSeverity({
      rawText: `${existingReport.title} ${existingReport.redactedText}`,
      modelSeverity: providerResult.output.severity,
      issueType:
        providerResult.output.issueType === IssueType.UNKNOWN
          ? classification.issueType
          : providerResult.output.issueType,
    })

    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'score_severity',
      stepInput: {
        modelSeverity: providerResult.output.severity,
      },
      stepOutput: severityDecision,
    })

    const routedOwner = this.routeOwner({
      rawText: existingReport.redactedText,
      affectedArea: providerResult.output.affectedArea ?? null,
      suspectedComponent: providerResult.output.suspectedComponent ?? null,
      suggestedOwner: providerResult.output.suggestedOwner ?? null,
    })

    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'route_owner',
      stepInput: {
        affectedArea: providerResult.output.affectedArea,
        suspectedComponent: providerResult.output.suspectedComponent,
        suggestedOwner: providerResult.output.suggestedOwner,
      },
      stepOutput: routedOwner,
    })

    const issueType =
      providerResult.output.issueType === IssueType.UNKNOWN
        ? classification.issueType
        : providerResult.output.issueType
    const duplicateSignals = duplicateCandidates.map(
      (candidate) => `${candidate.reportId} (${candidate.similarity}): ${candidate.summary}`,
    )
    const followUpMessage =
      providerResult.output.followUpMessage ??
      createFollowUpMessage(providerResult.output.missingInformation)
    const nextAction =
      providerResult.output.nextAction ??
      buildFallbackNextAction({
        severity: severityDecision.severity,
        missingInformation: providerResult.output.missingInformation,
        suggestedOwner: routedOwner.suggestedOwner,
      })

    await this.logPipelineEvent({
      organizationId: args.organization.organizationId,
      reportId: existingReport.id,
      stepName: 'generate_final_triage',
      stepInput: {
        modelProvider: providerResult.modelProvider,
      },
      stepOutput: {
        issueType,
        severity: severityDecision.severity,
        suspectedComponent: routedOwner.suspectedComponent,
        suggestedOwner: routedOwner.suggestedOwner,
        duplicateSignals,
        nextAction,
        followUpMessage,
      },
    })

    try {
      const triageResult = await this.db.$transaction(async (tx) => {
        const created = await tx.triageResult.upsert({
          where: { reportId: existingReport.id },
          update: {
            summary: providerResult.output.summary,
            issueType,
            severity: severityDecision.severity,
            confidenceScore: providerResult.output.confidenceScore,
            customerImpact: providerResult.output.customerImpact ?? null,
            affectedArea: providerResult.output.affectedArea ?? null,
            suspectedComponent: routedOwner.suspectedComponent,
            reproSteps: toPrismaJsonValue(providerResult.output.reproSteps),
            expectedBehavior: providerResult.output.expectedBehavior ?? null,
            actualBehavior: providerResult.output.actualBehavior ?? null,
            missingInformation: toPrismaJsonValue(providerResult.output.missingInformation),
            suggestedOwner: routedOwner.suggestedOwner,
            suggestedLabels: toPrismaJsonValue(providerResult.output.suggestedLabels),
            duplicateSignals: toPrismaJsonValue(duplicateSignals),
            duplicateCandidates: toPrismaJsonValue(duplicateCandidates),
            severityReasoning:
              providerResult.output.severityReasoning ?? severityDecision.reasoning,
            nextAction,
            followUpMessage,
            ticketTitle: providerResult.output.ticketTitle,
            ticketDescription: providerResult.output.ticketDescription,
            rawModelOutput: providerResult.rawOutput,
            modelProvider: providerResult.modelProvider,
            modelName: providerResult.modelName,
          },
          create: {
            reportId: existingReport.id,
            organizationId: args.organization.organizationId,
            summary: providerResult.output.summary,
            issueType,
            severity: severityDecision.severity,
            confidenceScore: providerResult.output.confidenceScore,
            customerImpact: providerResult.output.customerImpact ?? null,
            affectedArea: providerResult.output.affectedArea ?? null,
            suspectedComponent: routedOwner.suspectedComponent,
            reproSteps: toPrismaJsonValue(providerResult.output.reproSteps),
            expectedBehavior: providerResult.output.expectedBehavior ?? null,
            actualBehavior: providerResult.output.actualBehavior ?? null,
            missingInformation: toPrismaJsonValue(providerResult.output.missingInformation),
            suggestedOwner: routedOwner.suggestedOwner,
            suggestedLabels: toPrismaJsonValue(providerResult.output.suggestedLabels),
            duplicateSignals: toPrismaJsonValue(duplicateSignals),
            duplicateCandidates: toPrismaJsonValue(duplicateCandidates),
            severityReasoning:
              providerResult.output.severityReasoning ?? severityDecision.reasoning,
            nextAction,
            followUpMessage,
            ticketTitle: providerResult.output.ticketTitle,
            ticketDescription: providerResult.output.ticketDescription,
            rawModelOutput: providerResult.rawOutput,
            modelProvider: providerResult.modelProvider,
            modelName: providerResult.modelName,
          },
        })

        await tx.report.update({
          where: { id: existingReport.id },
          data: {
            status: ReportStatus.TRIAGED,
            failureReason: null,
          },
        })

        if (args.idempotencyKey) {
          await tx.idempotencyKey.updateMany({
            where: {
              organizationId: args.organization.organizationId,
              userId: args.actor.userId,
              reportId: args.reportId,
              key: args.idempotencyKey,
            },
            data: {
              status: IdempotencyStatus.COMPLETED,
              responseCode: 200,
              triageResultId: created.id,
            },
          })
        }

        await this.auditLogService.record(
          {
            ...args.requestContext,
            organizationId: args.organization.organizationId,
            actorUserId: args.actor.userId,
            action: AuditAction.TRIAGE_RUN,
            targetType: 'TRIAGE_RESULT',
            targetId: created.id,
            metadata: {
              reportId: existingReport.id,
              modelProvider: providerResult.modelProvider,
              modelName: providerResult.modelName,
              pipeline: [
                'preprocess',
                'classify_report',
                'extract_structured_fields',
                'search_duplicates',
                'score_severity',
                'route_owner',
                'generate_final_triage',
              ],
            },
          },
          tx,
        )

        await this.usageService.record(
          {
            organizationId: args.organization.organizationId,
            userId: args.actor.userId,
            eventType: UsageEventType.TRIAGE_RUN,
            metadata: { reportId: existingReport.id },
          },
          tx,
        )

        return created
      })

      return {
        state: 'completed',
        idempotent: false,
        triageResult: serializeTriageResult(triageResult),
        reportStatus: ReportStatus.TRIAGED,
      }
    } catch {
      await this.markReportFailed({
        organizationId: args.organization.organizationId,
        userId: args.actor.userId,
        reportId: existingReport.id,
        failureReason: 'Triage persistence failed',
        idempotencyKey: args.idempotencyKey,
        failedStep: 'persist_final_triage',
      })

      throw new ExternalServiceError('Triage failed safely. Please retry later.')
    }
  }

  async getTriageResultForReport(args: {
    organization: OrganizationContext
    reportId: string
  }): Promise<Record<string, unknown>> {
    await this.findReportForTriage(args.reportId, args.organization.organizationId)

    const triageResult = await this.db.triageResult.findUnique({
      where: { reportId: args.reportId },
    })

    if (!triageResult || triageResult.organizationId !== args.organization.organizationId) {
      throw new NotFoundError('Triage result not found')
    }

    return serializeTriageResult(triageResult)
  }

  async updateTriageResult(args: {
    organization: OrganizationContext
    triageResultId: string
    input: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    if (
      args.organization.role !== OrganizationRole.ADMIN &&
      args.organization.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenError('Only admins and owners can update triage results')
    }

    const triageResult = await this.findScopedTriageResultById(
      args.triageResultId,
      args.organization.organizationId,
    )

    const updated = await this.db.triageResult.update({
      where: { id: triageResult.id },
      data: {
        ...args.input,
        reproSteps:
          typeof args.input.reproSteps !== 'undefined'
            ? toPrismaJsonValue(args.input.reproSteps)
            : undefined,
        missingInformation:
          typeof args.input.missingInformation !== 'undefined'
            ? toPrismaJsonValue(args.input.missingInformation)
            : undefined,
        suggestedLabels:
          typeof args.input.suggestedLabels !== 'undefined'
            ? toPrismaJsonValue(args.input.suggestedLabels)
            : undefined,
        duplicateSignals:
          typeof args.input.duplicateSignals !== 'undefined'
            ? toPrismaJsonValue(args.input.duplicateSignals)
            : undefined,
        duplicateCandidates:
          typeof args.input.duplicateCandidates !== 'undefined'
            ? toPrismaJsonValue(args.input.duplicateCandidates)
            : undefined,
      },
    })

    return serializeTriageResult(updated)
  }
}
