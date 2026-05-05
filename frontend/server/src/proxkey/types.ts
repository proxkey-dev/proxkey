import type {
  Report,
  ReportSource,
  ReportStatus,
  Severity,
  TriageArtifactType,
  UserRole,
  UserStatus,
} from '@prisma/client'

export type PacketEvidence = {
  id: string
  source: ReportSource | string
  type: 'raw_text' | 'logs' | 'artifact' | 'metadata'
  title: string
  content: string
  provenance: {
    reportId: string
    artifactId?: string
    receivedAt: string
  }
  metadataJson?: Record<string, unknown>
}

export type ExtractedSignal = {
  name: string
  value: string
  confidence: number
  provenance: string
}

export type PacketUncertainty = {
  field: string
  reason: string
}

export type AuthenticatedUser = {
  id: string
  orgId: string
  email: string
  role: UserRole
  status: UserStatus
  name: string
  authType: 'session' | 'api-key' | 'auth0'
  sessionId: string | null
  token: string
}

export type TriageDraft = {
  summary: string
  classification: string
  severity: Severity
  severityLabel: string
  component: string
  suspectedRootCause: string
  evidence: PacketEvidence[]
  extractedSignals: ExtractedSignal[]
  reproSteps: string[]
  missingInfo: string[]
  uncertainty: PacketUncertainty[]
  duplicateCandidates: Array<{
    reportId: string
    title: string
    clusterId: string | null
    similarity: number
  }>
  clusterId: string | null
  clusterTitle: string | null
  suggestedOwnerId: string | null
  suggestedOwnerName: string | null
  recommendedActions: string[]
  nextAction: string
  confidence: number
  needsReview: boolean
  requestMoreInfo: boolean
}

export type ReportPayload = {
  title: string
  rawText: string
  logs?: string | null
  metadataJson?: Record<string, unknown>
  projectId?: string | null
  source: ReportSource
  artifacts?: Array<{
    type: TriageArtifactType
    content: string
  }>
}

export type QueueJobData = {
  reportId: string
}

export type ReportWithRelations = Report & {
  triageResult: null | {
    id: string
    summary: string
    severity: Severity
    component: string
    classification: string
    severityLabel: string | null
    suspectedRootCause: string | null
    clusterId: string | null
    confidence: number
    needsReview: boolean
    requestMoreInfo: boolean
    nextAction: string
    suggestedOwnerId: string | null
    suggestedOwner: null | {
      id: string
      name: string
      email: string
    }
    missingInfo: unknown
    uncertainty: unknown
    evidence: unknown
    extractedSignals: unknown
    reproSteps: unknown
    duplicateCandidates: unknown
    recommendedActions: unknown
    createdAt: Date
    updatedAt: Date
  }
  cluster: null | {
    id: string
    key: string
    title: string
    component: string | null
    packetCount: number
  }
  project: null | {
    id: string
    name: string
    repoUrl: string | null
  }
}

export type InboxRow = {
  id: string
  title: string
  severity: Severity | null
  component: string | null
  owner: string | null
  status: ReportStatus
  confidence: number | null
  updatedAt: string
  source: ReportSource
}
