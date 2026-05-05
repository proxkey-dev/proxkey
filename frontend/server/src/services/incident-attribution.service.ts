const MODEL_VERSION = 'graph-temporal-naive-bayes-v1'

export type SignalKind = 'error_rate' | 'latency' | 'alert' | 'saturation'

export type DeployEventInput = {
  deployId: string
  commitHash: string
  pr: string
  service: string
  deployedAt: Date
  metadata?: Record<string, unknown>
}

export type ObservabilitySignalInput = {
  signalId: string
  service: string
  timestamp: Date
  kind: SignalKind
  severity: number
  description: string
}

export type AttributionScoringConfig = {
  maxDelayHours: number
  clockSkewMinutes: number
  unknownPrior: number
  unknownSignalLikelihoodRatio: number
  backgroundSignalProbability: number
  immediateDecayHours: number
  delayedDecayHours: number
  dependencyDecay: number
  callerDecay: number
  undirectedDecay: number
  maxGraphDepth: number
  kindWeights: Record<SignalKind, number>
}

export type IncidentAttributionInput = {
  incidentId: string
  primaryService: string
  startedAt: Date
  detectedAt: Date
  deploys: DeployEventInput[]
  signals: ObservabilitySignalInput[]
  serviceDependencies: Record<string, string[]>
  config?: Partial<Omit<AttributionScoringConfig, 'kindWeights'>> & {
    kindWeights?: Partial<Record<SignalKind, number>>
  }
}

export type SignalContribution = {
  signalId: string
  signalService: string
  signalKind: SignalKind
  lagHours: number
  temporalFactor: number
  graphRelationship: string
  graphDistance: number | null
  graphFactor: number
  likelihoodRatio: number
  logContribution: number
}

export type RankedCommit = {
  rank: number
  deployId: string
  commitHash: string
  pr: string
  service: string
  deployedAt: string
  confidence: number
  logScore: number
  topEvidence: SignalContribution[]
}

export type IncidentAttributionResult = {
  incidentId: string
  modelVersion: string
  scoredAt: string
  unknownConfidence: number
  rankedCommits: RankedCommit[]
}

type GraphEvidence = {
  relationship: string
  distance: number | null
  factor: number
}

type ScoredDeploy = {
  deploy: DeployEventInput
  logScore: number
  evidence: SignalContribution[]
}

const DEFAULT_CONFIG: AttributionScoringConfig = {
  maxDelayHours: 6,
  clockSkewMinutes: 5,
  unknownPrior: 0.15,
  unknownSignalLikelihoodRatio: 1.8,
  backgroundSignalProbability: 0.08,
  immediateDecayHours: 0.8,
  delayedDecayHours: 4,
  dependencyDecay: 0.9,
  callerDecay: 0.7,
  undirectedDecay: 0.45,
  maxGraphDepth: 4,
  kindWeights: {
    error_rate: 1,
    alert: 0.95,
    latency: 0.75,
    saturation: 0.65,
  },
}

export class IncidentAttributionService {
  rank(input: IncidentAttributionInput): IncidentAttributionResult {
    const config = mergeConfig(input.config)
    const graph = new ServiceGraph(input.serviceDependencies)
    const candidates = input.deploys.filter((deploy) =>
      this.isCandidate(deploy, input.signals, input.startedAt, input.detectedAt, config),
    )

    if (candidates.length === 0) {
      return {
        incidentId: input.incidentId,
        modelVersion: MODEL_VERSION,
        scoredAt: new Date().toISOString(),
        unknownConfidence: 1,
        rankedCommits: [],
      }
    }

    const candidatePrior = (1 - config.unknownPrior) / candidates.length
    const scored = candidates.map((deploy): ScoredDeploy => {
      const primaryGraph = graph.evidence(deploy.service, input.primaryService, config)
      const primaryBoost = 0.75 + 0.5 * primaryGraph.factor
      const evidence = input.signals.map((signal) =>
        this.scoreSignal(deploy, signal, graph, config),
      )
      const logScore =
        Math.log(candidatePrior) +
        Math.log(primaryBoost) +
        evidence.reduce((sum, item) => sum + item.logContribution, 0)

      return { deploy, logScore, evidence }
    })

    const unknownLogScore =
      Math.log(config.unknownPrior) +
      input.signals.reduce(
        (sum, signal) =>
          sum + (1 + clamp(signal.severity, 0, 1)) * Math.log(config.unknownSignalLikelihoodRatio),
        0,
      )
    const denominator = logSumExp([unknownLogScore, ...scored.map((item) => item.logScore)])

    const rankedCommits = scored
      .map((item) => ({
        rank: 0,
        deployId: item.deploy.deployId,
        commitHash: item.deploy.commitHash,
        pr: item.deploy.pr,
        service: item.deploy.service,
        deployedAt: item.deploy.deployedAt.toISOString(),
        confidence: round(Math.exp(item.logScore - denominator), 4),
        logScore: round(item.logScore, 4),
        topEvidence: [...item.evidence]
          .sort((left, right) => right.logContribution - left.logContribution)
          .slice(0, 3),
      }))
      .sort(
        (left, right) =>
          right.confidence - left.confidence ||
          Date.parse(right.deployedAt) - Date.parse(left.deployedAt) ||
          left.commitHash.localeCompare(right.commitHash),
      )
      .map((item, index) => ({ ...item, rank: index + 1 }))

    return {
      incidentId: input.incidentId,
      modelVersion: MODEL_VERSION,
      scoredAt: new Date().toISOString(),
      unknownConfidence: round(Math.exp(unknownLogScore - denominator), 4),
      rankedCommits,
    }
  }

  private isCandidate(
    deploy: DeployEventInput,
    signals: ObservabilitySignalInput[],
    startedAt: Date,
    detectedAt: Date,
    config: AttributionScoringConfig,
  ): boolean {
    const skewHours = config.clockSkewMinutes / 60
    const timestamps =
      signals.length > 0 ? signals.map((signal) => signal.timestamp) : [startedAt, detectedAt]

    return timestamps.some((timestamp) => {
      const lagHours = hoursBetween(timestamp, deploy.deployedAt)
      return lagHours >= -skewHours && lagHours <= config.maxDelayHours
    })
  }

  private scoreSignal(
    deploy: DeployEventInput,
    signal: ObservabilitySignalInput,
    graph: ServiceGraph,
    config: AttributionScoringConfig,
  ): SignalContribution {
    const lagHours = hoursBetween(signal.timestamp, deploy.deployedAt)
    const signalTemporalFactor = temporalFactor(lagHours, config)
    const graphEvidence = graph.evidence(deploy.service, signal.service, config)
    const severity = clamp(signal.severity, 0, 1)
    const explained =
      signalTemporalFactor * graphEvidence.factor * config.kindWeights[signal.kind] * severity
    const likelihoodRatio =
      (config.backgroundSignalProbability + (1 - config.backgroundSignalProbability) * explained) /
      config.backgroundSignalProbability
    const logContribution = (1 + severity) * Math.log(Math.max(likelihoodRatio, 1))

    return {
      signalId: signal.signalId,
      signalService: signal.service,
      signalKind: signal.kind,
      lagHours: round(lagHours, 3),
      temporalFactor: round(signalTemporalFactor, 3),
      graphRelationship: graphEvidence.relationship,
      graphDistance: graphEvidence.distance,
      graphFactor: round(graphEvidence.factor, 3),
      likelihoodRatio: round(likelihoodRatio, 3),
      logContribution: round(logContribution, 3),
    }
  }
}

class ServiceGraph {
  private readonly dependencies = new Map<string, Set<string>>()
  private readonly undirected = new Map<string, Set<string>>()

  constructor(serviceDependencies: Record<string, string[]>) {
    for (const [service, dependencies] of Object.entries(serviceDependencies)) {
      this.ensureService(service)
      for (const dependency of dependencies) {
        this.ensureService(dependency)
        this.dependencies.get(service)!.add(dependency)
        this.undirected.get(service)!.add(dependency)
        this.undirected.get(dependency)!.add(service)
      }
    }
  }

  evidence(
    deployService: string,
    signalService: string,
    config: AttributionScoringConfig,
  ): GraphEvidence {
    if (deployService === signalService) {
      return { relationship: 'same_service', distance: 0, factor: 1 }
    }

    const dependencyDistance = this.shortestPath(
      signalService,
      deployService,
      this.dependencies,
      config.maxGraphDepth,
    )
    if (dependencyDistance !== null) {
      return {
        relationship: 'changed_dependency_observed_by_caller',
        distance: dependencyDistance,
        factor: config.dependencyDecay ** dependencyDistance,
      }
    }

    const callerDistance = this.shortestPath(
      deployService,
      signalService,
      this.dependencies,
      config.maxGraphDepth,
    )
    if (callerDistance !== null) {
      return {
        relationship: 'changed_caller_or_traffic_source',
        distance: callerDistance,
        factor: config.callerDecay ** callerDistance,
      }
    }

    const undirectedDistance = this.shortestPath(
      deployService,
      signalService,
      this.undirected,
      config.maxGraphDepth,
    )
    if (undirectedDistance !== null) {
      return {
        relationship: 'connected_without_direction',
        distance: undirectedDistance,
        factor: config.undirectedDecay ** undirectedDistance,
      }
    }

    return { relationship: 'unconnected', distance: null, factor: 0.03 }
  }

  private ensureService(service: string): void {
    if (!this.dependencies.has(service)) {
      this.dependencies.set(service, new Set())
    }
    if (!this.undirected.has(service)) {
      this.undirected.set(service, new Set())
    }
  }

  private shortestPath(
    start: string,
    target: string,
    adjacency: Map<string, Set<string>>,
    maxDepth: number,
  ): number | null {
    if (start === target) {
      return 0
    }

    const queue: Array<{ service: string; distance: number }> = [{ service: start, distance: 0 }]
    const seen = new Set([start])

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]
      if (current.distance >= maxDepth) {
        continue
      }

      for (const next of adjacency.get(current.service) ?? []) {
        if (next === target) {
          return current.distance + 1
        }
        if (!seen.has(next)) {
          seen.add(next)
          queue.push({ service: next, distance: current.distance + 1 })
        }
      }
    }

    return null
  }
}

function mergeConfig(input: IncidentAttributionInput['config']): AttributionScoringConfig {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    kindWeights: {
      ...DEFAULT_CONFIG.kindWeights,
      ...input?.kindWeights,
    },
  }
}

function temporalFactor(lagHours: number, config: AttributionScoringConfig): number {
  const skewHours = config.clockSkewMinutes / 60
  if (lagHours < -skewHours || lagHours > config.maxDelayHours) {
    return 0
  }

  const lag = Math.max(0, lagHours)
  const immediate = Math.exp(-lag / config.immediateDecayHours)
  const delayed = Math.exp(-lag / config.delayedDecayHours)
  return 0.55 * immediate + 0.45 * delayed
}

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 3_600_000
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function logSumExp(values: number[]): number {
  const peak = Math.max(...values)
  return peak + Math.log(values.reduce((sum, value) => sum + Math.exp(value - peak), 0))
}

function round(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}
