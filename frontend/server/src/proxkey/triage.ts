import crypto from 'crypto'
import OpenAI from 'openai'
import {
  Prisma,
  ReportSource,
  ReportStatus,
  Severity,
  TriageArtifactType,
  UserRole,
} from '@prisma/client'
import { prisma } from './db'
import { redactSensitiveText } from './security'
import type { ProxKeyConfig } from './config'
import type {
  ExtractedSignal,
  PacketEvidence,
  PacketUncertainty,
  QueueJobData,
  ReportPayload,
  TriageDraft,
} from './types'

function nowMs(): number {
  return Date.now()
}

function duration(startedAt: number): number {
  return nowMs() - startedAt
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9/_-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
}

function similarity(left: string, right: string): number {
  const a = new Set(tokenize(left))
  const b = new Set(tokenize(right))
  if (a.size === 0 || b.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1
    }
  }

  return intersection / (a.size + b.size - intersection)
}

const SIGNAL_PATTERNS: Array<{ name: string; pattern: RegExp; confidence: number }> = [
  { name: 'trace_id', pattern: /\btrace[_-]?id[=:]\s*([a-z0-9_-]+)/i, confidence: 0.95 },
  { name: 'request_id', pattern: /\b(request|req)[_-]?id[=:]\s*([a-z0-9_-]+)/i, confidence: 0.9 },
  { name: 'http_status', pattern: /\b(4\d\d|5\d\d)\b/, confidence: 0.86 },
  {
    name: 'test_file',
    pattern: /\b([a-z0-9_.-]+\.(test|spec)\.(ts|tsx|js|jsx))\b/i,
    confidence: 0.88,
  },
  { name: 'deploy', pattern: /\b(deploy|release|rollback|rollout)\b/i, confidence: 0.78 },
  {
    name: 'queue_depth',
    pattern: /\b(queue depth|backlog|worker lag|dead letter|dlq)\b/i,
    confidence: 0.8,
  },
  {
    name: 'payment_flow',
    pattern: /\b(checkout|payment|apple pay|stripe|callback)\b/i,
    confidence: 0.82,
  },
  {
    name: 'auth_flow',
    pattern: /\b(auth|oauth|login|session|token|callback)\b/i,
    confidence: 0.82,
  },
  {
    name: 'environment',
    pattern: /\b(production|prod|staging|main|preview|ci)\b/i,
    confidence: 0.74,
  },
]

const CLUSTER_STOP_WORDS = new Set([
  'after',
  'again',
  'before',
  'build',
  'cannot',
  'customer',
  'during',
  'failed',
  'failure',
  'from',
  'have',
  'into',
  'latest',
  'main',
  'only',
  'says',
  'seeing',
  'same',
  'test',
  'that',
  'then',
  'this',
  'with',
  'yesterday',
])

function severityLabel(severity: Severity): string {
  if (severity === Severity.CRITICAL) return 'SEV-1'
  if (severity === Severity.HIGH) return 'SEV-2'
  if (severity === Severity.MEDIUM) return 'SEV-3'
  return 'SEV-4'
}

function sourceLabel(source: ReportSource): string {
  return source
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferClassification(args: {
  title: string
  source: ReportSource
  text: string
  logs: string | null
}): string {
  const input = `${args.title}\n${args.text}\n${args.logs ?? ''}`.toLowerCase()

  if (
    /(rollback|deploy|release|regression|after auth|after .* deploy|latest .* deploy)/.test(input)
  ) {
    return 'Release regression'
  }
  if (
    /(incident|outage|sev-?\d|pagerduty|service degraded)/.test(input) ||
    args.source === ReportSource.INCIDENT
  ) {
    return 'Incident evidence'
  }
  if (
    /(support|customer|screenshot|complaint|ticket)/.test(input) ||
    args.source === ReportSource.SUPPORT
  ) {
    return 'Support escalation'
  }
  if (
    /(github actions|ci runner|test shard|failed shard|build failed)/.test(input) ||
    args.source === ReportSource.CI ||
    args.source === ReportSource.GITHUB_ACTIONS
  ) {
    return 'CI failure'
  }
  if (/(qa|repro|acceptance|test plan)/.test(input) || args.source === ReportSource.QA) {
    return 'QA intake'
  }
  if (/(latency|slow|queue depth|worker lag|timeout)/.test(input)) {
    return 'Performance degradation'
  }
  if (/(security|unauthorized|token leak|secret|breach)/.test(input)) {
    return 'Security risk'
  }

  return 'Bug report'
}

function inferComponent(input: string): string {
  const text = input.toLowerCase()
  const pairs: Array<[string, string]> = [
    ['auth', 'Auth'],
    ['login', 'Auth'],
    ['oauth', 'Auth'],
    ['session', 'Auth'],
    ['billing', 'Billing'],
    ['checkout', 'Billing'],
    ['payment', 'Payments'],
    ['apple pay', 'Payments'],
    ['callback', 'Callback'],
    ['api', 'API'],
    ['queue', 'Queue'],
    ['worker', 'Worker'],
    ['db', 'Database'],
    ['postgres', 'Database'],
    ['redis', 'Queue'],
    ['ci', 'CI'],
    ['github actions', 'CI'],
    ['build', 'Build'],
    ['frontend', 'Frontend'],
    ['ui', 'Frontend'],
    ['dashboard', 'Dashboard'],
  ]

  const match = pairs.find(([needle]) => text.includes(needle))
  if (match?.[1] === 'Callback' && /(checkout|payment|apple pay|stripe)/.test(text)) {
    return 'payment-callback'
  }

  return match?.[1] ?? 'Core Platform'
}

function extractSignals(input: string): ExtractedSignal[] {
  const signals: ExtractedSignal[] = []
  const seen = new Set<string>()

  for (const { name, pattern, confidence } of SIGNAL_PATTERNS) {
    const match = pattern.exec(input)
    if (!match) {
      continue
    }

    const value = match[2] ?? match[1] ?? match[0]
    const key = `${name}:${value.toLowerCase()}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    signals.push({
      name,
      value,
      confidence,
      provenance: 'raw_evidence',
    })
  }

  const files = Array.from(input.matchAll(/\b([a-z0-9/_-]+\.(ts|tsx|js|jsx|go|py|rb|java))\b/gi))
    .map((match) => match[1])
    .filter(Boolean)
    .slice(0, 5)

  for (const file of files) {
    const key = `file:${file.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      signals.push({
        name: 'file',
        value: file,
        confidence: 0.76,
        provenance: 'raw_evidence',
      })
    }
  }

  return signals.slice(0, 12)
}

function buildEvidence(args: {
  reportId: string
  source: ReportSource
  title: string
  redactedText: string
  redactedLogs: string | null
  artifacts: Array<{
    id: string
    type: TriageArtifactType
    content: string
    createdAt: Date
  }>
  receivedAt: Date
}): PacketEvidence[] {
  const receivedAt = args.receivedAt.toISOString()
  const evidence: PacketEvidence[] = [
    {
      id: `${args.reportId}:raw_text`,
      source: args.source,
      type: 'raw_text',
      title: args.title,
      content: args.redactedText,
      provenance: {
        reportId: args.reportId,
        receivedAt,
      },
    },
  ]

  if (args.redactedLogs) {
    evidence.push({
      id: `${args.reportId}:logs`,
      source: args.source,
      type: 'logs',
      title: `${sourceLabel(args.source)} logs`,
      content: args.redactedLogs,
      provenance: {
        reportId: args.reportId,
        receivedAt,
      },
    })
  }

  for (const artifact of args.artifacts) {
    evidence.push({
      id: artifact.id,
      source: args.source,
      type: 'artifact',
      title: artifact.type.toLowerCase(),
      content: redactSensitiveText(artifact.content),
      provenance: {
        reportId: args.reportId,
        artifactId: artifact.id,
        receivedAt: artifact.createdAt.toISOString(),
      },
    })
  }

  return evidence
}

function inferReproSteps(input: string): string[] {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)

  const steps = lines.filter((line) => /^(\d+\.|-|\*)\s+/.test(line))
  if (steps.length > 0) {
    return steps.map((line) => line.replace(/^(\d+\.|-|\*)\s+/, ''))
  }

  return lines.slice(0, 3)
}

function inferMissingInfo(input: string, logs: string | null): string[] {
  const missing: string[] = []
  if (!/steps to reproduce|repro|reproduce|when/i.test(input)) {
    missing.push('Explicit reproduction steps')
  }
  if (!logs || logs.trim().length < 20) {
    missing.push('Execution logs or stack trace')
  }
  if (!/expected|should/i.test(input)) {
    missing.push('Expected behavior')
  }

  return missing
}

function inferSeverity(input: string, logs: string | null): Severity {
  const text = `${input}\n${logs ?? ''}`.toLowerCase()
  if (/(outage|sev0|critical|p0|data loss|security|breach)/.test(text)) {
    return Severity.CRITICAL
  }
  if (/(500|crash|cannot login|failing ci|deploy failed|payment failed|blocking)/.test(text)) {
    return Severity.HIGH
  }
  if (/(warning|flaky|slow|latency|degraded)/.test(text)) {
    return Severity.MEDIUM
  }
  return Severity.LOW
}

function inferSuspectedRootCause(args: {
  classification: string
  component: string
  text: string
  logs: string | null
}): string {
  const input = `${args.text}\n${args.logs ?? ''}`.toLowerCase()

  if (args.classification === 'Release regression') {
    return `Recent deploy likely changed ${args.component} behavior.`
  }
  if (/(queue depth|worker lag|backlog|dlq)/.test(input)) {
    return `Queue pressure is likely amplifying ${args.component} failures.`
  }
  if (/(callback|webhook|redirect|apple pay)/.test(input)) {
    return `${args.component} callback handling may be dropping or failing completion events.`
  }
  if (/(timeout|latency|slow)/.test(input)) {
    return `${args.component} dependency latency or timeout budget is likely too tight.`
  }
  if (/(token|session|oauth|unauthorized)/.test(input)) {
    return `${args.component} auth/session state may be invalid or mismatched.`
  }

  return `Likely issue area is ${args.component}; confirm with source logs and recent changes.`
}

function buildUncertainty(args: {
  missingInfo: string[]
  duplicateCandidates: Array<{ similarity: number }>
  ownerName: string | null
}): PacketUncertainty[] {
  const uncertainty = args.missingInfo.map((field) => ({
    field,
    reason: 'The source evidence did not include enough detail to confirm this field.',
  }))

  if (args.duplicateCandidates.length === 0) {
    uncertainty.push({
      field: 'duplicate cluster',
      reason: 'No sufficiently similar prior packet was found in this workspace.',
    })
  }

  if (!args.ownerName) {
    uncertainty.push({
      field: 'owner',
      reason: 'No active owner or triage lead matched the inferred component.',
    })
  }

  return uncertainty
}

function computeConfidence(args: {
  reproSteps: string[]
  missingInfo: string[]
  duplicateCandidates: Array<{ similarity: number }>
  severity: Severity
}): number {
  let score = 0.45
  score += Math.min(args.reproSteps.length, 3) * 0.08
  score -= Math.min(args.missingInfo.length, 3) * 0.07
  score += (args.duplicateCandidates[0]?.similarity ?? 0) * 0.14
  if (args.severity === Severity.HIGH || args.severity === Severity.CRITICAL) {
    score += 0.06
  }

  return Math.max(0.25, Math.min(0.97, Number(score.toFixed(2))))
}

function buildNextAction(args: {
  severity: Severity
  missingInfo: string[]
  component: string
  classification: string
  clusterSize: number
}): string {
  if (args.missingInfo.length > 0) {
    return `Request ${args.missingInfo.join(', ').toLowerCase()} before routing ${args.component}.`
  }

  if (args.severity === Severity.CRITICAL || args.severity === Severity.HIGH) {
    if (args.classification === 'Release regression') {
      return `Rollback or pause the candidate deploy, attach traces, and route ${args.component} to the owning team.`
    }
    if (args.clusterSize > 1) {
      return `Escalate the recurring ${args.component} cluster and compare against the first seen packet.`
    }
    return `Page the owning team for ${args.component} and compare against the last green build.`
  }

  return `Route to the ${args.component} owner and verify against recent changes.`
}

function buildRecommendedActions(args: {
  nextAction: string
  severity: Severity
  classification: string
  component: string
  clusterSize: number
  missingInfo: string[]
}): string[] {
  const actions = [args.nextAction]

  if (args.clusterSize > 1) {
    actions.push(
      `Review ${args.clusterSize} clustered packets for shared deploy, trace, or source patterns.`,
    )
  }
  if (args.classification === 'Release regression') {
    actions.push(
      'Compare the failing path against the latest deploy and last known healthy release.',
    )
  }
  if (args.severity === Severity.CRITICAL || args.severity === Severity.HIGH) {
    actions.push(`Attach production traces and notify ${args.component} owner before export.`)
  }
  if (args.missingInfo.length > 0) {
    actions.push(`Collect missing context: ${args.missingInfo.join(', ')}.`)
  }

  return Array.from(new Set(actions)).slice(0, 5)
}

function clusterTokens(input: string): string[] {
  return tokenize(input)
    .map((token) => token.replace(/[^a-z0-9_-]/g, ''))
    .filter((token) => token.length >= 4)
    .filter((token) => !CLUSTER_STOP_WORDS.has(token))
    .filter((token) => !/^trace[_-]?id$/.test(token))
    .filter((token) => !/^[a-f0-9]{12,}$/.test(token))
    .slice(0, 18)
}

function buildClusterKey(args: {
  component: string
  classification: string
  title: string
  text: string
  logs: string | null
}): string {
  const importantTokens = clusterTokens(`${args.title}\n${args.text}\n${args.logs ?? ''}`)
    .sort()
    .slice(0, 10)
    .join(':')
  const base = `${args.component.toLowerCase()}:${args.classification.toLowerCase()}:${importantTokens}`
  return crypto.createHash('sha1').update(base).digest('hex').slice(0, 16)
}

function buildClusterTitle(args: {
  title: string
  component: string
  classification: string
}): string {
  const compactTitle = args.title.replace(/\s+/g, ' ').trim()
  if (compactTitle.length <= 80) {
    return compactTitle
  }

  return `${args.component} ${args.classification.toLowerCase()} cluster`
}

async function upsertPacketCluster(args: {
  orgId: string
  key: string
  title: string
  component: string
  severity: Severity
  classification: string
  signalNames: string[]
}) {
  return prisma.packetCluster.upsert({
    where: {
      orgId_key: {
        orgId: args.orgId,
        key: args.key,
      },
    },
    create: {
      orgId: args.orgId,
      key: args.key,
      title: args.title,
      component: args.component,
      severity: args.severity,
      lastSeenAt: new Date(),
      metadataJson: {
        classification: args.classification,
        signalNames: args.signalNames,
      },
    },
    update: {
      title: args.title,
      component: args.component,
      severity: args.severity,
      lastSeenAt: new Date(),
      metadataJson: {
        classification: args.classification,
        signalNames: args.signalNames,
      },
    },
  })
}

async function refreshClusterPacketCount(clusterId: string): Promise<number> {
  const packetCount = await prisma.report.count({
    where: {
      clusterId,
    },
  })

  await prisma.packetCluster.update({
    where: { id: clusterId },
    data: { packetCount },
  })

  return packetCount
}

async function tryModelGeneration(args: {
  config: ProxKeyConfig
  report: {
    title: string
    rawText: string
    logs: string | null
  }
  heuristicDraft: TriageDraft
}): Promise<Partial<TriageDraft> | null> {
  if (!args.config.AI_API_KEY || !args.config.AI_MODEL || !args.config.AI_BASE_URL) {
    return null
  }

  const client = new OpenAI({
    apiKey: args.config.AI_API_KEY,
    baseURL: args.config.AI_BASE_URL,
  })

  const prompt = [
    'You are an internal engineering triage engine.',
    'Return strict JSON with keys: summary, classification, component, suspectedRootCause, reproSteps, missingInfo, recommendedActions, nextAction.',
    `Title: ${args.report.title}`,
    `Report: ${args.report.rawText}`,
    `Logs: ${args.report.logs ?? ''}`,
    `Heuristic severity: ${args.heuristicDraft.severity}`,
    `Heuristic classification: ${args.heuristicDraft.classification}`,
    `Heuristic component: ${args.heuristicDraft.component}`,
  ].join('\n')

  const response = await client.responses.create({
    model: args.config.AI_MODEL,
    input: prompt,
    temperature: 0.2,
  })

  const text = response.output_text?.trim()
  if (!text) {
    return null
  }

  const parsed = JSON.parse(text) as Partial<TriageDraft>
  return parsed
}

export async function createReportRecord(args: {
  orgId: string
  actorId: string | null
  payload: ReportPayload
}) {
  const report = await prisma.report.create({
    data: {
      orgId: args.orgId,
      projectId: args.payload.projectId ?? null,
      source: args.payload.source,
      title: args.payload.title,
      rawText: args.payload.rawText,
      logs: args.payload.logs ?? null,
      metadataJson: (args.payload.metadataJson ?? {}) as Prisma.InputJsonValue,
      status: ReportStatus.PROCESSING,
      triageArtifacts: args.payload.artifacts
        ? {
            create: args.payload.artifacts.map((artifact) => ({
              type: artifact.type,
              content: artifact.content,
            })),
          }
        : undefined,
    },
  })

  await prisma.auditLog.create({
    data: {
      orgId: args.orgId,
      userId: args.actorId,
      action: 'REPORT_CREATED',
      entityType: 'report',
      entityId: report.id,
      metadataJson: {
        title: args.payload.title,
        source: args.payload.source,
      },
    },
  })

  return report
}

export async function performTriage(config: ProxKeyConfig, job: QueueJobData): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: job.reportId },
    include: {
      triageArtifacts: true,
    },
  })

  if (!report) {
    return
  }

  const previousClusterId = report.clusterId
  const priorResult = await prisma.triageResult.findUnique({
    where: { reportId: report.id },
  })

  if (priorResult) {
    await prisma.triageResult.delete({
      where: { reportId: report.id },
    })
  }

  await prisma.triageStep.deleteMany({
    where: { reportId: report.id },
  })

  await prisma.report.update({
    where: { id: report.id },
    data: {
      status: ReportStatus.PROCESSING,
      updatedAt: new Date(),
    },
  })

  const redactStart = nowMs()
  const redactedText = redactSensitiveText(report.rawText)
  const redactedLogs = report.logs ? redactSensitiveText(report.logs) : null
  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'redact_sensitive_data',
      input: { rawTextLength: report.rawText.length, hasLogs: Boolean(report.logs) },
      output: { redactedTextPreview: redactedText.slice(0, 240) },
      durationMs: duration(redactStart),
    },
  })

  const normalizeStart = nowMs()
  const fullInput = `${report.title}\n${redactedText}\n${redactedLogs ?? ''}`
  const evidence = buildEvidence({
    reportId: report.id,
    source: report.source,
    title: report.title,
    redactedText,
    redactedLogs,
    artifacts: report.triageArtifacts,
    receivedAt: report.createdAt,
  })
  const extractedSignals = extractSignals(fullInput)
  const classification = inferClassification({
    title: report.title,
    source: report.source,
    text: redactedText,
    logs: redactedLogs,
  })
  const component = inferComponent(fullInput)
  const reproSteps = inferReproSteps(redactedText)
  const missingInfo = inferMissingInfo(redactedText, redactedLogs)
  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'normalize_evidence',
      input: { title: report.title },
      output: {
        classification,
        component,
        evidenceCount: evidence.length,
        extractedSignals,
        reproSteps,
        missingInfo,
      },
      durationMs: duration(normalizeStart),
    },
  })

  const severityStart = nowMs()
  const severity = inferSeverity(redactedText, redactedLogs)
  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'classify_severity',
      input: { text: redactedText.slice(0, 400) },
      output: { severity },
      durationMs: duration(severityStart),
    },
  })

  const clusterStart = nowMs()
  const clusterKey = buildClusterKey({
    component,
    classification,
    title: report.title,
    text: redactedText,
    logs: redactedLogs,
  })
  const clusterTitle = buildClusterTitle({
    title: report.title,
    component,
    classification,
  })
  const cluster = await upsertPacketCluster({
    orgId: report.orgId,
    key: clusterKey,
    title: clusterTitle,
    component,
    severity,
    classification,
    signalNames: extractedSignals.map((signal) => signal.name),
  })

  await prisma.report.update({
    where: { id: report.id },
    data: {
      clusterId: cluster.id,
      updatedAt: new Date(),
    },
  })

  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'cluster_packet',
      input: {
        component,
        classification,
        signalNames: extractedSignals.map((signal) => signal.name),
      },
      output: {
        clusterId: cluster.id,
        clusterKey,
        clusterTitle: cluster.title,
      },
      durationMs: duration(clusterStart),
    },
  })

  const duplicateStart = nowMs()
  const candidateReports = await prisma.report.findMany({
    where: {
      orgId: report.orgId,
      id: { not: report.id },
    },
    include: {
      triageResult: {
        select: {
          summary: true,
          clusterId: true,
        },
      },
      cluster: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    take: 25,
    orderBy: { createdAt: 'desc' },
  })

  const duplicateCandidates = candidateReports
    .map((candidate) => {
      const candidateClusterId = candidate.clusterId ?? candidate.triageResult?.clusterId ?? null
      const textSimilarity = similarity(
        `${candidate.title}\n${candidate.rawText}`,
        `${report.title}\n${redactedText}`,
      )
      const clusterSimilarity = candidateClusterId === cluster.id ? 0.98 : 0
      return {
        reportId: candidate.id,
        title: candidate.title,
        clusterId: candidateClusterId,
        similarity: Number(Math.max(textSimilarity, clusterSimilarity).toFixed(2)),
      }
    })
    .filter((candidate) => candidate.similarity >= 0.2 || candidate.clusterId === cluster.id)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 5)

  const clusterSize = await refreshClusterPacketCount(cluster.id)

  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'detect_duplicates',
      input: { checkedReports: candidateReports.length },
      output: { clusterId: cluster.id, clusterSize, duplicateCandidates },
      durationMs: duration(duplicateStart),
    },
  })

  const ownerStart = nowMs()
  const owners = await prisma.user.findMany({
    where: {
      orgId: report.orgId,
      status: { not: 'DISABLED' },
      role: { in: [UserRole.OWNER, UserRole.ADMIN, UserRole.TRIAGE_LEAD, UserRole.EMPLOYEE] },
    },
    orderBy: [{ role: 'asc' }, { lastActive: 'desc' }],
  })

  const historicalOwnerResult = await prisma.triageResult.findFirst({
    where: {
      component,
      suggestedOwnerId: { not: null },
      report: {
        orgId: report.orgId,
      },
    },
    include: {
      suggestedOwner: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  const ownerMatch =
    historicalOwnerResult?.suggestedOwner ??
    owners.find((user) => user.name.toLowerCase().includes(component.toLowerCase())) ??
    owners.find((user) => user.role === UserRole.TRIAGE_LEAD) ??
    owners.find((user) => user.role === UserRole.ADMIN) ??
    owners[0] ??
    null

  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'suggest_owner',
      input: { component, ownerPool: owners.length },
      output: ownerMatch
        ? {
            suggestedOwnerId: ownerMatch.id,
            suggestedOwnerEmail: ownerMatch.email,
          }
        : { suggestedOwnerId: null },
      durationMs: duration(ownerStart),
    },
  })

  const suspectedRootCause = inferSuspectedRootCause({
    classification,
    component,
    text: redactedText,
    logs: redactedLogs,
  })
  const nextAction = buildNextAction({
    severity,
    missingInfo,
    component,
    classification,
    clusterSize,
  })
  const recommendedActions = buildRecommendedActions({
    nextAction,
    severity,
    classification,
    component,
    clusterSize,
    missingInfo,
  })
  const uncertainty = buildUncertainty({
    missingInfo,
    duplicateCandidates,
    ownerName: ownerMatch?.name ?? null,
  })

  const heuristicDraft: TriageDraft = {
    summary: `${report.title}: ${redactedText.slice(0, 220).replace(/\s+/g, ' ').trim()}`,
    classification,
    severity,
    severityLabel: severityLabel(severity),
    component,
    suspectedRootCause,
    evidence,
    extractedSignals,
    reproSteps,
    missingInfo,
    uncertainty,
    duplicateCandidates,
    clusterId: cluster.id,
    clusterTitle: cluster.title,
    suggestedOwnerId: ownerMatch?.id ?? null,
    suggestedOwnerName: ownerMatch?.name ?? null,
    recommendedActions,
    nextAction,
    confidence: 0,
    needsReview: false,
    requestMoreInfo: false,
  }

  const generationStart = nowMs()
  const aiPatch = await tryModelGeneration({
    config,
    report: {
      title: report.title,
      rawText: redactedText,
      logs: redactedLogs,
    },
    heuristicDraft,
  }).catch(() => null)

  const mergedDraft: TriageDraft = {
    ...heuristicDraft,
    ...aiPatch,
    classification:
      typeof aiPatch?.classification === 'string'
        ? aiPatch.classification
        : heuristicDraft.classification,
    severityLabel: heuristicDraft.severityLabel,
    suspectedRootCause:
      typeof aiPatch?.suspectedRootCause === 'string'
        ? aiPatch.suspectedRootCause
        : heuristicDraft.suspectedRootCause,
    evidence: heuristicDraft.evidence,
    extractedSignals: heuristicDraft.extractedSignals,
    reproSteps: Array.isArray(aiPatch?.reproSteps) ? aiPatch.reproSteps : heuristicDraft.reproSteps,
    missingInfo: Array.isArray(aiPatch?.missingInfo)
      ? aiPatch.missingInfo
      : heuristicDraft.missingInfo,
    uncertainty: heuristicDraft.uncertainty,
    duplicateCandidates: heuristicDraft.duplicateCandidates,
    clusterId: heuristicDraft.clusterId,
    clusterTitle: heuristicDraft.clusterTitle,
    suggestedOwnerId: heuristicDraft.suggestedOwnerId,
    suggestedOwnerName: heuristicDraft.suggestedOwnerName,
    recommendedActions: Array.isArray(aiPatch?.recommendedActions)
      ? aiPatch.recommendedActions
      : buildRecommendedActions({
          nextAction:
            typeof aiPatch?.nextAction === 'string'
              ? aiPatch.nextAction
              : heuristicDraft.nextAction,
          severity: heuristicDraft.severity,
          classification:
            typeof aiPatch?.classification === 'string'
              ? aiPatch.classification
              : heuristicDraft.classification,
          component:
            typeof aiPatch?.component === 'string' ? aiPatch.component : heuristicDraft.component,
          clusterSize,
          missingInfo: Array.isArray(aiPatch?.missingInfo)
            ? aiPatch.missingInfo
            : heuristicDraft.missingInfo,
        }),
  }

  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'generate_structured_output',
      input: { provider: config.AI_PROVIDER, model: config.AI_MODEL ?? null },
      output: {
        summary: mergedDraft.summary,
        classification: mergedDraft.classification,
        component: mergedDraft.component,
        suspectedRootCause: mergedDraft.suspectedRootCause,
        recommendedActions: mergedDraft.recommendedActions,
        nextAction: mergedDraft.nextAction,
      },
      durationMs: duration(generationStart),
    },
  })

  const confidenceStart = nowMs()
  const confidence = computeConfidence({
    reproSteps: mergedDraft.reproSteps,
    missingInfo: mergedDraft.missingInfo,
    duplicateCandidates: mergedDraft.duplicateCandidates,
    severity: mergedDraft.severity,
  })

  const needsReview = confidence > 0.65 && confidence <= 0.85
  const requestMoreInfo = confidence <= 0.65
  const nextStatus =
    confidence > 0.85
      ? ReportStatus.ASSIGNED
      : needsReview
        ? ReportStatus.NEEDS_REVIEW
        : ReportStatus.NEEDS_REVIEW

  await prisma.triageStep.create({
    data: {
      reportId: report.id,
      stepName: 'compute_confidence',
      input: {
        reproSteps: mergedDraft.reproSteps.length,
        missingInfo: mergedDraft.missingInfo.length,
      },
      output: { confidence, needsReview, requestMoreInfo, nextStatus },
      durationMs: duration(confidenceStart),
    },
  })

  await prisma.triageResult.create({
    data: {
      reportId: report.id,
      summary: mergedDraft.summary,
      classification: mergedDraft.classification,
      severity: mergedDraft.severity,
      severityLabel: mergedDraft.severityLabel,
      component: mergedDraft.component,
      suspectedRootCause: mergedDraft.suspectedRootCause,
      clusterId: mergedDraft.clusterId,
      suggestedOwnerId: mergedDraft.suggestedOwnerId,
      confidence,
      needsReview,
      requestMoreInfo,
      evidence: mergedDraft.evidence as Prisma.InputJsonValue,
      extractedSignals: mergedDraft.extractedSignals as Prisma.InputJsonValue,
      reproSteps: mergedDraft.reproSteps as Prisma.InputJsonValue,
      missingInfo: mergedDraft.missingInfo as Prisma.InputJsonValue,
      uncertainty: mergedDraft.uncertainty as Prisma.InputJsonValue,
      duplicateCandidates: mergedDraft.duplicateCandidates as Prisma.InputJsonValue,
      recommendedActions: mergedDraft.recommendedActions as Prisma.InputJsonValue,
      nextAction: mergedDraft.nextAction,
    },
  })

  await prisma.report.update({
    where: { id: report.id },
    data: {
      clusterId: mergedDraft.clusterId,
      status: nextStatus,
      updatedAt: new Date(),
    },
  })

  if (previousClusterId && previousClusterId !== mergedDraft.clusterId) {
    await refreshClusterPacketCount(previousClusterId).catch(() => 0)
  }
}

export async function buildDashboardStats(orgId: string) {
  const reports = await prisma.report.findMany({
    where: { orgId },
    include: {
      triageResult: true,
    },
  })

  const users = await prisma.user.findMany({
    where: {
      orgId,
      status: { not: 'DISABLED' },
    },
  })

  const steps = await prisma.triageStep.findMany({
    where: {
      report: { orgId },
      stepName: 'compute_confidence',
    },
  })

  const clusters = await prisma.packetCluster.findMany({
    where: { orgId },
  })

  const highSeverity = reports.filter((report) => {
    const severity = report.triageResult?.severity
    return severity === Severity.HIGH || severity === Severity.CRITICAL
  }).length

  const openReports = reports.filter((report) => report.status !== ReportStatus.RESOLVED).length
  const avgConfidence =
    reports.length > 0
      ? reports.reduce((sum, report) => sum + (report.triageResult?.confidence ?? 0), 0) /
        reports.length
      : 0

  const avgTriageTime =
    steps.length > 0 ? steps.reduce((sum, step) => sum + step.durationMs, 0) / steps.length : 0

  const bySeverity = reports.reduce<Record<string, number>>((acc, report) => {
    const key = report.triageResult?.severity ?? 'UNTRIAGED'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const duplicateClusters = clusters.filter((cluster) => cluster.packetCount > 1).length

  const missingInfoRate =
    reports.length > 0
      ? reports.filter((report) => {
          const missingInfo = report.triageResult?.missingInfo
          return Array.isArray(missingInfo) && missingInfo.length > 0
        }).length / reports.length
      : 0

  const reportsPerEmployee = users.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    reports: reports.filter((report) => report.triageResult?.suggestedOwnerId === user.id).length,
  }))

  return {
    companyHealth: {
      totalReports: reports.length,
      openReports,
      highSeverity,
      avgConfidence: Number(avgConfidence.toFixed(2)),
      avgTriageTimeMs: Math.round(avgTriageTime),
    },
    teamPerformance: {
      reportsPerEmployee,
      reviewTimes: reports
        .filter((report) => report.triageResult)
        .map((report) => ({
          reportId: report.id,
          title: report.title,
          updatedAt: report.updatedAt,
          status: report.status,
        })),
      overloadedQueues: reportsPerEmployee.filter((entry) => entry.reports >= 3),
    },
    queueIntelligence: {
      severityDistribution: bySeverity,
      duplicateClusters,
      activeClusters: clusters.filter((cluster) => cluster.status !== 'RESOLVED').length,
      missingInfoRate: Number(missingInfoRate.toFixed(2)),
    },
    security: {
      redactions: await prisma.triageArtifact.count({
        where: {
          report: { orgId },
          type: TriageArtifactType.METADATA,
        },
      }),
      auditLogs: await prisma.auditLog.count({ where: { orgId } }),
      riskyReports: reports.filter((report) => report.triageResult?.severity === Severity.CRITICAL)
        .length,
    },
  }
}
